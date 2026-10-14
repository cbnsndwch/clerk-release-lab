import type { AuthDemo } from './auth.ts';

export type CheckStatus = 'ready' | 'todo' | 'error' | 'confirm';
export interface SetupCheck {
    id: string;
    title: string;
    status: CheckStatus;
    detail: string;
    action?: string;
    href?: string;
}
export interface SetupReport {
    mode: 'preview' | 'live';
    groups: { title: string; checks: SetupCheck[] }[];
}
interface SetupContext {
    secretKey: string;
    assetBase: string;
    publicBase: string;
    auth?: Pick<
        AuthDemo,
        'ready' | 'setupError' | 'secretKey' | 'cimdAdmission' | 'cimd'
    >;
}
const guide = 'https://github.com/cbnsndwch/clerk-release-lab/blob/main/docs/';

// Reads existing server state only. It never creates clients, sends mail or probes credentials.
export function setupReport(context: SetupContext): SetupReport {
    const email = Boolean(context.secretKey);
    const images = context.assetBase.startsWith('https://');
    const publicUrl = context.publicBase.startsWith('https://');
    const development = Boolean(context.auth?.secretKey.startsWith('sk_test_'));
    const oauth = Boolean(context.auth?.ready);
    const restricted = context.auth?.cimdAdmission === 'pre-registered';
    return {
        mode: email ? 'live' : 'preview',
        groups: [
            {
                title: 'Explore now · no account needed',
                checks: [
                    {
                        id: 'preview',
                        title: 'Email composer',
                        status: 'ready',
                        detail: 'Edit a template, preview the result, and export its React Email code. No email is sent.',
                        action: 'Follow the two-minute tour',
                        href: `${guide}walkthrough.md#two-minute-email-tour-no-account`
                    }
                ]
            },
            {
                title: 'Optional · send a real email',
                checks: [
                    {
                        id: 'email-key',
                        title: 'Production email key',
                        status: email ? 'ready' : 'todo',
                        detail: email
                            ? 'A production key and sender domain are configured. Sending is available.'
                            : 'Sending is intentionally disabled in preview mode.',
                        action: email
                            ? 'Email feature access is checked by Clerk when you send; startup does not prove delivery.'
                            : 'Put your own production secret in CLERK_EMAIL_SECRET_KEY in .env.local, then restart pnpm start.',
                        href: `${guide}getting-started.md#enable-live-email`
                    },
                    {
                        id: 'email-images',
                        title: 'GIFs in delivered email',
                        status: images ? 'ready' : 'todo',
                        detail: images
                            ? 'An HTTPS asset URL is configured. The recipient’s email client must be able to reach it.'
                            : 'Local GIFs work in preview. Delivered email needs publicly reachable HTTPS images.',
                        action: images
                            ? 'Confirm the public URL still opens before sending.'
                            : 'Install cloudflared and set DEMO_TUNNEL=true, or configure your own HTTPS asset directory. Restart after editing .env.local.',
                        href: `${guide}getting-started.md#public-urls-and-tunnels`
                    }
                ]
            },
            {
                title: 'Optional · device login and MCP',
                checks: [
                    {
                        id: 'oauth-key',
                        title: 'Development OAuth key',
                        status: development
                            ? 'ready'
                            : context.auth?.secretKey
                              ? 'error'
                              : 'todo',
                        detail: development
                            ? 'A development key is configured for these labs.'
                            : 'OAuth uses a development instance, separate from production email.',
                        action: development
                            ? undefined
                            : 'Set CLERK_OAUTH_SECRET_KEY to your own development secret. Publishable keys and production keys cannot be used here.',
                        href: `${guide}getting-started.md#enable-device-login-and-mcp`
                    },
                    {
                        id: 'oauth-setup',
                        title: 'OAuth endpoints and demo client',
                        status: oauth
                            ? 'ready'
                            : context.auth?.setupError && development
                              ? 'error'
                              : 'todo',
                        detail: oauth
                            ? 'Discovery and development client setup completed.'
                            : context.auth?.setupError ||
                              'OAuth has not been configured.',
                        action: oauth
                            ? undefined
                            : 'Set CLERK_CONFIGURE_OAUTH=true to opt in to development client creation and CIMD advertising, then restart. If setup fails, use the troubleshooting guide.',
                        href: `${guide}troubleshooting.md#oauth-setup-fails`
                    },
                    {
                        id: 'oauth-public',
                        title: 'Public metadata and callback',
                        status: publicUrl ? 'ready' : 'todo',
                        detail: publicUrl
                            ? 'An HTTPS public URL is configured. Reachability is confirmed during the live flow, not by this checklist.'
                            : 'Clerk must fetch metadata and return to a reachable HTTPS callback.',
                        action: publicUrl
                            ? 'A server restart may change a temporary tunnel URL. Always start a fresh flow afterwards.'
                            : 'Install cloudflared, set DEMO_TUNNEL=true, and restart; or point DEMO_PUBLIC_BASE_URL at your HTTPS proxy to port 4319.',
                        href: `${guide}getting-started.md#public-urls-and-tunnels`
                    },
                    {
                        id: 'oauth-consent',
                        title: 'Consent page and app user',
                        status:
                            context.auth?.cimd?.phase === 'connected'
                                ? 'ready'
                                : 'confirm',
                        detail: 'Use the current Clerk OAuth implementation and enable the Account Portal or configure a consent page. Sign in as a user of your development app, not with your dashboard account by assumption.',
                        action: 'Create or sign up a development app user and confirm they can sign in. This checklist cannot verify their browser session.',
                        href: `${guide}getting-started.md#clerk-account-versus-app-user`
                    },
                    {
                        id: 'oauth-admission',
                        title: 'CIMD client admission',
                        status: restricted
                            ? context.auth?.cimd?.phase === 'connected'
                                ? 'ready'
                                : 'confirm'
                            : oauth
                              ? 'ready'
                              : 'todo',
                        detail: restricted
                            ? 'Your instance requires a pre-registered client. The demo preserves that policy.'
                            : 'The demo preserves your instance’s client admission policy.',
                        action: restricted
                            ? 'With the tunnel running, pre-register the current metadata URL from the MCP page in Clerk, allow openid profile scopes, and allow the client. Then prepare a fresh connection.'
                            : undefined,
                        href: `${guide}troubleshooting.md#cimd-client-is-blocked`
                    }
                ]
            }
        ]
    };
}
