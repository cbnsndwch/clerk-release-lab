import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

import type { SetupReport } from './demo/setup.ts';
import { asError } from './demo/types.ts';

// Read-only client of the running local demo. Never prints credentials or user identity.
let local: NodeJS.Dict<string> = {};
try {
    local = parseEnv(await readFile('.env.local', 'utf8'));
} catch (caught) {
    if (asError(caught).code !== 'ENOENT') {
        throw caught;
    }
}
const port = Number(process.env.DEMO_PORT ?? local.DEMO_PORT ?? 4318);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DEMO_PORT must be a port number from 1 to 65535.');
}
try {
    const response = await fetch(`http://127.0.0.1:${port}/api/setup`, {
        signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
        throw new Error(
            'Setup endpoint unavailable. Update the repo and restart pnpm start.'
        );
    }
    const report = (await response.json()) as SetupReport;
    console.log(`Clerk Release Lab · ${report.mode} mode`);
    console.log(
        'Optional live setup is not required to explore the email composer.'
    );
    for (const group of report.groups) {
        console.log(`\n${group.title}`);
        for (const check of group.checks) {
            console.log(
                `  [${check.status.toUpperCase()}] ${check.title}: ${check.detail}`
            );
            if (check.action) {
                console.log(`    ${check.action}`);
            }
            if (check.href) {
                console.log(`    ${check.href}`);
            }
        }
    }
    if (
        report.groups.some(group =>
            group.checks.some(check => check.status === 'error')
        )
    ) {
        process.exitCode = 1;
    }
} catch {
    console.error(
        'Cannot read the local demo. Run pnpm start in another terminal, wait for the local URL, then run pnpm doctor again.'
    );
    process.exitCode = 1;
}
