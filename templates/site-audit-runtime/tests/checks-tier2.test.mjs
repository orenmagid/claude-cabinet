import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateCheckResult } from '../src/schema.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fix = (id) => readFileSync(join(__dirname, 'fixtures', `${id}.json`), 'utf8');
const ok = (id) => ({ code: 0, stdout: fix(id), stderr: '', timedOut: false });

// --- pa11y ---
import * as pa11y from '../src/checks/pa11y.mjs';

test('pa11y: normalize fixture produces valid CheckResult with WCAG AAA findings', () => {
  const r = pa11y.normalize(ok('pa11y'), 5000);
  const { valid, errors } = validateCheckResult(r);
  assert.ok(valid, errors.join('; '));
  assert.equal(r.checkId, 'pa11y');
  assert.equal(r.status, 'fail');
  assert.ok(r.findings.some(f => f.severity === 'serious'), 'error type → serious');
  assert.ok(r.findings.some(f => f.severity === 'moderate'), 'warning type → moderate');
});

test('pa11y: empty issues array → pass', () => {
  const r = pa11y.normalize({ code: 0, stdout: '[]', stderr: '', timedOut: false }, 1000);
  const { valid, errors } = validateCheckResult(r);
  assert.ok(valid, errors.join('; '));
  assert.equal(r.status, 'pass');
});

// --- nuclei ---
import * as nuclei from '../src/checks/nuclei.mjs';

test('nuclei: run without authorization returns skip marker', async () => {
  const mockExecutor = { spawn: async () => ({ code: 0, stdout: '', stderr: '' }) };
  const result = await nuclei.run('https://example.com', mockExecutor, {});
  assert.ok(result.__skipped, 'should be skipped without authorization');
  assert.ok(result.reason.includes('not authorized'));
});

test('nuclei: run with wrong domain authorization returns skip', async () => {
  const mockExecutor = { spawn: async () => ({ code: 0, stdout: '', stderr: '' }) };
  const result = await nuclei.run('https://example.com', mockExecutor, { authorizedDomain: 'other.com' });
  assert.ok(result.__skipped);
});

test('nuclei: run with correct authorization proceeds', async () => {
  let called = false;
  const mockExecutor = {
    spawn: async () => { called = true; return { code: 0, stdout: '', stderr: '' }; },
  };
  const result = await nuclei.run('https://example.com', mockExecutor, { authorizedDomain: 'example.com' });
  assert.ok(called, 'should have invoked nuclei');
  assert.ok(!result.__skipped, 'should not be skipped');
});

test('nuclei: normalize skip marker produces status:skip', () => {
  const r = nuclei.normalize({ __skipped: true, reason: 'not authorized' }, 0);
  const { valid, errors } = validateCheckResult(r);
  assert.ok(valid, errors.join('; '));
  assert.equal(r.status, 'skip');
  assert.ok(r.reason.includes('not authorized'));
});

test('nuclei: normalize fixture preserves per-finding severity (critical stays critical)', () => {
  const r = nuclei.normalize(ok('nuclei'), 15000);
  const { valid, errors } = validateCheckResult(r);
  assert.ok(valid, errors.join('; '));
  assert.equal(r.status, 'fail');
  assert.ok(r.findings.some(f => f.severity === 'critical'), 'Log4Shell should be critical');
  assert.ok(r.findings.some(f => f.severity === 'serious'), 'git-config (medium) should be serious');
  assert.ok(r.findings.some(f => f.severity === 'info'), 'robots.txt should be info');
});
