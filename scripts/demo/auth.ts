import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname } from 'node:path';

import QRCode from 'qrcode';

import type {
    CimdSession,
    DeviceSession,
    Discovery,
    FetchImpl,
    OAuthClient,
    OAuthConfig,
    OAuthEvent,
    Profile,
    ProviderResponse,
    Tokens
} from './types.ts';
import { asError } from './types.ts';

const bapi = 'https://api.clerk.com/v1';
const scope = 'openid profile';
const deviceName = 'Example Workshop Hack Night Device Demo';
const mcpName = 'Example Workshop Hack Night MCP Client';
function random() {
    return randomBytes(32).toString('base64url');
}
function equal(a: string | null | undefined, b: string | null | undefined) {
    const left = Buffer.from(a || '');
    const right = Buffer.from(b || '');
    return left.length === right.length && timingSafeEqual(left, right);
}
function summary(tokens: Tokens) {
    return {
        token_type: tokens.token_type,
        expires_in: tokens.expires_in,
        scope: tokens.scope,
        access_token: '[received; kept on server]',
        refresh_token: Boolean(tokens.refresh_token),
        id_token: Boolean(tokens.id_token)
    };
}
function identity(profile: Profile) {
    return {
        sub: profile.sub,
        name: profile.name,
        preferred_username: profile.preferred_username
    };
}

interface AuthOptions {
    secretKey?: string;
    configPath?: string;
    getPublicBase?: () => string;
    fetchImpl?: FetchImpl;
    now?: () => number;
    schedule?: (fn: () => void, delay: number) => NodeJS.Timeout | number;
    cancel?: (timer: NodeJS.Timeout | number | null) => void;
}
export class AuthDemo {
    cimdAdmission: 'compatible' | 'pre-registered' = 'compatible';
    declare secretKey: string;
    declare configPath: string;
    declare getPublicBase: () => string;
    declare fetchImpl: FetchImpl;
    declare now: () => number;
    declare schedule: NonNullable<AuthOptions['schedule']>;
    declare cancel: NonNullable<AuthOptions['cancel']>;
    ready: boolean;
    setupError: string | null;
    client: OAuthClient | null;
    discovery: Discovery | null;
    device: DeviceSession | null;
    cimd: CimdSession | null;
    events: OAuthEvent[];
    timer: NodeJS.Timeout | number | null;
    metadataFetches: number;
    frontend = '';

    constructor({
        secretKey = '',
        configPath = '.local/demo/oauth-config.json',
        getPublicBase = () => '',
        fetchImpl = fetch,
        now = Date.now,
        schedule = (fn, delay) => setTimeout(fn, delay),
        cancel = timer => {
            if (timer !== null) {
                clearTimeout(timer);
            }
        }
    }: AuthOptions) {
        Object.assign(this, {
            secretKey,
            configPath,
            getPublicBase,
            fetchImpl,
            now,
            schedule,
            cancel
        });
        this.ready = false;
        this.setupError = null;
        this.client = null;
        this.discovery = null;
        this.device = null;
        this.cimd = null;
        this.events = [];
        this.timer = null;
        this.metadataFetches = 0;
    }
    log(flow: string, message: string, details: Record<string, unknown> = {}) {
        this.events.push({
            at: new Date(this.now()).toISOString(),
            flow,
            message,
            ...details
        });
        this.events = this.events.slice(-80);
    }
    async request(url: string, options: RequestInit = {}) {
        const response = await this.fetchImpl(url, {
            ...options,
            headers: {
                'User-Agent': 'ClerkReleaseLab/3.0',
                ...Object.fromEntries(new Headers(options.headers))
            },
            signal: AbortSignal.timeout(15000)
        });
        let data = {} as ProviderResponse;
        try {
            data = await response.json();
        } catch {
            /* Preserve the HTTP status for non-JSON errors. */
        }
        return { response, data };
    }
    async backend(path: string, method = 'GET', body?: unknown) {
        const { response, data } = await this.request(`${bapi}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${this.secretKey}`,
                'Content-Type': 'application/json'
            },
            ...(body ? { body: JSON.stringify(body) } : {})
        });
        if (!response.ok) {
            throw new Error(
                `Clerk setup HTTP ${response.status}: ${data.errors?.map(error => error.code).join(', ') || 'request failed'}`
            );
        }
        return data;
    }
    async saveConfig(config: OAuthConfig) {
        await mkdir(dirname(this.configPath), { recursive: true, mode: 0o700 });
        await writeFile(
            `${this.configPath}.tmp`,
            JSON.stringify(config, null, 2),
            { mode: 0o600 }
        );
        await rename(`${this.configPath}.tmp`, this.configPath);
    }
    async init() {
        if (!this.secretKey?.startsWith('sk_test_')) {
            throw new Error(
                'The OAuth labs require your development CLERK_OAUTH_SECRET_KEY. Production keys are rejected.'
            );
        }
        const domains = await this.backend('/domains');
        const domain = domains.data.find(item => !item.is_satellite);
        if (!domain) {
            throw new Error('No development domain found.');
        }
        this.frontend = domain.frontend_api_url;
        const { response, data } = await this.request(
            `${this.frontend}/.well-known/openid-configuration`
        );
        if (
            !response.ok ||
            !data.device_authorization_endpoint ||
            !data.token_endpoint ||
            !data.authorization_endpoint ||
            !data.userinfo_endpoint
        ) {
            throw new Error(
                'The development instance does not advertise the required OAuth endpoints.'
            );
        }
        for (const key of [
            'issuer',
            'authorization_endpoint',
            'token_endpoint',
            'device_authorization_endpoint',
            'userinfo_endpoint',
            'revocation_endpoint'
        ]) {
            if (
                data[key] &&
                new URL(typeof data[key] === 'string' ? data[key] : '')
                    .origin !== new URL(this.frontend).origin
            ) {
                throw new Error('Unexpected OAuth discovery origin.');
            }
        }
        this.discovery = data;
        const settings = await this.backend(
            '/instance/oauth_application_settings'
        );
        let previous: OAuthConfig | null = null;
        try {
            previous = JSON.parse(await readFile(this.configPath, 'utf8'));
        } catch (caught) {
            const error = asError(caught);
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
        const originalAdvertised =
            previous?.issuer === data.issuer
                ? previous.originalAdvertised
                : settings.client_id_metadata_documents_advertised;
        const config = {
            issuer: data.issuer,
            originalAdvertised,
            currentAdvertised: settings.client_id_metadata_documents_advertised
        };
        // Persist the original setting before making the narrowly scoped development-only change.
        await this.saveConfig(config);
        const clients = await this.backend(
            `/oauth_applications?name_query=${encodeURIComponent(deviceName)}&limit=100`
        );
        let client = clients.data?.find(item => item.name === deviceName);
        if (!client) {
            client = await this.backend('/oauth_applications', 'POST', {
                name: deviceName,
                public: true,
                scopes: scope,
                device_authorization_grant_enabled: true,
                consent_screen_enabled: true,
                pkce_required: true
            });
        }
        if (!client.device_authorization_grant_enabled || !client.public) {
            throw new Error(
                'The demo OAuth client is not public or device authorization is disabled.'
            );
        }
        this.client = {
            id: client.id,
            client_id: client.client_id,
            name: client.name,
            scopes: client.scopes,
            public: client.public
        };
        if (
            settings.client_id_metadata_documents_only_allow_pre_registered_clients
        ) {
            this.cimdAdmission = 'pre-registered';
            this.log(
                'setup',
                'Pre-register this demo’s current metadata URL in Clerk before connecting. Existing admission policy preserved.'
            );
        }
        if (!settings.client_id_metadata_documents_advertised) {
            await this.backend(
                '/instance/oauth_application_settings',
                'PATCH',
                {
                    client_id_metadata_documents_advertised: true
                }
            );
        }
        await this.saveConfig({
            ...config,
            currentAdvertised: true,
            client: this.client
        });
        this.ready = true;
        this.log('setup', 'Development OAuth labs ready', {
            issuer: this.discovery!.issuer,
            scopes: scope,
            production_settings_changed: false
        });
    }
    metadata() {
        const base = this.getPublicBase();
        if (!base) {
            return null;
        }
        return {
            client_id: `${base}/oauth/client-metadata.json`,
            client_name: mcpName,
            redirect_uris: [`${base}/oauth/callback`],
            token_endpoint_auth_method: 'none'
        };
    }
    snapshot() {
        if (
            this.cimd?.phase === 'pending' &&
            this.now() > this.cimd.expiresAt
        ) {
            this.cimd.phase = 'expired';
            this.cimd.error =
                'Consent link expired. Prepare a fresh connection.';
            delete this.cimd.verifier;
            delete this.cimd.state;
            this.cimd.authorizationUrl = '';
        }
        const metadata = this.metadata()!;
        return {
            ready: this.ready && Boolean(metadata),
            setupError: this.setupError,
            environment: 'development',
            cimdAdmission: this.cimdAdmission,
            scope,
            issuer: this.discovery?.issuer,
            discovery: this.discovery,
            client: this.client,
            metadata,
            metadataFetches: this.metadataFetches,
            protectedResource: metadata
                ? {
                      resource: `${this.getPublicBase()}/mcp`,
                      authorization_servers: [this.discovery?.issuer],
                      scopes_supported: ['profile']
                  }
                : null,
            device: this.device
                ? {
                      phase: this.device.phase,
                      userCode: this.device.userCode,
                      verificationUri: this.device.verificationUri,
                      verificationUriComplete:
                          this.device.verificationUriComplete,
                      qr: this.device.qr,
                      expiresAt: this.device.expiresAt,
                      interval: this.device.interval,
                      nextPollAt: this.device.nextPollAt,
                      tokenSummary: this.device.tokens
                          ? summary(this.device.tokens)
                          : null,
                      profile: this.device.profile,
                      error: this.device.error
                  }
                : null,
            cimd: this.cimd
                ? {
                      phase: this.cimd.phase,
                      authorizationUrl: this.cimd.authorizationUrl,
                      challenge: this.cimd.challenge,
                      clientId: this.cimd.clientId,
                      redirectUri: this.cimd.redirectUri,
                      expiresAt: this.cimd.expiresAt,
                      tokenSummary: this.cimd.tokens
                          ? summary(this.cimd.tokens)
                          : null,
                      profile: this.cimd.profile,
                      toolResult: this.cimd.toolResult,
                      error: this.cimd.error
                  }
                : null,
            events: this.events
        };
    }
    async profile(tokens: Tokens) {
        const { response, data } = await this.request(
            this.discovery!.userinfo_endpoint,
            {
                headers: { Authorization: `Bearer ${tokens.access_token}` }
            }
        );
        if (!response.ok || !data.sub) {
            throw new Error(`User info HTTP ${response.status}.`);
        }
        return identity(data);
    }
    async form(url: string, params: Record<string, string>) {
        return this.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(params).toString()
        });
    }
    async startDevice() {
        if (!this.ready) {
            throw new Error(
                this.setupError || 'OAuth setup is still starting.'
            );
        }
        this.cancel(this.timer);
        const session: DeviceSession = {
            phase: 'starting',
            userCode: '',
            verificationUri: '',
            verificationUriComplete: '',
            qr: '',
            interval: 0,
            expiresAt: 0
        };
        this.device = session;
        const { response, data } = await this.form(
            this.discovery!.device_authorization_endpoint,
            {
                client_id: this.client!.client_id,
                scope
            }
        );
        if (!response.ok) {
            session.phase = 'error';
            session.error = data.error || `HTTP ${response.status}`;
            throw new Error(`Device authorization: ${session.error}`);
        }
        if (
            !data.device_code ||
            !data.user_code ||
            !(Number(data.interval) > 0) ||
            !(Number(data.expires_in) > 0)
        ) {
            throw new Error('Invalid device authorization response.');
        }
        const verification = new URL(data.verification_uri);
        const complete = new URL(
            data.verification_uri_complete || data.verification_uri
        );
        if (
            verification.protocol !== 'https:' ||
            complete.origin !== verification.origin
        ) {
            throw new Error('Invalid verification URL.');
        }
        Object.assign(session, {
            phase: 'pending',
            deviceCode: data.device_code,
            userCode: data.user_code,
            verificationUri: data.verification_uri,
            verificationUriComplete: complete.href,
            interval: Number(data.interval),
            expiresAt: this.now() + Number(data.expires_in) * 1000,
            qr: await QRCode.toDataURL(complete.href, {
                margin: 2,
                width: 240,
                errorCorrectionLevel: 'M'
            })
        });
        this.log('device', 'Device code created', {
            http: response.status,
            display_code: data.user_code,
            interval_seconds: session.interval
        });
        this.planPoll(session);
        return this.snapshot();
    }
    planPoll(session: DeviceSession) {
        if (this.device !== session || session.phase !== 'pending') {
            return;
        }
        session.nextPollAt = this.now() + session.interval * 1000;
        this.timer = this.schedule(
            () => this.pollDevice(session),
            session.interval * 1000
        );
    }
    async pollDevice(session = this.device) {
        if (
            !session ||
            this.device !== session ||
            session.phase !== 'pending'
        ) {
            return;
        }
        if (this.now() >= session.expiresAt) {
            session.phase = 'expired';
            this.log('device', 'Device code expired');
            return;
        }
        try {
            const { response, data } = await this.form(
                this.discovery!.token_endpoint,
                {
                    client_id: this.client!.client_id,
                    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                    device_code: session.deviceCode!
                }
            );
            if (this.device !== session) {
                return;
            }
            if (response.ok && data.access_token) {
                session.tokens = data;
                session.profile = await this.profile(data);
                session.phase = 'authorized';
                delete session.deviceCode;
                this.log(
                    'device',
                    'Phone approval received; tokens exchanged',
                    { http: response.status }
                );
                return;
            }
            this.log('device', 'Token poll', {
                http: response.status,
                result: data.error || 'invalid_response'
            });
            if (data.error === 'slow_down') {
                session.interval += 5;
            } else if (data.error !== 'authorization_pending') {
                session.phase =
                    data.error === 'access_denied'
                        ? 'denied'
                        : data.error === 'expired_token'
                          ? 'expired'
                          : 'error';
                session.error = data.error || `HTTP ${response.status}`;
                delete session.deviceCode;
                return;
            }
        } catch {
            if (session.tokens) {
                session.phase = 'error';
                session.error =
                    'Tokens received, but identity verification failed.';
                delete session.deviceCode;
                return;
            }
            session.interval = Math.min(session.interval + 5, 60);
            this.log('device', 'Network check failed; waiting before retry');
        }
        this.planPoll(session);
    }
    startCimd() {
        if (!this.ready || !this.metadata()) {
            throw new Error(
                this.setupError || 'Public client metadata is still starting.'
            );
        }
        const metadata = this.metadata()!;
        const verifier = random();
        const state = random();
        const nonce = random();
        const challenge = createHash('sha256')
            .update(verifier)
            .digest('base64url');
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: metadata.client_id,
            redirect_uri: metadata.redirect_uris[0],
            scope,
            state,
            nonce,
            code_challenge: challenge,
            code_challenge_method: 'S256'
        });
        this.cimd = {
            phase: 'pending',
            state,
            verifier,
            nonce,
            challenge,
            clientId: metadata.client_id,
            redirectUri: metadata.redirect_uris[0],
            expiresAt: this.now() + 600000,
            authorizationUrl: `${this.discovery!.authorization_endpoint}?${params}`
        };
        this.log(
            'cimd',
            'Authorization prepared with URL client identity and S256 PKCE',
            {
                client_id: metadata.client_id,
                scope
            }
        );
        return this.snapshot();
    }
    async callback(url: URL) {
        const session = this.cimd;
        if (
            !session ||
            session.phase !== 'pending' ||
            this.now() > session.expiresAt ||
            !equal(url.searchParams.get('state'), session.state)
        ) {
            throw new Error(
                'Invalid or expired OAuth callback state. Start a new connection.'
            );
        }
        const issuer = url.searchParams.get('iss');
        if (issuer && issuer !== this.discovery!.issuer) {
            throw new Error('OAuth issuer mismatch.');
        }
        session.phase = 'exchanging';
        if (url.searchParams.has('error')) {
            session.phase = 'denied';
            session.error = url.searchParams.get('error');
            this.log('cimd', 'Authorization denied');
            return;
        }
        const code = url.searchParams.get('code');
        if (!code) {
            session.phase = 'error';
            throw new Error('No authorization code returned.');
        }
        try {
            const { response, data } = await this.form(
                this.discovery!.token_endpoint,
                {
                    grant_type: 'authorization_code',
                    client_id: session.clientId,
                    redirect_uri: session.redirectUri,
                    code,
                    code_verifier: session.verifier!
                }
            );
            if (!response.ok || !data.access_token) {
                throw new Error(
                    `Token exchange HTTP ${response.status}: ${data.error || 'no token'}`
                );
            }
            session.tokens = data;
            session.profile = await this.profile(data);
            session.phase = 'connected';
            delete session.verifier;
            delete session.state;
            this.log(
                'cimd',
                'Authorization code exchanged; public client connected',
                {
                    http: response.status,
                    client_secret_used: false
                }
            );
        } catch (caught) {
            const error = asError(caught);
            session.phase = 'error';
            session.error = error.message;
            throw error;
        }
    }
    async probe() {
        if (!this.metadata()) {
            throw new Error('Metadata URL is still starting.');
        }
        const { response, data } = await this.request(
            this.metadata()!.client_id
        );
        if (
            !response.ok ||
            data.client_id !== this.metadata()!.client_id ||
            (data.redirect_uris as string[] | undefined)?.[0] !==
                this.metadata()!.redirect_uris[0]
        ) {
            throw new Error('Public metadata failed validation.');
        }
        this.log('cimd', 'Public HTTPS metadata verified', {
            http: response.status,
            client_id_matches_url: true,
            redirect_matches: true,
            client_secret_present: false
        });
        return this.snapshot();
    }
    async callTool() {
        if (
            this.cimd?.phase !== 'connected' ||
            !this.cimd.tokens?.access_token
        ) {
            throw new Error('Connect the CIMD client first.');
        }
        const requests = [
            {
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2025-06-18',
                    capabilities: {},
                    clientInfo: {
                        name: 'Example Workshop CIMD demo',
                        version: '1'
                    }
                }
            },
            { jsonrpc: '2.0', method: 'notifications/initialized' },
            { jsonrpc: '2.0', id: 2, method: 'tools/list' },
            {
                jsonrpc: '2.0',
                id: 3,
                method: 'tools/call',
                params: { name: 'list_project_templates', arguments: {} }
            }
        ];
        const results = [];
        for (const request of requests) {
            const { response, data } = await this.request(
                `${this.getPublicBase()}/mcp`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${this.cimd.tokens.access_token}`,
                        'Content-Type': 'application/json',
                        Accept: 'application/json, text/event-stream'
                    },
                    body: JSON.stringify(request)
                }
            );
            if (!response.ok || data.error) {
                throw new Error(
                    `MCP ${request.method}: HTTP ${response.status}`
                );
            }
            this.log('mcp', request.method, { http: response.status });
            results.push(data);
        }
        this.cimd.toolResult = results;
        return this.snapshot();
    }
    async disconnect() {
        this.cancel(this.timer);
        const tokens = [this.device?.tokens, this.cimd?.tokens].filter(
            (value): value is Tokens => Boolean(value)
        );
        this.device = null;
        this.cimd = null;
        let failures = 0;
        for (const record of tokens) {
            for (const token of [
                record.refresh_token,
                record.access_token
            ].filter((value): value is string => Boolean(value))) {
                try {
                    const { response } = await this.form(
                        this.discovery!.revocation_endpoint!,
                        { token }
                    );
                    if (!response.ok) {
                        failures++;
                    }
                } catch {
                    failures++;
                }
            }
        }
        this.log(
            'setup',
            failures
                ? 'Local sessions cleared; some remote revocations could not be confirmed'
                : 'Demo sessions disconnected',
            { unconfirmed_revocations: failures }
        );
        return this.snapshot();
    }
    async act(action: string) {
        if (action === 'device/start') {
            return this.startDevice();
        }
        if (action === 'cimd/start') {
            return this.startCimd();
        }
        if (action === 'cimd/probe') {
            return this.probe();
        }
        if (action === 'cimd/tool') {
            return this.callTool();
        }
        if (action === 'disconnect') {
            return this.disconnect();
        }
        throw new Error('Unknown OAuth demo action.');
    }
    async publicRoute(request: IncomingMessage, response: ServerResponse) {
        const url = new URL(request.url || '/', 'http://localhost');
        function json(
            status: number,
            body: unknown,
            extra: Record<string, string> = {}
        ) {
            response.writeHead(status, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff',
                ...extra
            });
            response.end(JSON.stringify(body));
        }
        if (
            url.pathname === '/oauth/client-metadata.json' &&
            ['GET', 'HEAD'].includes(request.method || '')
        ) {
            if (!this.metadata()) {
                json(503, { error: 'starting' });
                return true;
            }
            this.metadataFetches++;
            this.log('cimd', 'Metadata document requested');
            json(200, this.metadata());
            return true;
        }
        if (
            url.pathname === '/.well-known/oauth-protected-resource' &&
            request.method === 'GET'
        ) {
            json(200, this.snapshot().protectedResource);
            return true;
        }
        if (url.pathname === '/oauth/callback' && request.method === 'GET') {
            let ok = true;
            try {
                await this.callback(url);
            } catch {
                ok = false;
            }
            response.writeHead(ok ? 200 : 400, {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store',
                'Referrer-Policy': 'no-referrer',
                'Content-Security-Policy':
                    "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"
            });
            response.end(
                `<html><head><title>Example Workshop OAuth</title></head><body style="background:#0c0e11;color:#e7eaec;font:18px system-ui;padding:60px"><h1 style="color:#d6b169">Example Workshop</h1><h2>${ok ? 'Authorization response received.' : 'Connection could not be completed.'}</h2><p>Return to the local demo to inspect the result. You can close this tab.</p></body></html>`
            );
            return true;
        }
        if (url.pathname === '/mcp') {
            const supplied = request.headers.authorization?.replace(
                /^Bearer /,
                ''
            );
            const expected = this.cimd?.tokens?.access_token;
            if (
                !expected ||
                !equal(supplied, expected) ||
                this.cimd?.phase !== 'connected'
            ) {
                json(
                    401,
                    { error: 'unauthorized' },
                    {
                        'WWW-Authenticate': `Bearer resource_metadata="${this.getPublicBase()}/.well-known/oauth-protected-resource"`
                    }
                );
                return true;
            }
            if (
                !(this.cimd.tokens!.scope || scope)
                    .split(/\s+/)
                    .includes('profile')
            ) {
                json(403, { error: 'insufficient_scope' });
                return true;
            }
            try {
                await this.profile(this.cimd.tokens!);
            } catch {
                json(401, { error: 'token_invalid' });
                return true;
            }
            if (request.method !== 'POST') {
                json(405, { error: 'method_not_allowed' });
                return true;
            }
            let raw = '';
            for await (const chunk of request) {
                raw += chunk;
                if (raw.length > 8192) {
                    json(413, { error: 'too_large' });
                    return true;
                }
            }
            let rpc;
            try {
                rpc = JSON.parse(raw);
            } catch {
                json(400, { error: 'invalid_json' });
                return true;
            }
            if (rpc.method === 'notifications/initialized') {
                response.writeHead(202);
                response.end();
                return true;
            }
            let result;
            if (rpc.method === 'initialize') {
                result = {
                    protocolVersion: '2025-06-18',
                    capabilities: { tools: {} },
                    serverInfo: {
                        name: 'Example Workshop read-only demo',
                        version: '1.0'
                    }
                };
            } else if (rpc.method === 'tools/list') {
                result = {
                    tools: [
                        {
                            name: 'list_project_templates',
                            description:
                                'Read two fictional workshop catalogue template previews. Demo data; no production project access.',
                            inputSchema: {
                                type: 'object',
                                properties: {},
                                additionalProperties: false
                            }
                        }
                    ]
                };
            } else if (
                rpc.method === 'tools/call' &&
                rpc.params?.name === 'list_project_templates'
            ) {
                result = {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(
                                {
                                    templates: [
                                        {
                                            name: 'Starter Rack',
                                            gif: `${this.getPublicBase()}/starter-rack.gif`
                                        },
                                        {
                                            name: 'Compute Shelf',
                                            gif: `${this.getPublicBase()}/compute-shelf.gif`,
                                            credit: 'Synthetic sample animation; no customer project data'
                                        }
                                    ],
                                    source: 'Example Workshop public catalogue templates; demo server, not the production MCP endpoint'
                                },
                                null,
                                2
                            )
                        }
                    ]
                };
            } else {
                json(200, {
                    jsonrpc: '2.0',
                    id: rpc.id,
                    error: { code: -32601, message: 'Method or tool not found' }
                });
                return true;
            }
            json(200, { jsonrpc: '2.0', id: rpc.id, result });
            return true;
        }
        return false;
    }
    stop() {
        this.cancel(this.timer);
    }
}
