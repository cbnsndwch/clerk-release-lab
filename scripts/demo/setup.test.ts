import assert from 'node:assert/strict';
import test from 'node:test';

import { setupReport } from './setup.ts';

void test('setup keeps credential-free preview useful and does not claim live readiness', () => {
    const report = setupReport({
        secretKey: '',
        assetBase: 'http://127.0.0.1:4318/assets',
        publicBase: ''
    });
    const checks = report.groups.flatMap(group => group.checks);
    assert.equal(report.mode, 'preview');
    assert.equal(checks.find(check => check.id === 'preview')?.status, 'ready');
    assert.equal(
        checks.find(check => check.id === 'email-key')?.status,
        'todo'
    );
    assert.equal(
        checks.find(check => check.id === 'email-images')?.status,
        'todo'
    );
    assert.equal(
        checks.find(check => check.id === 'oauth-consent')?.status,
        'confirm'
    );
    assert.ok(!checks.some(check => check.status === 'error'));
});

void test('setup exposes actionable restrictions without exposing keys or assuming consent', () => {
    const auth = Object.freeze({
        ready: true,
        setupError: null,
        secretKey: 'sk_test_NOT_REAL',
        cimdAdmission: 'pre-registered' as const,
        cimd: null
    });
    const context = Object.freeze({
        secretKey: 'sk_live_NOT_REAL',
        assetBase: 'https://assets.example.com',
        publicBase: 'https://client.example.com',
        auth
    });
    const report = setupReport(context);
    const checks = report.groups.flatMap(group => group.checks);
    assert.equal(
        checks.find(check => check.id === 'oauth-setup')?.status,
        'ready'
    );
    assert.equal(
        checks.find(check => check.id === 'oauth-admission')?.status,
        'confirm'
    );
    assert.match(
        checks.find(check => check.id === 'oauth-admission')?.action || '',
        /pre-register/i
    );
    assert.equal(
        checks.find(check => check.id === 'oauth-consent')?.status,
        'confirm'
    );
    assert.ok(!JSON.stringify(report).includes(context.secretKey));
    assert.ok(!JSON.stringify(report).includes(auth.secretKey));
    assert.match(
        checks.find(check => check.id === 'oauth-public')?.detail || '',
        /not by this checklist/
    );
});
