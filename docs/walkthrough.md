# Walkthroughs: click, observe, understand

[Quickstart](../README.md) · [Setup guide](getting-started.md) · [Troubleshooting](troubleshooting.md)

## Two-minute email tour: no account

On **Start here**, click **Try the email studio**.

| Action                                           | Expected result                                          | What it proves                                                                  |
| ------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Choose **Project ready**                         | A fictional email with a synthetic animated rack GIF     | A complete starter template                                                     |
| Click a paragraph and change a sentence          | Design and generated preview update                      | Content renders through React Email                                             |
| Select words and click B / I / U / S             | Editable markers in the field; styled words in the email | Formatting survives rendering                                                   |
| Change alignment                                 | Left, center, right, or justified text                   | Layout is part of the document                                                  |
| Use the drag handle or arrows                    | The block moves; Undo restores it                        | Composition beyond a fixed template                                             |
| Choose **Rendered**, then the phone icon         | Actual HTML at a smaller preview width                   | The preview uses generated HTML, not a guarantee of every email client's layout |
| Download HTML or React Email from the code panel | Rendered HTML or a self-contained module                 | A reusable result for another app                                               |

Formatting syntax is `**bold**`, `*italic*`, `__underline__`, and `~~strike~~`. Personalization supports `{{firstName}}` and `{{projectName}}`. Try **Shared build** or **Parts ready**, then **Export draft** to save editable JSON. Your draft also stays in this browser.

**Success:** you edited, previewed, and exported a real email. You can stop here. **Enable live sending** opens setup; it does not send a message.

## Send a real email and retry it

Complete [email setup](getting-started.md#enable-live-email) first.

1. Finish your draft and inspect **Rendered**. Click **Send test**, enter a recipient you control, and review the sender. Choose direct API or native backend SDK transport; CC/BCC, reply-to, and attachments are optional.
2. Click **Send test email** once. Look for an email ID and status in the response log, then check the recipient's inbox/spam folder. Provider errors may indicate missing feature access or domain setup.
3. Click **Retry**. It reuses the saved payload and key even if you edited the draft afterwards. This demonstrates safe retries, not a request for a new message.
4. Optionally use the conflict control: it changes the frozen subject with the same key to demonstrate a conflicting request.
5. Use **New send** when you intentionally want your current draft to become a new message with a fresh key.

**Success:** Clerk accepted a message and you can inspect its status. Confirm delivery separately. Nothing sends at startup, during preview, or in the test suite.

## Device login

Complete [OAuth setup](getting-started.md#enable-device-login-and-mcp) and confirm your development app user can sign in.

1. Open **Device login** → **Start device login**. The original page represents a device or CLI without a convenient credential input.
2. Scan the QR code on your phone or open the pre-filled link in another tab. Ordinary Clerk sign-in appears first if signed out. Use your **development app user**.
3. Confirm the code and approve the application. Use **Enter code manually** to demonstrate typing; QR/pre-filled links skip that step.
4. Return to the original page. It should show the authorized identity and redacted token summary. Private device codes and tokens remain on the server.

**Success:** approval on one device lets the original device obtain tokens without you entering a password there. The trace shows polling. Denial/expiry stops polling; **Start fresh device login** generates a new code.

## MCP & CIMD

MCP is the protocol used to discover and call a tool. CIMD means **Client ID Metadata Document**: the client's identity is the HTTPS URL of a JSON document. PKCE binds the later exchange to the client that started authorization. You do not need to implement them to try the demo.

Complete [OAuth setup](getting-started.md#enable-device-login-and-mcp). **This page is already the MCP client.**

1. Open **MCP & CIMD** → **1 · Prepare connection**. Inspect the metadata URL, which serves the client name and allowed callback. The authorization request uses that URL as its client ID.
2. Click **2 · Sign in and approve**. Use your development app user and approve **Example Workshop Hack Night MCP Client**. Return to the original tab when the callback reports connection.
3. Click **3 · Fetch rack templates**. The server-held token authenticates MCP initialization, tool discovery, and `list_project_templates`.
4. Look for **Starter Rack** and **Compute Shelf** GIF cards. Show **MCP request**, **Live trace**, and **Full MCP responses** to connect the result to the protocol.

**Success:** a client identified by a URL received consent and called a protected tool. The tool returns fictional templates, not private projects. This is a minimal teaching client/server, not a complete external MCP application.

Present it as: “The client ID is a URL. Clerk checks its metadata and asks for consent. Now the authorized client discovers and calls a tool through MCP.” Disconnect labs before another rehearsal; see the setup guide for removing development configuration afterwards.
