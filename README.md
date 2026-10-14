# Clerk Release Lab

**See three Clerk features working, inspect the code, and take the patterns into your own app.** Start with a real React Email composer that needs no account or API key; connect your own Clerk instances for the live demos.

| Demo         | What you do                                                     | Success looks like                                           | Needs Clerk?                      |
| ------------ | --------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------- |
| Email studio | Edit a template, reorder blocks, export React Email code        | Your changes in the actual HTML preview and exported email   | No for composing; yes for sending |
| Device login | Sign in on your phone to authorize another device               | The original page shows an authorized user                   | Your development app              |
| MCP & CIMD   | Approve a client identified by a metadata URL, then call a tool | Two project GIF cards returned by the protected MCP endpoint | Your development app              |

Independent teaching example, not an official Clerk product. **Example Workshop**, its projects, and the synthetic GIFs are fictional. Preview renders real HTML; it does not simulate email delivery or OAuth authorization.

## Run locally without an account

You need Git, Node.js **24+**, and pnpm **12.5.1**. Check Node with `node --version`. If pnpm is missing:

```sh
npm install --global pnpm@12.5.1
```

See [Node.js downloads](https://nodejs.org/en/download) or [pnpm installation](https://pnpm.io/installation) if needed. Then:

```sh
git clone https://github.com/cbnsndwch/clerk-release-lab.git
cd clerk-release-lab
pnpm install --frozen-lockfile
pnpm start
```

Keep that terminal running and open **<http://127.0.0.1:4318>**. No `.env.local`, Clerk account, DNS setup, or tunnel is needed. **Start here** explains each demo and shows your setup checklist. Blank configuration cannot send email or change Clerk settings.

## Your first result in two minutes

1. Click **Try the email studio**, then choose **Project ready**.
2. Click a paragraph and change a sentence. Select words and try **B**, **I**, **U**, or **S**; choose an alignment.
3. Drag a block by its handle, or use its arrows to reorder it.
4. Switch to **Rendered** and the phone preview to see the actual generated email.
5. Use the code panel's **HTML** or **React Email** download. You now have a reusable email without configuring Clerk.

**That is a complete first success.** **Enable live sending** opens the setup checklist; sending is optional. Drafts stay in this browser, and **Export draft** saves editable JSON. [Full walkthrough with expected results](docs/walkthrough.md).

## Choose your next step

- **Send a real email:** [Email setup](docs/getting-started.md#enable-live-email) → [send/retry walkthrough](docs/walkthrough.md#send-a-real-email-and-retry-it).
- **Authorize a device:** [OAuth setup](docs/getting-started.md#enable-device-login-and-mcp) → [device walkthrough](docs/walkthrough.md#device-login).
- **Connect MCP using CIMD:** same OAuth setup → [MCP walkthrough](docs/walkthrough.md#mcp--cimd). This page is already the client; no external MCP app is needed.

Configure just one path if you like. **Email uses a production secret; OAuth uses a development secret.** A dashboard account is not automatically a user of your demo app. [Keys, environments, and app users explained](docs/getting-started.md#clerk-account-versus-app-user).

## Stuck?

Open **Start here**, or run this in a second terminal while the server runs:

```sh
pnpm doctor
```

This reads existing state and explains next steps. It never sends email or changes Clerk settings. “Ready” means the stated configuration check passed; browser sign-in, consent, and external reachability must still be confirmed by the live flow. Unconfigured optional demos do not make preview mode fail.

[Troubleshooting](docs/troubleshooting.md) covers pnpm, wrong keys, disabled sending, ports, consent, blocked clients, and expired tunnels. [Walkthroughs](docs/walkthrough.md) explain each button and its result.

## Code and development

Strict TypeScript, Node 24+, pnpm, and Oxc. The server/tests run directly as TypeScript; esbuild bundles the React TSX client. Code panels show native backend SDK/framework examples and explicitly labeled HTTP fallbacks in other languages. Browser SDKs never receive a secret key.

```sh
pnpm gate
```

Runs formatting, type-aware linting, strict typechecking, build, tests using synthetic providers, and the privacy audit. No tests send real email or approve live OAuth access. [Development and privacy](docs/development.md).

Keep secrets in ignored `.env.local`. Recipients and attachment contents stay under ignored `.local/`; OAuth tokens stay in memory. [Configuration changes and cleanup](docs/getting-started.md#what-oauth-setup-changes-and-how-to-clean-up).

Code and synthetic assets are [MIT licensed](LICENSE).
