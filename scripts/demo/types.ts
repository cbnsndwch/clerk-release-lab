export type Alignment = 'left' | 'center' | 'right' | 'justify';
export type BlockType =
    | 'heading'
    | 'text'
    | 'image'
    | 'button'
    | 'stats'
    | 'divider'
    | 'spacer';
export interface Block {
    id: string;
    type: BlockType;
    label?: string;
    icon?: string;
    text?: string;
    align?: Alignment;
    asset?: string;
    alt?: string;
    caption?: string;
    url?: string;
    values?: string;
    height?: number | string;
}
export interface EmailDocument {
    template: string;
    name: string;
    subject: string;
    preheader: string;
    accent: string;
    theme: 'dark' | 'light';
    firstName: string;
    projectName: string;
    footer: string;
    blocks: Block[];
}
export type InlineNode =
    | string
    | { tag: 'strong' | 'em' | 'u' | 's'; children: InlineNode[] };
export interface Attachment {
    filename: string;
    content: string;
}
export interface ComposeInput {
    document: EmailDocument;
    recipient: string;
    recipientMode?: string;
    replyTo?: string;
    cc?: string[];
    bcc?: string[];
    attachments?: Attachment[];
    transport?: string;
    key?: string;
}
export interface EmailBody {
    to:
        | { address: string; user_id?: never }
        | { user_id: string; address?: never };
    from: { address: string; name: string };
    subject: string;
    html: string;
    text: string;
    reply_to?: { address: string };
    cc?: string[];
    bcc?: string[];
    attachments?: Attachment[];
}
export interface EmailAttempt {
    action: string;
    transport: string;
    http?: number;
    ok: boolean;
    id?: string;
    status?: string;
    errorCodes?: string[];
    error?: string;
    at: string;
}
export interface EmailState {
    key: string;
    body: EmailBody;
    attempts: EmailAttempt[];
}
export interface StudioState {
    domain: string;
    state: EmailState | null;
    assetBase: string;
    sdkVersion: string;
    emailEnabled: boolean;
}
export type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;
export interface Profile {
    sub: string;
    name?: string;
    preferred_username?: string;
}
export interface Tokens {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    token_type?: string;
    expires_in?: number;
    scope?: string;
}
export interface Discovery {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    device_authorization_endpoint: string;
    userinfo_endpoint: string;
    revocation_endpoint?: string;
    [key: string]: unknown;
}
export interface OAuthClient {
    client_id: string;
    id?: string;
    name?: string;
    scopes?: string;
    public?: boolean;
}
export interface DeviceSession {
    phase: string;
    deviceCode?: string;
    userCode: string;
    verificationUri: string;
    verificationUriComplete: string;
    qr: string;
    interval: number;
    expiresAt: number;
    nextPollAt?: number;
    tokens?: Tokens;
    profile?: Profile;
    error?: string | null;
}
export interface McpResult {
    result?: { content?: { type: string; text: string }[] };
    error?: unknown;
    [key: string]: unknown;
}
export interface CimdSession {
    phase: string;
    state?: string;
    verifier?: string;
    nonce?: string;
    challenge: string;
    clientId: string;
    redirectUri: string;
    expiresAt: number;
    authorizationUrl: string;
    tokens?: Tokens;
    profile?: Profile;
    toolResult?: McpResult[];
    error?: string | null;
}
export interface OAuthEvent {
    at: string;
    flow: string;
    message: string;
    [key: string]: unknown;
}
export interface ProviderResponse
    extends Tokens, Profile, Discovery, OAuthClient {
    data: ProviderResponse[];
    errors?: { code: string }[];
    error?: string;
    name: string;
    public: boolean;
    is_satellite?: boolean;
    frontend_api_url: string;
    device_authorization_grant_enabled?: boolean;
    client_id_metadata_documents_advertised?: boolean;
    client_id_metadata_documents_only_allow_pre_registered_clients?: boolean;
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete?: string;
    interval: number;
}
export interface OAuthConfig {
    issuer: string;
    originalAdvertised?: boolean;
    currentAdvertised?: boolean;
    client?: OAuthClient;
}
export interface TemplateResult {
    templates: { name: string; gif: string; credit?: string }[];
    source?: string;
}
export function asError(
    value: unknown
): Error & { code?: string; status?: number; errors?: { code: string }[] } {
    return value instanceof Error ? value : new Error(String(value));
}
