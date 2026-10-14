import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { AuthDemo } from './auth.ts';
import { createAssetServer } from './email.ts';
import type { FetchImpl } from './types.ts';

const issuer = 'https://issuer.example';
const discovery = {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    device_authorization_endpoint: `${issuer}/device`,
    userinfo_endpoint: `${issuer}/userinfo`,
    revocation_endpoint: `${issuer}/revoke`
};
function lab(fetchImpl: FetchImpl) {
    let clock = 100000;
    const delays: number[] = [];
    const auth = new AuthDemo({
        secretKey: 'sk_test_NOT_REAL',
        configPath: 'unused',
        getPublicBase: () => 'https://client.example',
        fetchImpl,
        now: () => clock,
        schedule: (_fn, delay) => {
            delays.push(delay);
            return delays.length;
        },
        cancel: () => {}
    });
    auth.ready = true;
    auth.discovery = discovery;
    auth.client = { client_id: 'public_demo_client' };
    return {
        auth,
        delays,
        advance: (ms: number) => {
            clock += ms;
        }
    };
}

void test('setup changes only development CIMD advertising and never persists a secret', async t => {
    const dir = await mkdtemp(join(tmpdir(), 'rack-auth-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const calls: { url: string; options: RequestInit }[] = [];
    const auth = new AuthDemo({
        secretKey: 'sk_test_NOT_REAL',
        configPath: join(dir, 'config.json'),
        getPublicBase: () => 'https://client.example',
        fetchImpl: async (url, options) => {
            calls.push({ url, options });
            if (url.endsWith('/domains')) {
                return Response.json({
                    data: [{ frontend_api_url: issuer, is_satellite: false }]
                });
            }
            if (url.includes('.well-known')) {
                return Response.json(discovery);
            }
            if (url.endsWith('/instance/oauth_application_settings')) {
                return Response.json({
                    client_id_metadata_documents_advertised: false,
                    client_id_metadata_documents_only_allow_pre_registered_clients: false
                });
            }
            if (options.method === 'POST') {
                return Response.json({
                    id: 'oa_demo',
                    client_id: 'public_id',
                    client_secret: 'DO_NOT_PERSIST',
                    name: 'Example Workshop Hack Night Device Demo',
                    public: true,
                    device_authorization_grant_enabled: true
                });
            }
            return Response.json({ data: [] });
        }
    });
    await auth.init();
    assert.equal(auth.ready, true);
    const patch = calls.find(call => call.options.method === 'PATCH');
    assert.deepEqual(JSON.parse(patch!.options.body as string), {
        client_id_metadata_documents_advertised: true
    });
    const config = await readFile(join(dir, 'config.json'), 'utf8');
    assert.ok(!config.includes('DO_NOT_PERSIST'));
    assert.ok(!config.includes('sk_test_'));
    const prod = new AuthDemo({ secretKey: 'sk_live_NOT_REAL' });
    await assert.rejects(prod.init(), /development/);
});

void test('device polling honors interval and slow_down; snapshots hide device codes and tokens', async () => {
    const pollReplies = [
        { error: 'authorization_pending' },
        { error: 'slow_down' },
        {
            access_token: 'ACCESS_PRIVATE',
            refresh_token: 'REFRESH_PRIVATE',
            id_token: 'ID_PRIVATE',
            scope: 'openid profile',
            expires_in: 3600
        }
    ];
    const { auth, delays, advance } = lab(async url => {
        if (url.endsWith('/device')) {
            return Response.json({
                device_code: 'DEVICE_PRIVATE',
                user_code: 'ABCD-EFGH',
                verification_uri: 'https://accounts.example/device',
                verification_uri_complete:
                    'https://accounts.example/device?user_code=ABCD-EFGH',
                interval: 5,
                expires_in: 600
            });
        }
        if (url.endsWith('/userinfo')) {
            return Response.json({ sub: 'user_mock', name: 'Demo builder' });
        }
        const value = pollReplies.shift();
        return Response.json(value, { status: value?.error ? 400 : 200 });
    });
    await auth.startDevice();
    assert.deepEqual(delays, [5000]);
    advance(5000);
    await auth.pollDevice();
    advance(5000);
    await auth.pollDevice();
    assert.equal(auth.device!.interval, 10);
    assert.equal(delays.at(-1), 10000);
    advance(10000);
    await auth.pollDevice();
    assert.equal(auth.device!.phase, 'authorized');
    const snapshot = JSON.stringify(auth.snapshot());
    for (const secret of [
        'DEVICE_PRIVATE',
        'ACCESS_PRIVATE',
        'REFRESH_PRIVATE',
        'ID_PRIVATE'
    ]) {
        assert.ok(!snapshot.includes(secret));
    }
    assert.ok(snapshot.includes('ABCD-EFGH'));
    assert.equal(auth.device!.profile!.sub, 'user_mock');
});

void test('device denial stops polling and expiry stops without another token request', async () => {
    let tokenCalls = 0;
    const { auth, delays, advance } = lab(async url => {
        if (url.endsWith('/device')) {
            return Response.json({
                device_code: 'private',
                user_code: 'CODE',
                verification_uri: 'https://accounts.example/device',
                interval: 5,
                expires_in: 10
            });
        }
        tokenCalls++;
        return Response.json({ error: 'access_denied' }, { status: 400 });
    });
    await auth.startDevice();
    advance(5000);
    await auth.pollDevice();
    assert.equal(auth.device!.phase, 'denied');
    assert.equal(delays.length, 1);
    await auth.startDevice();
    advance(11000);
    await auth.pollDevice();
    assert.equal(auth.device!.phase, 'expired');
    assert.equal(tokenCalls, 1);
});

void test('CIMD callback validates state, issuer and one-time use; PKCE verifier stays private', async () => {
    let tokenBody: URLSearchParams | undefined;
    const { auth } = lab(async (url, options) => {
        if (url.endsWith('/userinfo')) {
            return Response.json({ sub: 'user_mock', name: 'Demo builder' });
        }
        tokenBody = new URLSearchParams(options.body as string);
        return Response.json({
            access_token: 'ACCESS_PRIVATE',
            refresh_token: 'REFRESH_PRIVATE',
            scope: 'openid profile',
            expires_in: 3600
        });
    });
    auth.startCimd();
    const session = auth.cimd!;
    assert.equal(
        session.challenge,
        createHash('sha256').update(session.verifier!).digest('base64url')
    );
    assert.equal(
        auth.metadata()!.client_id,
        'https://client.example/oauth/client-metadata.json'
    );
    assert.ok(!JSON.stringify(auth.snapshot()).includes(session.verifier!));
    await assert.rejects(
        auth.callback(
            new URL(
                `https://client.example/oauth/callback?state=WRONG&code=code`
            )
        ),
        /state/
    );
    await assert.rejects(
        auth.callback(
            new URL(
                `https://client.example/oauth/callback?state=${session.state}&code=code&iss=https://wrong.example`
            )
        ),
        /issuer/
    );
    const callback = new URL(
        `https://client.example/oauth/callback?state=${session.state}&code=one_use_code&iss=${encodeURIComponent(issuer)}`
    );
    const verifier = session.verifier;
    await auth.callback(callback);
    assert.equal(auth.cimd!.phase, 'connected');
    assert.equal(tokenBody!.get('code_verifier'), verifier);
    assert.equal(tokenBody!.get('client_id'), auth.metadata()!.client_id);
    assert.equal(tokenBody!.has('client_secret'), false);
    await assert.rejects(auth.callback(callback), /state/);
    assert.ok(!JSON.stringify(auth.snapshot()).includes('ACCESS_PRIVATE'));
});

void test('public demo exposes metadata and a protected read-only MCP tool, never local APIs', async t => {
    const { auth } = lab(async () => Response.json({ sub: 'user_mock' }));
    auth.cimd = {
        phase: 'connected',
        challenge: 'challenge',
        clientId: 'client',
        redirectUri: 'https://client.example/callback',
        expiresAt: Date.now() + 10000,
        authorizationUrl: 'https://issuer.example/authorize',
        tokens: { access_token: 'ACCESS_PRIVATE', scope: 'openid profile' }
    };
    const server = createAssetServer(auth);
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
    t.after(() => new Promise<void>(done => server.close(() => done())));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const missing = await fetch(base + '/mcp', { method: 'POST', body: '{}' });
    assert.equal(missing.status, 401);
    assert.match(missing.headers.get('www-authenticate')!, /resource_metadata/);
    const wrong = await fetch(base + '/mcp', {
        method: 'POST',
        headers: { Authorization: 'Bearer WRONG' },
        body: '{}'
    });
    assert.equal(wrong.status, 401);
    for (const path of [
        '/api/state',
        '/api/auth/state',
        '/.env.local',
        '/composer.js'
    ]) {
        assert.equal((await fetch(base + path)).status, 404);
    }
    const metadata = await (
        await fetch(base + '/oauth/client-metadata.json')
    ).json();
    assert.equal(metadata.token_endpoint_auth_method, 'none');
    assert.equal(
        metadata.client_name,
        'Example Workshop Hack Night MCP Client'
    );
    const rpc = await fetch(base + '/mcp', {
        method: 'POST',
        headers: { Authorization: 'Bearer ACCESS_PRIVATE' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name: 'list_project_templates', arguments: {} }
        })
    });
    const value = await rpc.json();
    assert.equal(rpc.status, 200);
    assert.match(value.result.content[0].text, /Compute Shelf/);
    assert.match(value.result.content[0].text, /Synthetic sample animation/);
    assert.ok(!JSON.stringify(value).includes('ACCESS_PRIVATE'));
    auth.cimd!.tokens!.scope = 'openid';
    assert.equal(
        (
            await fetch(base + '/mcp', {
                method: 'POST',
                headers: { Authorization: 'Bearer ACCESS_PRIVATE' },
                body: '{}'
            })
        ).status,
        403
    );
});
