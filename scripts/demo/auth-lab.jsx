import {
  ArrowUpRight,
  Check,
  Code2,
  Copy,
  ExternalLink,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Terminal,
  Unplug,
  Waypoints,
} from "lucide-react";
import { useEffect, useState } from "react";

const csrf = document.querySelector('meta[name="demo-token"]').content;
function stamp(value) {
  return new Date(value).toLocaleTimeString("en-US", {
    hour12: false,
    timeZone: "America/New_York",
  });
}

function wireCode(view, tab, data) {
  const discovery = data?.discovery || {};
  const clientId = data?.client?.client_id || "<PUBLIC_CLIENT_ID>";
  if (view === "device") {
    if (tab === "poll") {
      return `// The device code stays private on the original device.\n// Poll no faster than the server's interval.\nconst response = await fetch(\n  ${JSON.stringify(discovery.token_endpoint || "<TOKEN_ENDPOINT>")}, {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },\n    body: new URLSearchParams({\n      client_id: ${JSON.stringify(clientId)},\n      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',\n      device_code: '<PRIVATE_DEVICE_CODE>',\n    }),\n  },\n);\n// authorization_pending → wait\n// slow_down → add at least 5 seconds\n// access_denied / expired_token → stop\n`;
    }
    if (tab === "discovery") {
      return JSON.stringify(discovery, null, 2);
    }
    return `curl --request POST \\\n  '${discovery.device_authorization_endpoint || "<DEVICE_ENDPOINT>"}' \\\n  --header 'Content-Type: application/x-www-form-urlencoded' \\\n  --data-urlencode 'client_id=${clientId}' \\\n  --data-urlencode 'scope=openid profile'\n\n# Display user_code + verification_uri to the user.\n# Encode verification_uri_complete as a QR code.\n# Keep device_code on the device. No client secret.\n`;
  }
  if (tab === "pkce") {
    return `import { randomBytes, createHash } from 'node:crypto';\n\nconst verifier = randomBytes(32).toString('base64url');\nconst state = randomBytes(32).toString('base64url');\nconst challenge = createHash('sha256')\n  .update(verifier).digest('base64url');\n\nconst authorize = new URL(${JSON.stringify(discovery.authorization_endpoint || "<AUTHORIZE_ENDPOINT>")});\nauthorize.search = new URLSearchParams({\n  response_type: 'code',\n  client_id: ${JSON.stringify(data?.metadata?.client_id || "<HTTPS_METADATA_URL>")},\n  redirect_uri: ${JSON.stringify(data?.metadata?.redirect_uris?.[0] || "<CALLBACK>")},\n  scope: 'openid profile',\n  state,\n  code_challenge: challenge,\n  code_challenge_method: 'S256',\n});\n\n// After consent: validate state and issuer, then POST\n// code + code_verifier + this same client_id/redirect_uri\n// to the discovered token endpoint. No client secret.\n`;
  }
  if (tab === "tool") {
    return `// The demo client performs these against the protected /mcp:\n// 1. initialize\n// 2. tools/list\n// 3. tools/call\n\nawait fetch(${JSON.stringify(data?.protectedResource?.resource || "<PUBLIC_MCP_ENDPOINT>")}, {\n  method: 'POST',\n  headers: {\n    Authorization: 'Bearer <SERVER_HELD_ACCESS_TOKEN>',\n    'Content-Type': 'application/json',\n    Accept: 'application/json, text/event-stream',\n  },\n  body: JSON.stringify({\n    jsonrpc: '2.0', id: 3, method: 'tools/call',\n    params: { name: 'list_project_templates', arguments: {} },\n  }),\n});\n\n// No token: 401 + WWW-Authenticate resource metadata.\n// This is a minimal demo MCP server, separate from\n// Example Workshop's production /mcp and private projects.\n`;
  }
  if (tab === "discovery") {
    return JSON.stringify(data?.protectedResource || {}, null, 2);
  }
  return JSON.stringify(data?.metadata || { status: "Metadata URL is starting…" }, null, 2);
}

export function AuthLab({ view }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("request");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const isDevice = view === "device";
  const session = isDevice ? data?.device : data?.cimd;
  const connected = isDevice ? session?.phase === "authorized" : session?.phase === "connected";
  useEffect(() => {
    let active = true;
    async function read() {
      try {
        const response = await fetch("/api/auth/state");
        const value = await response.json();
        if (!response.ok) {
          throw new Error(value.error || "OAuth labs unavailable.");
        }
        if (active) {
          setData(value);
          setNow(Date.now());
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      }
    }
    read();
    const interval = setInterval(read, 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);
  async function act(action) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Demo-Token": csrf },
        body: "{}",
      });
      const value = await response.json();
      if (!response.ok) {
        throw new Error(value.error || "OAuth request failed.");
      }
      setData(value);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const events = (data?.events || []).filter(
    (event) =>
      event.flow === "setup" ||
      (isDevice ? event.flow === "device" : ["cimd", "mcp"].includes(event.flow)),
  );
  const tabs = isDevice
    ? [
        ["request", "Device request"],
        ["poll", "Polling"],
        ["discovery", "Discovery"],
      ]
    : [
        ["request", "Client metadata"],
        ["pkce", "PKCE flow"],
        ["tool", "MCP request"],
        ["discovery", "Resource metadata"],
      ];
  const safeTab = tabs.some(([id]) => id === tab) ? tab : "request";
  const code = wireCode(view, safeTab, data);
  const remaining = Math.max(0, Math.ceil(((session?.expiresAt || now) - now) / 1000));
  let result = null;
  try {
    result = JSON.parse(data?.cimd?.toolResult?.at(-1)?.result?.content?.[0]?.text || "null");
  } catch {
    /* The raw result remains inspectable below. */
  }

  return (
    <div className="auth-lab">
      <header className="lab-header">
        <div className="lab-brand">
          <span>▥</span>
          <strong>
            EXAMPLE WORKSHOP<small>IDENTITY LAB</small>
          </strong>
        </div>
        <div className="lab-heading">
          <h1>{isDevice ? "A phone is your keyboard." : "A URL is your client ID."}</h1>
          <p>
            {isDevice
              ? "Authorize a rack controller without typing credentials on the device."
              : "Connect a public MCP client with HTTPS metadata, PKCE, and consent."}
          </p>
        </div>
        <span className="development-badge">
          <ShieldCheck size={13} />
          Development instance
        </span>
      </header>
      <main className="lab-layout">
        <section className="lab-experience">
          <div className="lab-section-title">
            <span>{isDevice ? "03 / DEVICE AUTHORIZATION" : "04 / MCP + CLIENT ID METADATA"}</span>
            <span className={`lab-phase ${connected ? "success" : ""}`}>
              {session?.phase || (data?.ready ? "ready" : "starting")}
            </span>
          </div>
          {isDevice ? (
            <>
              <div className="device-terminal">
                <div className="terminal-bar">
                  <div>
                    <i />
                    <i />
                    <i />
                  </div>
                  <span>rack-controller / tty01</span>
                  <Terminal size={13} />
                </div>
                <div className="terminal-body">
                  <span className="terminal-command">$ clerk-release-lab connect --device</span>
                  <p className="terminal-muted">
                    Example Workshop edge controller
                    <br />
                    No browser. No password field. No client secret.
                  </p>
                  {session?.userCode && session.phase === "pending" ? (
                    <>
                      <span className="terminal-label">ENTER THIS CODE ON YOUR PHONE</span>
                      <div className="device-code">{session.userCode}</div>
                      <div className="terminal-wait">
                        <i />
                        Waiting for approval
                        <span>
                          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}{" "}
                          remaining
                        </span>
                      </div>
                      <p className="terminal-muted">
                        Poll interval: {session.interval}s · device_code kept private
                      </p>
                    </>
                  ) : connected ? (
                    <div className="terminal-connected">
                      <Check size={26} />
                      <strong>Controller authorized.</strong>
                      <p>
                        {session.profile?.name ||
                          session.profile?.preferred_username ||
                          session.profile?.sub}
                      </p>
                      <span>Access token received and kept on the server.</span>
                    </div>
                  ) : (
                    <div className="terminal-placeholder">
                      <Monitor size={38} />
                      <p>{session?.error || "Start a fresh login to generate a code."}</p>
                    </div>
                  )}
                </div>
              </div>
              {session?.phase === "pending" && (
                <div className="phone-handoff">
                  <div className="qr-card">
                    <img src={session.qr} alt="Scan to approve the Example Workshop device login" />
                  </div>
                  <div>
                    <span className="section-label">TAKE OUT YOUR PHONE</span>
                    <h2>Sign in. Confirm the code. Approve.</h2>
                    <p>
                      Clerk asks you to sign in first if you are signed out. The QR code pre-fills{" "}
                      <strong>{session.userCode}</strong>; then confirm the code and approve access
                      to Example Workshop.
                    </p>
                    <a href={session.verificationUriComplete} target="_blank" rel="noreferrer">
                      Continue with code filled in <ArrowUpRight size={13} />
                    </a>
                    <p>
                      To demo typing the code yourself, use the manual link below. Sign in to the
                      development Clerk account, then enter <strong>{session.userCode}</strong> on
                      the device verification page.
                    </p>
                    <a href={session.verificationUri} target="_blank" rel="noreferrer">
                      Enter code manually <ArrowUpRight size={13} />
                    </a>
                    <code>{session.verificationUri}</code>
                  </div>
                </div>
              )}
              <div className="lab-primary-actions">
                <button
                  className="primary"
                  disabled={!data?.ready || busy || session?.phase === "starting"}
                  onClick={() => act("device/start")}
                >
                  <Smartphone size={15} />
                  {session ? "Start fresh device login" : "Start device login"}
                </button>
                {session && (
                  <button disabled={busy} onClick={() => act("disconnect")}>
                    <Unplug size={14} />
                    Disconnect labs
                  </button>
                )}
              </div>
              <div className="lab-explainer">
                <h3>What the room should see</h3>
                <ol>
                  <li>The controller gets a private device code and a short public user code.</li>
                  <li>
                    On your phone, sign in to Clerk, enter or confirm the code, and approve access.
                    The QR code and pre-filled link skip manual code entry.
                  </li>
                  <li>
                    The controller polls at Clerk’s interval and receives tokens after approval.
                  </li>
                </ol>
                <p>
                  Denied and expired requests stop. A <code>slow_down</code> response adds five
                  seconds to the polling interval.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="mcp-walkthrough">
                <span className="section-label">YOUR 90-SECOND DEMO · NO EXTRA APP TO INSTALL</span>
                <h2>Let this page connect, then ask Example Workshop for its templates.</h2>
                <p>
                  This page is the MCP client. MCP is the protocol it uses to discover and call
                  Example Workshop tools. CIMD (Client ID Metadata Document) lets Clerk identify
                  this client by a public HTTPS document instead of a pre-registered client ID.
                </p>
                <ol>
                  <li className={session ? "complete" : "current"}>
                    <strong>Prepare the connection</strong>
                    <span>
                      Click step 1 below. The demo creates an authorization link with the metadata
                      URL as its client ID and a fresh PKCE challenge.
                    </span>
                  </li>
                  <li
                    className={
                      connected ? "complete" : session?.phase === "pending" ? "current" : ""
                    }
                  >
                    <strong>Sign in and approve in the new tab</strong>
                    <span>
                      Click step 2. Use the same development account as the device demo. Approve
                      Example Workshop MCP Client, then return here when the callback says
                      connected.
                    </span>
                  </li>
                  <li className={result ? "complete" : connected ? "current" : ""}>
                    <strong>Fetch the rack templates</strong>
                    <span>
                      Click step 3. The client discovers the tools and calls list_project_templates.
                      Starter Rack and Compute Shelf GIF cards appear below.
                    </span>
                  </li>
                </ol>
                <p className="presenter-line">
                  Say: “The client ID is a URL. Clerk resolves its metadata and asks for consent.
                  Now this authorized client can discover and call a Example Workshop tool through
                  MCP.”
                </p>
                <strong className="mcp-next" role="status">
                  {result
                    ? "Done — the GIF cards below are the live MCP tool result."
                    : connected
                      ? "Next: click 3 · Fetch rack templates."
                      : session?.phase === "pending"
                        ? "Next: click 2 · Sign in and approve, then return to this tab."
                        : session?.phase === "exchanging"
                          ? "Clerk approval received — exchanging the authorization code…"
                          : "Next: click 1 · Prepare connection below."}
                </strong>
                <div className="lab-primary-actions guided-actions">
                  {connected ? (
                    <button className="primary" disabled={busy} onClick={() => act("cimd/tool")}>
                      <Code2 size={15} />{" "}
                      {result ? "Fetch templates again" : "3 · Fetch rack templates"}
                    </button>
                  ) : session?.phase === "pending" && remaining > 0 ? (
                    <a
                      className="consent-link"
                      href={session.authorizationUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      2 · Sign in and approve <ArrowUpRight size={15} />
                    </a>
                  ) : (
                    <button
                      className="primary"
                      disabled={!data?.ready || busy || session?.phase === "exchanging"}
                      onClick={() => act("cimd/start")}
                    >
                      <Waypoints size={15} /> 1 · Prepare connection
                    </button>
                  )}
                </div>
                {session?.error && (
                  <p role="alert">Connection failed: {session.error}. Start again with step 1.</p>
                )}
              </div>
              <div className="client-identity-card">
                <div className="identity-icon">
                  <Waypoints size={28} />
                </div>
                <span className="section-label">PUBLIC CLIENT IDENTITY</span>
                <h2>Example Workshop MCP Client</h2>
                <p>
                  No pre-issued client ID. No client secret. Its identity is the metadata document’s
                  HTTPS URL.
                </p>
                <a
                  className="metadata-url"
                  href={data?.metadata?.client_id || undefined}
                  target="_blank"
                  rel="noreferrer"
                >
                  {data?.metadata?.client_id || "Waiting for the public metadata URL…"}
                  <ExternalLink size={13} />
                </a>
                <div className="identity-facts">
                  <span>
                    <Check size={12} />
                    S256 PKCE
                  </span>
                  <span>
                    <Check size={12} />
                    Exact redirect URI
                  </span>
                  <span>
                    <Check size={12} />
                    Explicit consent
                  </span>
                </div>
              </div>
              <div className="lab-primary-actions">
                <button disabled={!data?.ready || busy} onClick={() => act("cimd/probe")}>
                  <RefreshCw size={14} />
                  Check public metadata (optional)
                </button>
                <button
                  className="primary"
                  disabled={!data?.ready || busy}
                  onClick={() => act("cimd/start")}
                >
                  <Waypoints size={15} />1 · Prepare connection
                </button>
              </div>
              {session?.phase === "pending" && (
                <div className="consent-handoff">
                  <span className="section-label">READY FOR CONSENT</span>
                  <h3>Step 2 · Approve this client in Clerk.</h3>
                  <p>
                    The next page asks you to sign in and approve <code>openid profile</code>. The
                    PKCE verifier stays on this server. After approval, return to this tab; it
                    automatically updates to “Client connected.” This link expires in {remaining}s.
                    If it expires or you deny access, prepare a new connection.
                  </p>
                  <a
                    className="consent-link"
                    href={session.authorizationUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    2 · Sign in and approve <ArrowUpRight size={15} />
                  </a>
                </div>
              )}
              {connected && (
                <div className="connected-card">
                  <div>
                    <Check size={19} />
                    <strong>Client connected.</strong>
                    <span>
                      {session.profile?.name ||
                        session.profile?.preferred_username ||
                        session.profile?.sub}
                    </span>
                  </div>
                  <p>
                    Step 3 · Ask Example Workshop for its public templates using your approved
                    access.
                  </p>
                  <button className="primary" disabled={busy} onClick={() => act("cimd/tool")}>
                    <Code2 size={15} />3 · Fetch rack templates
                  </button>
                  <button disabled={busy} onClick={() => act("disconnect")}>
                    <Unplug size={14} />
                    Disconnect labs / reset for another run
                  </button>
                </div>
              )}
              {result && (
                <p className="mcp-result-note">
                  Success: these cards came from <code>list_project_templates</code> over the
                  protected MCP endpoint. See “MCP request”, “Live trace”, and “Full MCP responses”
                  on the right to show the protocol. You can run step 3 again.
                </p>
              )}
              {result && (
                <div className="mcp-projects">
                  {result.templates?.map((project) => (
                    <article key={project.name}>
                      <img src={project.gif} alt={`${project.name} in Example Workshop`} />
                      <strong>{project.name}</strong>
                      {project.credit && <small>{project.credit}</small>}
                    </article>
                  ))}
                </div>
              )}
              <div className="lab-explainer">
                <h3>What this proves</h3>
                <ol>
                  <li>
                    Clerk fetches the HTTPS document and checks the client identity and redirect
                    URI.
                  </li>
                  <li>Consent + PKCE exchange the authorization code without a client secret.</li>
                  <li>
                    The client initializes MCP, discovers tools, and calls a protected read-only
                    tool.
                  </li>
                </ol>
                <p>
                  This is an isolated demo MCP server using public catalogue template previews.
                  Example Workshop’s production MCP endpoint and private projects are separate.
                </p>
              </div>
            </>
          )}
          <div className="lab-instance">
            <ShieldCheck size={14} />
            <div>
              <strong>{data?.issuer || "Discovering development instance…"}</strong>
              <span>
                Requested: openid profile · Clerk also issues offline_access refresh tokens.
                Production OAuth settings unchanged.
              </span>
            </div>
          </div>
        </section>
        <aside className="lab-inspector">
          <div className="code-heading">
            <div>
              <Code2 size={16} />
              <strong>Protocol, in the open</strong>
            </div>
            <span className="small-badge">LIVE</span>
          </div>
          <div className="lab-code-tabs">
            {tabs.map(([id, name]) => (
              <button
                key={id}
                className={safeTab === id ? "selected" : ""}
                onClick={() => setTab(id)}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="lab-code-top">
            <span>
              {isDevice
                ? safeTab === "discovery"
                  ? "OPENID CONFIGURATION"
                  : safeTab === "poll"
                    ? "POST /oauth/token"
                    : "POST /oauth/device_authorization"
                : safeTab === "request"
                  ? "PUBLIC HTTPS JSON"
                  : safeTab === "pkce"
                    ? "AUTHORIZATION CODE + S256"
                    : safeTab === "tool"
                      ? "JSON-RPC / MCP"
                      : "RFC 9728 RESOURCE METADATA"}
            </span>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1400);
                } catch {
                  setError("Clipboard unavailable; select the code to copy it.");
                }
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="auth-code">
            <code>{code}</code>
          </pre>
          <div className="lab-event-heading">
            <span className="section-label">LIVE TRACE</span>
            <small>
              {!isDevice
                ? `${data?.metadataFetches || 0} metadata fetches`
                : "Server polls Clerk; this page observes status"}
            </small>
          </div>
          <div className="lab-events">
            {events.length ? (
              events.map((event, index) => (
                <div className="lab-event" key={`${event.at}-${index}`}>
                  <span className="mono">{stamp(event.at)}</span>
                  <i />
                  <div>
                    <strong>{event.message}</strong>
                    {Object.keys(event).filter((key) => !["at", "flow", "message"].includes(key))
                      .length > 0 && (
                      <pre>
                        {JSON.stringify(
                          Object.fromEntries(
                            Object.entries(event).filter(
                              ([key]) => !["at", "flow", "message"].includes(key),
                            ),
                          ),
                          null,
                          2,
                        )}
                      </pre>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="help">Start a flow to see real requests and responses here.</p>
            )}
          </div>
          {session?.tokenSummary && (
            <details className="lab-token-summary" open>
              <summary>Token response · credentials redacted</summary>
              <pre>{JSON.stringify(session.tokenSummary, null, 2)}</pre>
            </details>
          )}
          {session?.toolResult && (
            <details className="lab-token-summary">
              <summary>Full MCP responses</summary>
              <pre>{JSON.stringify(session.toolResult, null, 2)}</pre>
            </details>
          )}
        </aside>
      </main>
      <footer
        className={`lab-status ${error || data?.setupError || session?.error ? "error" : ""}`}
        role="status"
      >
        <span className="dot" />
        {error ||
          data?.setupError ||
          session?.error ||
          (busy
            ? "Calling Clerk…"
            : connected
              ? "Authorization completed. Tokens remain on the server."
              : data?.ready
                ? session?.phase === "pending"
                  ? isDevice
                    ? "Waiting for phone approval…"
                    : "Open Clerk consent to finish connecting."
                  : "Ready. Start a fresh flow when presenting."
                : "Preparing the development OAuth labs…")}
        <a
          href={
            isDevice
              ? "https://clerk.com/docs/guides/configure/auth-strategies/oauth/device-authorization-grant"
              : "https://clerk.com/docs/guides/configure/auth-strategies/oauth/client-id-metadata-documents"
          }
          target="_blank"
          rel="noreferrer"
        >
          Clerk docs <ExternalLink size={11} />
        </a>
      </footer>
    </div>
  );
}
