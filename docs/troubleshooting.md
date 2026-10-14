# Troubleshooting

[Quickstart](../README.md) · [Setup guide](getting-started.md) · [Walkthroughs](walkthrough.md)

Use **Start here** or run `pnpm doctor` in a second terminal. It reads the running server; it does not independently test credentials or change your instance. Missing optional configuration is normal in preview mode.

## Installation and startup

| Symptom                            | Next action                                                                                                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pnpm not found                     | Run `npm install --global pnpm@12.5.1`; open a new terminal and check `pnpm --version`. For permissions problems, use an alternative from [pnpm installation](https://pnpm.io/installation). |
| Engine or TypeScript syntax error  | Check `node --version`: Node 24+ is required. With nvm, use `nvm install` / `nvm use` in the repo.                                                                                           |
| Frozen-lockfile mismatch           | Pull matching `package.json` and `pnpm-lock.yaml`; use the pinned pnpm. Do not generate an npm/yarn lockfile.                                                                                |
| Port already in use                | Stop the old process with Ctrl+C, or change `DEMO_PORT` and `DEMO_ASSET_PORT` in `.env.local`. Open the printed UI port and update your own proxy if the restricted port changed.            |
| Browser/doctor cannot connect      | Keep `pnpm start` running; inspect its terminal error. Open the printed loopback URL. For a remote machine, forward its loopback UI port with SSH; the repo does not create that SSH tunnel. |
| Configuration edits have no effect | Restart `pnpm start`. Shell environment values override `.env.local`, even when empty. Never post secret environment values.                                                                 |

## Send is unavailable or rejected

Preview intentionally cannot send. **Enable live sending** opens setup. Set your own production `CLERK_EMAIL_SECRET_KEY` and restart. Publishable keys and development OAuth keys cannot replace it.

Startup discovers the production domain but does not prove experimental email access or deliverability. Check the provider error codes and confirm feature access and sender-domain configuration. The default sender is `demo@<primary-domain>`; any customization must follow your instance's sending rules.

GIFs need a reachable HTTPS URL. Set up a tunnel/image host or remove image blocks to try sending without images. API acceptance is not proof of delivery: check status and the recipient's inbox/spam folder.

**Retry** reuses the original saved payload and key. **New send** applies your edited draft to a fresh message. Do not change keys merely because a timeout left the first outcome uncertain.

## OAuth setup fails

- Use your development `sk_test_` secret in `CLERK_OAUTH_SECRET_KEY`; set `CLERK_CONFIGURE_OAUTH=true`, then restart.
- For setup 401/403, verify the selected instance and key's validity/access without sharing the key.
- Missing endpoints or legacy OAuth can prevent these flows. Check [Clerk's current implementation](https://clerk.com/docs/guides/configure/auth-strategies/oauth/how-clerk-implements-oauth).
- Inspect an incompatible existing **Example Workshop Hack Night Device Demo** client: it must be public and have device authorization enabled. Setup will not silently replace it.
- Keep the Account Portal enabled or configure a working consent page. A visible sign-in page alone does not prove consent works. [CIMD requirements](https://clerk.com/docs/guides/configure/auth-strategies/oauth/client-id-metadata-documents).

## Device link opens ordinary sign-in

Expected when signed out. Sign in as a **development app user**, then continue to confirmation/consent. Your dashboard account is not automatically an app-user session. QR/complete links pre-fill the code; **Enter code manually** demonstrates typing it.

## Tunnel or callback fails

Confirm `cloudflared --version` works in the same terminal, set `DEMO_TUNNEL=true`, restart, and wait for the public URL. If your network blocks quick tunnels, use an HTTPS reverse proxy to the restricted port.

An HTTPS string is not a reachability test. Try **Check public metadata (optional)** in MCP. Clerk must also reach the document from its network.

Restarting changes quick-tunnel URLs and clears OAuth sessions. Prepare a fresh flow using current links; pre-register the new URL if needed. With a stable proxy, the metadata client ID and callback must exactly match the authorization request.

## CIMD client is blocked

The demo preserves admission policy. If pre-registration is required, start the public URL, copy the metadata URL from **MCP & CIMD**, then use **OAuth applications → Applications → Add application → Pre-register CIMD client** in Clerk. Allow `openid profile` scopes and allow the client, then prepare a fresh connection. No need to loosen admission for unknown clients. [Official guide](https://clerk.com/docs/guides/configure/auth-strategies/oauth/client-id-metadata-documents).

Explicitly blocked clients, missing scopes, unavailable metadata, or legacy OAuth can also prevent connection. The optional metadata probe does not register a client or approve access.

## Approved, but no result appears

Return to the original tab after the callback confirms connection. Device login updates by polling; MCP needs **3 · Fetch rack templates** after connection. After denial, expiry, or a restart, prepare a fresh flow. Resolve state/PKCE failures with a new flow, never by bypassing validation.

## Report a problem

Include OS, Node/pnpm versions, demo step, expected/actual behavior, and sanitized error codes. Omit `.env.local`, `.local/`, message payloads, recipients, keys, tokens, device codes, personalized screenshots, and unsanitized doctor output. Runtime domains and client identifiers can identify your instance; replace them with placeholders.
