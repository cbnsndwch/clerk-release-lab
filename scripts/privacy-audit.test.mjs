import assert from 'node:assert/strict';
import test from 'node:test';

import { inspect } from './privacy-audit.mjs';

test('privacy guard rejects credentials, identifiers and personal artifacts without echoing their values', () => {
    const values = [
        ['credential', 'sk_live_' + 'A'.repeat(32)],
        ['Clerk identifier', 'ins_' + 'B'.repeat(27)],
        ['Clerk instance domain', 'fictional-instance.clerk.' + 'accounts.dev'],
        [
            'temporary tunnel URL',
            'https://synthetic-example.' + 'trycloudflare.com'
        ],
        ['email address', 'someone@' + 'personal.invalid']
    ];
    for (const [issue, value] of values) {
        assert.ok(inspect('sample.js', Buffer.from(value)).includes(issue));
    }
    assert.ok(
        inspect('.env.local', Buffer.from('')).includes(
            'runtime or environment file'
        )
    );
    assert.ok(
        inspect('.local/demo/email.json', Buffer.from('{}')).includes(
            'runtime or environment file'
        )
    );
    assert.ok(
        inspect('screenshot.jpg', Buffer.from('')).includes(
            'unreviewed media or runtime archive'
        )
    );
    assert.deepEqual(
        inspect('.env.example', Buffer.from('CLERK_EMAIL_SECRET_KEY=\n')),
        []
    );
    assert.deepEqual(
        inspect(
            'example.js',
            Buffer.from('you@example.com sk_live_TEST_ONLY user_mock')
        ),
        []
    );
});
