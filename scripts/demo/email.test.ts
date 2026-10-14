import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import test from 'node:test';

import { EmailDemo, createDemoServer } from './email.ts';
import type { FetchImpl } from './types.ts';

async function fixture(t: TestContext, fetchImpl: FetchImpl) {
    const dir = await mkdtemp(join(tmpdir(), 'rack-email-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    return new EmailDemo({
        secretKey: 'sk_live_TEST_ONLY',
        domain: 'example.com',
        statePath: join(dir, 'state.json'),
        fetchImpl
    });
}

void test('send, retry, conflict and restart keep one message identity; reset gives a fresh key', async t => {
    const calls: RequestInit[] = [];
    const stored = new Map<string, BodyInit | null | undefined>();
    async function mock(_url: string, init: RequestInit) {
        calls.push(init);
        const key = (init.headers as Record<string, string>)['Idempotency-Key'];
        if (stored.has(key) && stored.get(key) !== init.body) {
            return Response.json({}, { status: 409 });
        }
        stored.set(key, init.body);
        return Response.json({ id: 'ema_demo', status: 'queued' });
    }
    const demo = await fixture(t, mock);
    await demo.act('send', 'presenter@example.org');
    const firstKey = demo.state!.key;
    const restored = new EmailDemo({
        secretKey: demo.secretKey,
        domain: demo.domain,
        statePath: demo.statePath,
        fetchImpl: mock
    });
    await restored.load();
    await restored.act('retry');
    assert.equal(calls[0].body, calls[1].body);
    assert.equal(
        new Headers(calls[0].headers).get('Idempotency-Key'),
        new Headers(calls[1].headers).get('Idempotency-Key')
    );
    assert.equal((await restored.act('conflict')).http, 409);
    assert.equal(
        restored.state!.body.subject,
        'Your rack design is ready | Example Workshop'
    );
    await assert.rejects(
        restored.act('send', 'other@example.org'),
        /already exists/
    );
    await restored.act('reset');
    const resetReload = new EmailDemo({
        secretKey: demo.secretKey,
        domain: demo.domain,
        statePath: demo.statePath,
        fetchImpl: mock
    });
    await resetReload.load();
    assert.equal(resetReload.state, null);
    await resetReload.act('send', 'presenter@example.org');
    assert.notEqual(resetReload.state!.key, firstKey);
});

void test('ambiguous network failure persists the key and body for a safe retry', async t => {
    const demo = await fixture(t, async () => {
        throw new Error('timeout');
    });
    await demo.act('send', 'presenter@example.org');
    const restored = new EmailDemo({
        secretKey: demo.secretKey,
        domain: demo.domain,
        statePath: demo.statePath,
        fetchImpl: demo.fetchImpl
    });
    await restored.load();
    assert.equal(restored.state!.key, demo.state!.key);
    assert.deepEqual(restored.state!.body, demo.state!.body);
    assert.match(restored.state!.attempts[0].error!, /Outcome unknown/);
});

void test('HTTP server rejects cross-origin sends and never returns the secret', async t => {
    let sends = 0;
    const demo = await fixture(t, async () => {
        sends++;
        return Response.json({ id: 'ema_demo', status: 'accepted' });
    });
    const server = await createDemoServer(demo);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const page = await (await fetch(base)).text();
    assert.ok(!page.includes(demo.secretKey));
    const token = /name="demo-token" content="([^"]+)"/.exec(page)![1];
    const body = JSON.stringify({ recipient: 'presenter@example.org' });
    assert.equal(
        (await fetch(`${base}/api/send`, { method: 'POST', body })).status,
        403
    );
    assert.equal(
        (
            await fetch(`${base}/api/send`, {
                method: 'POST',
                headers: {
                    Origin: 'https://example.org',
                    'X-Demo-Token': token
                },
                body
            })
        ).status,
        403
    );
    assert.equal(sends, 0);
    const sent = await fetch(`${base}/api/send`, {
        method: 'POST',
        headers: { Origin: base, 'X-Demo-Token': token },
        body
    });
    assert.equal(sent.status, 200);
    assert.equal(sends, 1);
    const state = await (await fetch(`${base}/api/state`)).text();
    assert.ok(!state.includes(demo.secretKey));
});
