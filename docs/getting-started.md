# Connect your own Clerk instances

[Quickstart](../README.md) · [Walkthroughs](walkthrough.md) · [Troubleshooting](troubleshooting.md)

Try the credential-free composer first. You can enable just email, just OAuth, or both.

## Clerk account versus app user

Your **dashboard account** administers applications. An **app user** signs into an application you created. They are separate identities; registering with Clerk does not automatically create a user in your application.

1. Open the [Clerk Dashboard](https://dashboard.clerk.com) and create or select your application.
2. Choose **Development** or **Production** before copying keys. Users, keys, and settings belong to that instance. [Clerk environments](https://clerk.com/docs/guides/development/managing-environments).
3. Open **API keys** and copy the **secret key**, not the publishable key. Development secrets begin with `sk_test_`; production secrets begin with `sk_live_`. Keep the value in `.env.local`, never in source or an issue.
4. For OAuth, sign up through your development application's sign-up flow, or create a user under **Users** in the dashboard. Confirm their enabled sign-in method works. Open the development **Account Portal** from the dashboard to test this before starting a timed flow. Creating a user does not automatically verify them or establish a browser session.

CIMD needs Clerk's current OAuth implementation, not legacy OAuth, and a reachable consent flow. Keep the Account Portal enabled or configure a custom consent page. [Official CIMD requirements](https://clerk.com/docs/guides/configure/auth-strategies/oauth/client-id-metadata-documents).

## Create local configuration

Copy `.env.example` to `.env.local` from the repo root, once:

```sh
# macOS / Linux
cp .env.example .env.local
```

```powershell
# PowerShell
Copy-Item .env.example .env.local
```

Do not overwrite a file containing your configuration. Edit it locally, then restart `pnpm start`. Shell environment variables take precedence over the file, including empty values.

| Variable                        | Purpose                                                        |
| ------------------------------- | -------------------------------------------------------------- |
| `CLERK_EMAIL_SECRET_KEY`        | Production secret for live email only                          |
| `CLERK_OAUTH_SECRET_KEY`        | Development secret for device login and MCP                    |
| `CLERK_CONFIGURE_OAUTH`         | Explicit opt-in to development OAuth configuration             |
| `DEMO_TUNNEL`                   | Start an installed cloudflared quick tunnel                    |
| `DEMO_PUBLIC_BASE_URL`          | Your own HTTPS proxy to restricted port 4319                   |
| `DEMO_ASSET_BASE_URL`           | Image-only HTTPS directory; does not provide an OAuth callback |
| `DEMO_PORT` / `DEMO_ASSET_PORT` | UI / restricted service ports; defaults 4318 / 4319            |

## Enable live email

1. Your production instance needs access to the experimental transactional email endpoint and a configured sending domain. A valid production key alone does not prove feature access. Confirm availability for your instance with [Clerk](https://clerk.com/docs).
2. Set `CLERK_EMAIL_SECRET_KEY` to your own production secret.
3. For templates containing GIFs, configure public HTTPS images using the next section. Alternatively remove all image blocks to test sending without image hosting.
4. Restart `pnpm start`. Check **Start here**. The server discovers the primary domain and uses `demo@<your-domain>` as sender. If needed, change the local part in `scripts/demo/email.ts`, keeping your instance's sender requirements.
5. Follow the [send/retry walkthrough](walkthrough.md#send-a-real-email-and-retry-it) with a recipient you control.

Startup sends nothing. API acceptance is not inbox delivery confirmation; check status and the recipient's inbox/spam folder.

## Public URLs and tunnels

Email clients need a public URL to download GIFs. OAuth needs a public URL so Clerk can fetch metadata and the browser can reach the callback. Hosting images alone does not enable OAuth.

[Install cloudflared](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/) and confirm `cloudflared --version` works in the same terminal as Node. Set:

```dotenv
DEMO_TUNNEL=true
```

Restart `pnpm start`, wait for the public URL, and keep the process running. Only the restricted port **4319** is exposed: sample GIFs, metadata, OAuth callback, and the protected read-only MCP endpoint. Do not expose composer/API port **4318**.

Quick-tunnel URLs change after restart. Start fresh flows and use current links. Old emails may lose their GIFs when the tunnel stops; use stable hosting for durable messages.

For your own HTTPS reverse proxy, point it at port 4319, set `DEMO_PUBLIC_BASE_URL` to its origin without a trailing slash, and leave `DEMO_TUNNEL=false`. For image-only hosting, place `starter-rack.gif` and `compute-shelf.gif` in `DEMO_ASSET_BASE_URL`.

## Enable device login and MCP

Fill your own development secret in `.env.local` and opt in:

```dotenv
CLERK_OAUTH_SECRET_KEY=
CLERK_CONFIGURE_OAUTH=true
DEMO_TUNNEL=true
```

The empty secret line is a placeholder to fill locally. Production OAuth keys are rejected. Prepare your consent page and app user as described above, restart, then check **Start here**. The checklist cannot prove a browser session or external reachability; the live flow confirms those.

Choose [Device login](walkthrough.md#device-login) or [MCP & CIMD](walkthrough.md#mcp--cimd). The page is already an MCP client; no other client installation is required.

If your admission policy requires pre-registration, start the tunnel, copy the metadata URL from the MCP page, and follow **OAuth applications → Applications → Add application → Pre-register CIMD client** in Clerk. Allow `openid profile` scopes and allow the client, then prepare a fresh connection. The demo preserves admission policy; Clerk enforces it. [Official instructions](https://clerk.com/docs/guides/configure/auth-strategies/oauth/client-id-metadata-documents).

## What OAuth setup changes and how to clean up

`CLERK_CONFIGURE_OAUTH=true` lets startup create/reuse **Example Workshop Hack Night Device Demo**, a public client with the device grant. The lab requests `openid profile`; Clerk may also include `offline_access`. Startup enables CIMD advertising while preserving admission policy. Advertising can permit unknown compatible clients when that existing policy allows them; a disposable development app is a convenient option.

Ignored `.local/demo/oauth-config.json` records the previous advertising value and demo client identifiers, not secrets. Tokens stay in memory. **Disconnect labs** clears local sessions and attempts revocation; stopping the process does not delete clients or restore settings.

When finished:

1. Disconnect labs while the server is running.
2. Delete the device demo client and any sample CIMD client records you added/allowed in your development instance.
3. Restore advertising to `originalAdvertised` from `.local/demo/oauth-config.json`; restore any other settings you changed yourself.
4. Stop the server. Remove local configuration/state only if no longer needed; email state includes recipients and attachment contents.

Do not include `.env.local`, `.local/`, downloaded messages, or personalized screenshots in issues or contributions.
