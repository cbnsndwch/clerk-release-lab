import { useEffect, useState } from 'react';

import type { SetupReport } from './setup.ts';
import { asError } from './types.ts';

const docs = 'https://github.com/cbnsndwch/clerk-release-lab/blob/main/docs/';

export function StartHere({ choose }: { choose: (view: string) => void }) {
    const [report, setReport] = useState<SetupReport | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        async function read() {
            try {
                const response = await fetch('/api/setup');
                if (!response.ok) {
                    throw new Error(
                        'Setup status unavailable. Keep pnpm start running, then refresh.'
                    );
                }
                const value = (await response.json()) as SetupReport;
                if (active) {
                    setReport(value);
                    setError('');
                }
            } catch (caught) {
                if (active) {
                    setError(asError(caught).message);
                }
            }
        }
        void read();
        const timer = setInterval(() => {
            void read();
        }, 4000);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, []);
    return (
        <main className="start-here">
            <span className="section-label">
                CLERK RELEASE LAB · START HERE
            </span>
            <h1>See the result. Then connect Clerk.</h1>
            <p className="start-intro">
                Start with a real React Email preview—no account or API key
                needed. Live email and OAuth are optional next steps, using your
                own Clerk instances.
            </p>
            <div className="start-options">
                <article>
                    <span className="section-label">
                        01 · NO ACCOUNT NEEDED
                    </span>
                    <h2>Make an email your own</h2>
                    <p>
                        Edit a template, move a block, switch to mobile preview,
                        and export the exact React Email code.
                    </p>
                    <button className="primary" onClick={() => choose('email')}>
                        Try the email studio
                    </button>
                </article>
                <article>
                    <span className="section-label">
                        02 · DEVELOPMENT CLERK APP
                    </span>
                    <h2>Use your phone to authorize a device</h2>
                    <p>
                        Generate a code, sign in on another device, and watch
                        the original device receive authorization.
                    </p>
                    <button onClick={() => choose('device')}>
                        Explore device login
                    </button>
                </article>
                <article>
                    <span className="section-label">
                        03 · DEVELOPMENT CLERK APP
                    </span>
                    <h2>Connect a client identified by a URL</h2>
                    <p>
                        This page is the MCP client. Approve it in Clerk, then
                        fetch two templates through a protected tool.
                    </p>
                    <button onClick={() => choose('mcp')}>
                        Explore MCP &amp; CIMD
                    </button>
                </article>
            </div>
            <section className="first-success">
                <h2>Your first success in two minutes</h2>
                <ol>
                    <li>
                        Open Email studio and choose{' '}
                        <strong>Project ready</strong>.
                    </li>
                    <li>
                        Click a paragraph, change a sentence, and use the
                        formatting buttons on selected words.
                    </li>
                    <li>
                        Use the arrow controls or drag handle to reorder a
                        block.
                    </li>
                    <li>
                        Choose <strong>Rendered</strong> and the phone preview.
                        This is real React Email HTML.
                    </li>
                    <li>
                        Download the HTML or React Email module. You have a
                        reusable email without configuring Clerk.
                    </li>
                </ol>
                <a
                    href={`${docs}walkthrough.md`}
                    target="_blank"
                    rel="noreferrer"
                >
                    Open the complete walkthrough
                </a>
            </section>
            <section aria-labelledby="setup-title">
                <h2 id="setup-title">
                    Ready to go live? Set up one demo at a time.
                </h2>
                <p>
                    Save secrets only in your ignored <code>.env.local</code>,
                    then restart <code>pnpm start</code>. This checklist reads
                    existing server state; it does not send email, grant access,
                    or change Clerk settings.
                </p>
                {error && <p role="alert">{error}</p>}
                {!report && !error && (
                    <p role="status">Reading setup status…</p>
                )}
                {report?.groups.map(group => (
                    <div className="setup-group" key={group.title}>
                        <h3>{group.title}</h3>
                        {group.checks.map(check => (
                            <article
                                className={`setup-check ${check.status}`}
                                key={check.id}
                            >
                                <span className="setup-badge">
                                    {
                                        {
                                            ready: 'Ready',
                                            todo: 'Next step',
                                            error: 'Needs attention',
                                            confirm: 'Confirm in Clerk'
                                        }[check.status]
                                    }
                                </span>
                                <h4>{check.title}</h4>
                                <p>{check.detail}</p>
                                {check.action && (
                                    <p className="setup-action">
                                        {check.action}
                                    </p>
                                )}
                                {check.href && (
                                    <a
                                        href={check.href}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Instructions and fixes ↗
                                    </a>
                                )}
                            </article>
                        ))}
                    </div>
                ))}
            </section>
            <p className="start-links">
                <a
                    href={`${docs}getting-started.md`}
                    target="_blank"
                    rel="noreferrer"
                >
                    Clerk setup guide
                </a>{' '}
                ·{' '}
                <a
                    href={`${docs}troubleshooting.md`}
                    target="_blank"
                    rel="noreferrer"
                >
                    Troubleshooting
                </a>{' '}
                · Terminal checklist: <code>pnpm doctor</code>
            </p>
        </main>
    );
}
