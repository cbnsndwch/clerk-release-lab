import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rules = [
    [
        'credential',
        /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]{20,}|\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
    ],
    [
        'Clerk identifier',
        /\b(?:ins|oa|user|org|sess|ema|client)_[A-Za-z0-9]{20,}\b/
    ],
    ['Clerk instance domain', /\b[a-z0-9-]+\.(?:clerk\.)?accounts\.dev\b/i],
    ['temporary tunnel URL', /https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i],
    [
        'personal home path',
        /(?:[A-Z]:[\\/]Users[\\/][^\s"'<>]+|\/home\/[^\s/"'<>]+|\/Users\/[^\s/"'<>]+)/i
    ],
    [
        'email address',
        /\b[A-Z0-9._%+-]+@(?![A-Z0-9.-]*\bexample\.(?:com|org|net)\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i
    ]
];

export function inspect(path, bytes) {
    const failures = [];
    if (
        /(?:^|\/)(?:\.local|node_modules|raw_inputs)(?:\/|$)|(?:^|\/)\.env(?:\.|$)/.test(
            path
        ) &&
        path !== '.env.example'
    ) {
        failures.push('runtime or environment file');
    }
    if (/\.(?:jpe?g|png|mp4|mov|zip|log)$/i.test(path)) {
        failures.push('unreviewed media or runtime archive');
    }
    if (/\.gif$/i.test(path)) {
        // Only our generated examples belong in this source extraction.
        if (
            !/^scripts\/demo\/assets\/(starter-rack|compute-shelf)\.gif$/.test(
                path
            )
        ) {
            failures.push('unreviewed GIF');
        }
        if (!bytes.subarray(0, 6).toString().startsWith('GIF8')) {
            failures.push('invalid GIF');
        }
        if (
            bytes.includes(Buffer.from('Exif')) ||
            bytes.includes(Buffer.from('XMP Data'))
        ) {
            failures.push('image metadata');
        }
    }
    const content = bytes.toString('utf8');
    for (const [name, pattern] of rules) {
        if (pattern.test(content)) {
            failures.push(name);
        }
    }
    if (path === '.env.example') {
        for (const line of content.split('\n')) {
            if (/^CLERK_.*SECRET_KEY=.+/.test(line.trim())) {
                failures.push('nonempty example secret');
            }
        }
    }
    return [...new Set(failures)];
}

function git(...args) {
    return execFileSync('git', args, { maxBuffer: 32 * 1024 * 1024 });
}

export function auditRepository() {
    const failures = [];
    let checked = 0;
    function check(label, path, bytes) {
        checked++;
        for (const issue of inspect(path, bytes)) {
            failures.push(`${label}: ${issue}`);
        }
    }
    const files = git('ls-files', '-z').toString().split('\0').filter(Boolean);
    if (!files.length) {
        throw new Error(
            'No tracked files. Stage the intended public source first with git add.'
        );
    }
    for (const path of files) {
        check(`index:${path}`, path, git('show', `:${path}`));
        check(`working:${path}`, path, readFileSync(path));
    }
    // A fresh index has no commits yet. After the first commit inspect all reachable history.
    if (git('rev-list', '--all').length) {
        const objects = git('rev-list', '--objects', '--all')
            .toString()
            .trim()
            .split('\n');
        for (const entry of objects) {
            const space = entry.indexOf(' ');
            if (space < 0) {
                continue;
            }
            const oid = entry.slice(0, space);
            const path = entry.slice(space + 1);
            if (git('cat-file', '-t', oid).toString().trim() !== 'blob') {
                continue;
            }
            check(`history:${path}`, path, git('cat-file', 'blob', oid));
        }
        check(
            'commit metadata',
            'commit-metadata.txt',
            git('log', '--all', '--format=%an <%ae>%n%cn <%ce>%n%B')
        );
    }
    if (failures.length) {
        throw new Error(
            `Privacy audit failed (values redacted):\n${failures.join('\n')}`
        );
    }
    return checked;
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    try {
        console.log(
            `Privacy audit passed: ${auditRepository()} staged, tracked, and historical content checks.`
        );
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
