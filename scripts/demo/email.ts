import { spawn } from 'node:child_process';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

import { createClerkClient } from '@clerk/backend';

import { AuthDemo } from './auth.ts';
import { ASSETS } from './model.ts';
import { renderDocument } from './render.ts';
import type {
    ComposeInput,
    EmailBody,
    EmailState,
    EmailAttempt,
    FetchImpl
} from './types.ts';
import { asError } from './types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const apiUrl = 'https://api.clerk.com/v1';
const addressPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function address(value: unknown): string {
    if (
        typeof value !== 'string' ||
        !addressPattern.test(value) ||
        value.length > 254
    ) {
        throw new Error('Enter a valid recipient email address.');
    }
    return value;
}

export function sdkPayload(body: EmailBody) {
    const { to, reply_to, ...rest } = body;
    return {
        ...rest,
        to:
            'user_id' in to && to.user_id
                ? { userId: to.user_id }
                : { address: to.address! },
        ...(reply_to ? { replyTo: reply_to } : {})
    };
}

async function compose(
    input: Partial<ComposeInput> | string,
    domain: string,
    assetBase: string
): Promise<EmailBody> {
    // Retain the original simple script interface for smoke tests and saved demo sessions.
    if (typeof input === 'string') {
        return {
            to: { address: address(input) },
            from: { address: `demo@${domain}`, name: 'Example Workshop' },
            subject: 'Your rack design is ready | Example Workshop',
            html: '<p>A sample Example Workshop notification.</p>',
            text: 'A sample Example Workshop notification.'
        };
    }
    if (
        input.document?.blocks?.some(block => block.type === 'image') &&
        !assetBase?.startsWith('https://')
    ) {
        throw new Error(
            'GIF delivery URLs are still starting. Wait a moment and try again.'
        );
    }
    if (!input.document) {
        throw new Error('Choose an email template first.');
    }
    const recipient = input.recipient || '';
    const rendered = await renderDocument(input.document, assetBase);
    const to =
        input.recipientMode === 'user'
            ? { user_id: recipient }
            : { address: address(recipient) };
    if (
        input.recipientMode === 'user' &&
        !/^user_[a-zA-Z0-9]+$/.test(input.recipient ?? '')
    ) {
        throw new Error('Enter a valid Clerk user ID.');
    }
    const body: EmailBody = {
        to,
        from: { address: `demo@${domain}`, name: 'Example Workshop' },
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text
    };
    if (input.replyTo) {
        body.reply_to = { address: address(input.replyTo) };
    }
    for (const field of ['cc', 'bcc'] as const) {
        if (input[field]?.length) {
            if (!Array.isArray(input[field]) || input[field].length > 49) {
                throw new Error('Too many recipients.');
            }
            body[field] = input[field].map(address);
        }
    }
    const all = [recipient, ...(body.cc || []), ...(body.bcc || [])];
    if (
        all.length > 50 ||
        new Set(all.map(value => value.toLowerCase())).size !== all.length
    ) {
        throw new Error('Use up to 50 unique recipients.');
    }
    if (input.attachments?.length) {
        if (
            !Array.isArray(input.attachments) ||
            input.attachments.length > 10
        ) {
            throw new Error('Use up to 10 attachments.');
        }
        let total = 0;
        body.attachments = input.attachments.map(file => {
            if (
                typeof file.filename !== 'string' ||
                !file.filename ||
                file.filename.length > 255 ||
                /[\r\n/\\]/.test(file.filename)
            ) {
                throw new Error('Invalid attachment filename.');
            }
            if (
                typeof file.content !== 'string' ||
                !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
                    file.content
                )
            ) {
                throw new Error('Invalid attachment content.');
            }
            total += Buffer.from(file.content, 'base64').length;
            if (total > 1048576) {
                throw new Error('Attachments exceed the 1 MiB limit.');
            }
            return { filename: file.filename, content: file.content };
        });
    }
    return body;
}

type SdkSend = ReturnType<typeof createClerkClient>['emails']['create'];
interface EmailOptions {
    secretKey: string;
    domain: string;
    statePath: string;
    fetchImpl?: FetchImpl;
    sdkImpl?: SdkSend;
    assetBase?: string;
}
interface EmailResponse {
    id?: string;
    status?: string;
    errors?: { code: string }[];
}
export class EmailDemo {
    declare secretKey: string;
    declare domain: string;
    declare statePath: string;
    declare fetchImpl: FetchImpl;
    declare sdkImpl: SdkSend | undefined;
    declare assetBase: string;
    publicBase = '';
    auth?: AuthDemo;
    state: EmailState | null;
    busy: boolean;

    constructor({
        secretKey,
        domain,
        statePath,
        fetchImpl = fetch,
        sdkImpl,
        assetBase = ''
    }: EmailOptions) {
        Object.assign(this, {
            secretKey,
            domain,
            statePath,
            fetchImpl,
            sdkImpl,
            assetBase
        });
        this.state = null;
        this.busy = false;
    }
    async load() {
        try {
            const stored = JSON.parse(await readFile(this.statePath, 'utf8'));
            if (stored === null) {
                return;
            }
            if (stored.body?.from?.address !== `demo@${this.domain}`) {
                throw new Error('Saved demo belongs to another sender domain.');
            }
            this.state = stored;
        } catch (caught) {
            const error = asError(caught);
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }
    async save() {
        await mkdir(dirname(this.statePath), { recursive: true, mode: 0o700 });
        const temp = `${this.statePath}.tmp`;
        await writeFile(temp, JSON.stringify(this.state, null, 2), {
            mode: 0o600
        });
        await rename(temp, this.statePath);
    }
    async act(
        action: 'reset',
        input?: Partial<ComposeInput> | string
    ): Promise<{ reset: boolean }>;
    async act(
        action: 'send' | 'retry' | 'conflict' | 'status',
        input?: Partial<ComposeInput> | string
    ): Promise<EmailAttempt>;
    async act(
        action: string,
        input?: Partial<ComposeInput> | string
    ): Promise<EmailAttempt | { reset: boolean }>;
    async act(action: string, input: Partial<ComposeInput> | string = {}) {
        const options = typeof input === 'string' ? {} : input;
        if (this.busy) {
            throw new Error(
                'A request is already running. Wait for it to finish.'
            );
        }
        this.busy = true;
        try {
            if (action === 'reset') {
                this.state = null;
                await this.save();
                return { reset: true };
            }
            if (!this.secretKey) {
                throw new Error(
                    'Preview mode cannot send email. Set CLERK_EMAIL_SECRET_KEY to your own production key and restart.'
                );
            }
            if (action === 'send') {
                if (this.state) {
                    throw new Error(
                        'A message already exists. Retry it, or prepare a new send.'
                    );
                }
                const body = await compose(input, this.domain, this.assetBase);
                const key = options.key || `rack_demo_${randomUUID()}`;
                if (!/^[a-zA-Z0-9_-]{1,255}$/.test(key)) {
                    throw new Error('Invalid idempotency key.');
                }
                this.state = { key, body, attempts: [] };
                // Save before network I/O so an uncertain outcome can always reuse the same key.
                await this.save();
            } else if (!['retry', 'conflict', 'status'].includes(action)) {
                throw new Error('Unknown action.');
            }
            if (!this.state) {
                throw new Error('Send a message first.');
            }
            const sent = this.state.attempts.find(attempt => attempt.id);
            if (['conflict', 'status'].includes(action) && !sent) {
                throw new Error('Wait for a successful send first.');
            }
            const body = structuredClone(this.state.body);
            if (action === 'conflict') {
                body.subject += ' (changed)';
            }
            const transport =
                options.transport === 'sdk' && action !== 'status'
                    ? 'sdk'
                    : 'api';
            let outcome: EmailAttempt;
            try {
                let result: EmailResponse, http: number;
                if (transport === 'sdk') {
                    const send =
                        this.sdkImpl ||
                        ((params, options) =>
                            createClerkClient({
                                secretKey: this.secretKey
                            }).emails.create(params, options));
                    result = await send(sdkPayload(body), {
                        idempotencyKey: this.state.key
                    });
                    http = 200;
                } else {
                    const response = await this.fetchImpl(
                        `${apiUrl}/email${action === 'status' ? `/${encodeURIComponent(sent!.id!)}` : ''}`,
                        {
                            method: action === 'status' ? 'GET' : 'POST',
                            headers: {
                                Authorization: `Bearer ${this.secretKey}`,
                                'Content-Type': 'application/json',
                                'Idempotency-Key': this.state.key,
                                'User-Agent': 'ClerkReleaseLab/2.0'
                            },
                            ...(action !== 'status'
                                ? { body: JSON.stringify(body) }
                                : {}),
                            signal: AbortSignal.timeout(20000)
                        }
                    );
                    http = response.status;
                    try {
                        result = await response.json();
                    } catch {
                        result = {};
                    }
                }
                outcome = {
                    action,
                    transport,
                    // The native SDK returns the email resource, not its HTTP response envelope.
                    http: transport === 'sdk' ? undefined : http,
                    ok: http >= 200 && http < 300,
                    id: result.id,
                    status: result.status,
                    errorCodes: result.errors?.map(error => error.code),
                    at: new Date().toISOString()
                };
            } catch (caught) {
                const error = asError(caught);
                outcome = error.status
                    ? {
                          action,
                          transport,
                          http: error.status,
                          ok: false,
                          errorCodes: error.errors?.map(item => item.code),
                          at: new Date().toISOString()
                      }
                    : {
                          action,
                          transport,
                          ok: false,
                          error: 'Network timeout or connection failure. Outcome unknown; use Retry with the same key.',
                          at: new Date().toISOString()
                      };
            }
            this.state.attempts.push(outcome);
            await this.save();
            return outcome;
        } finally {
            this.busy = false;
        }
    }
}

export function createAssetServer(auth?: AuthDemo) {
    const allowed = new Set(ASSETS.map(asset => `/${asset.file}`));
    return createServer(async (request, response) => {
        if (auth) {
            try {
                if (await auth.publicRoute(request, response)) {
                    return;
                }
            } catch {
                if (!response.headersSent) {
                    response.writeHead(400, {
                        'Content-Type': 'application/json'
                    });
                }
                response.end('{"error":"invalid_demo_request"}');
                return;
            }
        }
        if (
            !['GET', 'HEAD'].includes(request.method || '') ||
            !allowed.has(request.url || '')
        ) {
            response.writeHead(404);
            response.end();
            return;
        }
        try {
            const bytes = await readFile(
                resolve(here, 'assets', request.url!.slice(1))
            );
            response.writeHead(200, {
                'Content-Type': 'image/gif',
                'Content-Length': bytes.length,
                'Cache-Control': 'public, max-age=3600',
                'X-Content-Type-Options': 'nosniff'
            });
            response.end(request.method === 'HEAD' ? undefined : bytes);
        } catch {
            response.writeHead(404);
            response.end();
        }
    });
}

export async function createDemoServer(demo: EmailDemo) {
    const token = randomUUID();
    const page = (await readFile(resolve(here, 'email.html'), 'utf8')).replace(
        'CSRF_TOKEN',
        token
    );
    const headers = {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy':
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; frame-src 'self' about:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    };
    return createServer(async (request, response) => {
        function json(status: number, value: unknown) {
            response.writeHead(status, {
                ...headers,
                'Content-Type': 'application/json'
            });
            response.end(JSON.stringify(value));
        }
        if (
            !/^(localhost|127\.0\.0\.1):[0-9]+$/.test(
                request.headers.host ?? ''
            )
        ) {
            json(403, { error: 'Use a localhost SSH tunnel.' });
            return;
        }
        try {
            const staticFiles: Record<string, [string, string]> = {
                '/': ['email.html', 'text/html; charset=utf-8'],
                '/composer.js': [
                    '../../.local/demo/composer.js',
                    'text/javascript'
                ],
                '/studio.css': ['studio.css', 'text/css'],
                '/auth.css': ['auth.css', 'text/css']
            };
            if (request.method === 'GET' && staticFiles[request.url || '']) {
                const [file, type] = staticFiles[request.url || ''];
                const body =
                    request.url === '/'
                        ? page
                        : await readFile(resolve(here, file));
                response.writeHead(200, { ...headers, 'Content-Type': type });
                response.end(body);
                return;
            }
            if (
                request.method === 'GET' &&
                ASSETS.some(asset => request.url === `/assets/${asset.file}`)
            ) {
                response.writeHead(200, {
                    ...headers,
                    'Content-Type': 'image/gif'
                });
                response.end(
                    await readFile(resolve(here, request.url!.slice(1)))
                );
                return;
            }
            if (request.method === 'GET' && request.url === '/api/state') {
                json(200, {
                    domain: demo.domain,
                    state: demo.state,
                    assetBase: demo.assetBase,
                    sdkVersion: '3.23.2',
                    emailEnabled: Boolean(demo.secretKey)
                });
                return;
            }
            if (request.method === 'GET' && request.url === '/api/auth/state') {
                json(
                    200,
                    demo.auth?.snapshot() || {
                        ready: false,
                        setupError: 'OAuth labs are not configured.'
                    }
                );
                return;
            }
            if (request.method === 'POST' && request.url?.startsWith('/api/')) {
                const supplied = Buffer.from(
                    typeof request.headers['x-demo-token'] === 'string'
                        ? request.headers['x-demo-token']
                        : ''
                );
                const expected = Buffer.from(token);
                if (
                    request.headers.origin !==
                        `http://${request.headers.host}` ||
                    supplied.length !== expected.length ||
                    !timingSafeEqual(supplied, expected)
                ) {
                    json(403, { error: 'Open the studio before sending.' });
                    return;
                }
                let raw = '';
                for await (const chunk of request) {
                    raw += chunk;
                    if (raw.length > 1600000) {
                        throw new Error('Request too large.');
                    }
                }
                const input = JSON.parse(raw || '{}');
                if (request.url.startsWith('/api/auth/')) {
                    if (!demo.auth) {
                        throw new Error('OAuth labs are not configured.');
                    }
                    json(
                        200,
                        await demo.auth.act(
                            request.url!.slice('/api/auth/'.length)
                        )
                    );
                    return;
                }
                if (request.url === '/api/render') {
                    json(
                        200,
                        await renderDocument(
                            input.document,
                            demo.assetBase || 'http://127.0.0.1:4318/assets'
                        )
                    );
                    return;
                }
                json(
                    200,
                    await demo.act(
                        request.url!.slice(5),
                        typeof input.document === 'object'
                            ? input
                            : (input.recipient ?? input)
                    )
                );
                return;
            }
            json(404, { error: 'Not found.' });
        } catch (caught) {
            const error = asError(caught);
            json(400, { error: error.message });
        }
    });
}

async function main() {
    let local: Record<string, string | undefined> = {};
    try {
        local = parseEnv(await readFile(resolve(root, '.env.local'), 'utf8'));
    } catch (caught) {
        const error = asError(caught);
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }
    const setting = (name: string) => process.env[name] ?? local[name] ?? '';
    const secretKey = setting('CLERK_EMAIL_SECRET_KEY');
    let domain = 'example.com';
    if (secretKey) {
        if (!secretKey.startsWith('sk_live_')) {
            throw new Error(
                'Email sending requires your own production CLERK_EMAIL_SECRET_KEY. Leave it blank for preview mode.'
            );
        }
        const response = await fetch(`${apiUrl}/domains`, {
            headers: {
                Authorization: `Bearer ${secretKey}`,
                'User-Agent': 'ClerkReleaseLab/2.0'
            },
            signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) {
            throw new Error(
                `Production key check failed: HTTP ${response.status}.`
            );
        }
        const domains = (await response.json()) as {
            data?: { is_satellite?: boolean; name: string }[];
        };
        domain = domains.data?.find(item => !item.is_satellite)?.name || '';
        if (!domain) {
            throw new Error('No primary production domain found.');
        }
        console.log(
            `Production key verified. Sender: demo@${domain}. No email has been sent.`
        );
    } else {
        console.log(
            'Preview mode: email sending disabled. No Clerk credentials or network access required.'
        );
    }
    if (process.argv.includes('--check')) {
        return;
    }
    const demo = new EmailDemo({
        secretKey,
        domain,
        statePath: resolve(root, '.local/demo/email.json'),
        assetBase:
            setting('DEMO_ASSET_BASE_URL') ||
            setting('DEMO_PUBLIC_BASE_URL') ||
            `http://127.0.0.1:${Number(setting('DEMO_PORT') || 4318)}/assets`
    });
    await demo.load();
    demo.publicBase = setting('DEMO_PUBLIC_BASE_URL');
    if (demo.publicBase && new URL(demo.publicBase).protocol !== 'https:') {
        throw new Error('DEMO_PUBLIC_BASE_URL must use HTTPS.');
    }
    const auth = new AuthDemo({
        secretKey: setting('CLERK_OAUTH_SECRET_KEY'),
        configPath: resolve(root, '.local/demo/oauth-config.json'),
        getPublicBase: () => demo.publicBase
    });
    demo.auth = auth;
    if (setting('CLERK_CONFIGURE_OAUTH') === 'true') {
        auth.init().catch(error => {
            auth.setupError = error.message;
            console.error(`OAuth lab setup: ${error.message}`);
        });
    } else {
        auth.setupError =
            'OAuth labs are disabled. Set your development CLERK_OAUTH_SECRET_KEY and CLERK_CONFIGURE_OAUTH=true, then restart. See README for the development settings this changes.';
    }
    const port = Number(setting('DEMO_PORT') || 4318);
    const assetPort = Number(setting('DEMO_ASSET_PORT') || 4319);
    for (const value of [port, assetPort]) {
        if (!Number.isInteger(value) || value < 1 || value > 65535) {
            throw new Error('Invalid demo port.');
        }
    }
    const server = await createDemoServer(demo);
    const assets = createAssetServer(auth);
    for (const target of [server, assets]) {
        target.on('error', error => {
            console.error(error.message);
            process.exit(1);
        });
    }
    server.listen(port, '127.0.0.1', () =>
        console.log(`Email studio: http://127.0.0.1:${port}`)
    );
    assets.listen(assetPort, '127.0.0.1');
    let tunnel: ReturnType<typeof spawn> | undefined;
    if (!demo.publicBase && setting('DEMO_TUNNEL') === 'true') {
        tunnel = spawn(
            'cloudflared',
            [
                'tunnel',
                '--no-autoupdate',
                '--url',
                `http://127.0.0.1:${assetPort}`
            ],
            {
                stdio: ['ignore', 'ignore', 'pipe']
            }
        );
        tunnel.on('error', () =>
            console.error(
                'cloudflared is unavailable. Set DEMO_ASSET_BASE_URL to a public HTTPS asset directory.'
            )
        );
        tunnel.stderr!.on('data', chunk => {
            const match = String(chunk).match(
                /https:\/\/[a-z0-9-]+\.trycloudflare\.com/
            );
            if (match && !demo.publicBase) {
                demo.publicBase = match[0];
                if (!setting('DEMO_ASSET_BASE_URL')) {
                    demo.assetBase = match[0];
                }
                console.log(
                    `Public GIFs, OAuth metadata/callback and read-only demo MCP: ${demo.publicBase}`
                );
            }
        });
        tunnel.on('exit', () => {
            demo.publicBase = '';
            if (!setting('DEMO_ASSET_BASE_URL')) {
                demo.assetBase = `http://127.0.0.1:${port}/assets`;
            }
            console.error('Public demo tunnel stopped. Restart the studio.');
        });
    }
    function stop() {
        auth.stop();
        tunnel?.kill();
        server.close();
        assets.close();
        process.exit(0);
    }
    process.on('SIGTERM', stop);
    process.on('SIGINT', stop);
}
if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    main().catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
