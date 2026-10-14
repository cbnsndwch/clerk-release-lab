import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createServer } from 'node:net';
import test from 'node:test';
import { promisify } from 'node:util';

async function freePort() {
    const server = createServer();
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
    const port = (server.address() as AddressInfo).port;
    await new Promise<void>(done => server.close(() => done()));
    return port;
}

void test('fresh standalone startup previews locally without credentials and blocks all sends', async t => {
    const port = await freePort();
    const assetPort = await freePort();
    const child = spawn(process.execPath, ['scripts/demo/email.ts'], {
        env: {
            ...process.env,
            CLERK_EMAIL_SECRET_KEY: '',
            CLERK_OAUTH_SECRET_KEY: '',
            CLERK_CONFIGURE_OAUTH: 'false',
            DEMO_TUNNEL: 'false',
            DEMO_PUBLIC_BASE_URL: '',
            DEMO_ASSET_BASE_URL: '',
            DEMO_PORT: String(port),
            DEMO_ASSET_PORT: String(assetPort)
        },
        stdio: 'ignore'
    });
    t.after(async () => {
        if (child.exitCode === null) {
            const exited = once(child, 'exit');
            child.kill();
            await exited;
        }
    });
    const base = `http://127.0.0.1:${port}`;
    let state;
    // Cold Windows imports can take several seconds alongside the render tests.
    for (let attempt = 0; attempt < 300; attempt++) {
        try {
            state = await (await fetch(`${base}/api/state`)).json();
            break;
        } catch {
            await new Promise<void>(done => setTimeout(done, 100));
        }
    }
    assert.ok(state, 'preview server started');
    assert.equal(state.domain, 'example.com');
    assert.equal(state.emailEnabled, false);
    const setup = await (await fetch(`${base}/api/setup`)).json();
    assert.equal(setup.mode, 'preview');
    assert.equal(setup.groups[0].checks[0].status, 'ready');
    const doctor = await promisify(execFile)(
        process.execPath,
        ['scripts/doctor.ts'],
        { env: { ...process.env, DEMO_PORT: String(port) } }
    );
    assert.match(doctor.stdout, /preview mode/);
    assert.match(doctor.stdout, /\[TODO\] Production email key/);
    const page = await (await fetch(base)).text();
    const token = page.match(/name="demo-token" content="([^"]+)"/)![1];
    const response = await fetch(`${base}/api/send`, {
        method: 'POST',
        headers: {
            Origin: base,
            'Content-Type': 'application/json',
            'X-Demo-Token': token
        },
        body: JSON.stringify({ recipient: 'test@example.com' })
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Preview mode cannot send/);
    const auth = await (await fetch(`${base}/api/auth/state`)).json();
    assert.equal(auth.ready, false);
    assert.match(auth.setupError, /OAuth labs are disabled/);
    assert.equal((await fetch(`${base}/assets/starter-rack.gif`)).status, 200);
    const publicBase = `http://127.0.0.1:${assetPort}`;
    assert.equal((await fetch(`${publicBase}/api/state`)).status, 404);
    assert.equal((await fetch(`${publicBase}/api/setup`)).status, 404);
});
