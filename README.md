# Clerk Release Lab

A standalone community demo of transactional email, device authorization, and an MCP client authenticated with Client ID Metadata Documents (CIMD). The fictional **Example Workshop** brand, projects, and synthetic GIFs are sample content. This is an independent example, not an official Clerk product.

## Try the composer without credentials

Install Node.js 24 or newer and pnpm 12.5.1 (pinned in `packageManager`), then:

```sh
pnpm install --frozen-lockfile
pnpm start
```

Open <http://127.0.0.1:4318>. Preview mode makes no Clerk API requests, creates no tunnel, and cannot send email. It includes three templates, drag-and-drop blocks, selected-text formatting, paragraph alignment, undo/redo, personalization, responsive previews, and HTML, text, React Email source, and JSON exports. Formatting buttons insert editable markers: `**bold**`, `*italic*`, `__underline__`, and `~~strike~~`.

The code panel shows the native JavaScript backend SDK plus framework examples and direct HTTP examples in multiple languages. Examples whose SDK does not expose the experimental email endpoint are explicitly marked as HTTP fallbacks. Browser SDKs never receive a secret key.

## Enable live email with your own instance

Copy `.env.example` to `.env.local` and set `CLERK_EMAIL_SECRET_KEY` to your own production secret key. Your instance needs transactional email access and a configured sender domain. The server discovers the primary domain and uses `demo@<your-domain>` as the sender; change the sender in `scripts/demo/email.mjs` if your setup requires a different local part.

For GIFs to display in delivered email, set `DEMO_TUNNEL=true` and install [cloudflared](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/), or set `DEMO_PUBLIC_BASE_URL` to an HTTPS proxy pointing at port 4319. Alternatively host the two sample GIFs yourself and set `DEMO_ASSET_BASE_URL` to that directory. Sending image blocks is blocked until an HTTPS asset URL is available.

Restart `pnpm start`, open the composer, and deliberately click **Send test** with a recipient you control. Retry reuses the frozen message and idempotency key; the conflict control changes the payload while reusing the key. No email is sent on startup or by the test suite. The API and limits shown here reflect the October 2026 experimental release; confirm availability in [Clerk's documentation](https://clerk.com/docs) for your instance.

## Enable the OAuth labs

Use a separate **development** Clerk instance. Set:

```dotenv
CLERK_OAUTH_SECRET_KEY=
CLERK_CONFIGURE_OAUTH=true
DEMO_TUNNEL=true
```

Fill the empty key with your own development secret. Production OAuth keys are rejected. On startup this opt-in:

- Creates or reuses `Example Workshop Hack Night Device Demo`, a public OAuth application with the device grant and `offline_access openid profile` scopes.
- Enables `client_id_metadata_documents_advertised` in that development instance.
- Saves the previous advertising value and demo client identifiers in ignored `.local/demo/oauth-config.json`.
- Refuses to broaden a setting that requires pre-registered CIMD clients. If that setting is enabled, register your metadata URL yourself before proceeding.

These settings are not automatically undone when the demo stops. After testing, delete the demo OAuth client and restore the previous CIMD advertising value using the Clerk Dashboard or Backend API. **Disconnect labs** clears local sessions and attempts token revocation; it does not delete the client or restore instance settings.

The optional tunnel exposes only synthetic GIFs, public client/resource metadata, the OAuth callback, and a protected, read-only demo `/mcp`. Keep the composer/API port 4318 on loopback; never expose that port publicly. Temporary tunnel URLs change after a restart, so start a fresh OAuth flow each time. A stable HTTPS reverse proxy to port 4319 is also supported through `DEMO_PUBLIC_BASE_URL`.

### Device login

1. Open **Device login**, then click **Start device login**.
2. Scan the QR code or open the verification link. Sign in to your development account first, then confirm the pre-filled code. The manual link lets you type it yourself.
3. Approve access. The original page polls at Clerk's interval and reports the authorized identity. Tokens and the private device code stay on the server.

### MCP & CIMD

This page is already the MCP client; no external client installation is needed.

1. Click **Prepare connection**. The public metadata document's HTTPS URL becomes the client ID; the server generates fresh state and PKCE values.
2. Click **Sign in and approve**. Complete Clerk consent in the new tab, then return to this page after the callback confirms connection.
3. Click **Fetch rack templates**. The client runs MCP initialization, tool discovery, and `list_project_templates`. The two animated cards are the tool result.

Show the metadata URL, code panel, live trace, and full MCP responses while explaining: “A URL identifies this client. Clerk checks its metadata and asks for consent. The authorized client can now discover and call a tool through MCP.” The server is intentionally a minimal teaching example with fictional catalogue data, not a production MCP deployment.

References: [Device Authorization Grant](https://clerk.com/docs/guides/configure/auth-strategies/oauth/device-authorization-grant), [Client ID Metadata Documents](https://clerk.com/docs/guides/configure/auth-strategies/oauth/client-id-metadata-documents).

## Development and privacy

Tooling uses pnpm 12.5.1, Node 24+, and Oxc (`oxlint` and `oxfmt`).
`.nvmrc`, EditorConfig, and explicit Oxc configs keep local editing and CI
consistent. CI installs from the frozen pnpm lockfile and cancels superseded runs.

```sh
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
pnpm test
pnpm gate
```

`pnpm gate` (also available as `pnpm check`) runs formatting, linting, the build
and Node test suite, and the privacy audit. Stage new source files before running
the privacy audit so it can inspect the intended Git contents.

Tests use synthetic provider responses; they do not send email or approve live OAuth requests. The privacy check inspects staged and tracked files, tracked working copies, and all reachable Git commit blobs for common credentials, real-looking Clerk identifiers, instance domains, temporary tunnel URLs, forbidden runtime files, and image metadata. It is a guardrail, not a proof that arbitrary personal content is safe to publish.

Keep `.env.local`, `.local/`, downloads, personal screenshots, original footage, and runtime state out of Git. Email state contains recipients and attachment contents. Browser drafts remain in localStorage. OAuth tokens remain in memory; configuration identifiers are stored only under `.local/`. Runtime instance IDs displayed by the UI are loaded from the viewer's own configured instance, not bundled into this repository.

Only an allowlisted source extraction and generated sample assets are included; no parent application history, captured demo screenshots, messages, or runtime state are part of this repository. The synthetic GIFs can be regenerated with `python scripts/generate-assets.py` after installing Pillow; Python is not needed to run the app. Code and synthetic assets are MIT licensed.
