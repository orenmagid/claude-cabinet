// Phase 0 foundation tests: the CheckResult schema contract and the security
// helpers every check + the report depend on.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateCheckResult, assertCheckResult } from '../src/schema.mjs';
import { esc, sanitizeHostname, isSafeHref, safeSpawn } from '../src/security.mjs';

function baseResult(overrides = {}) {
  return {
    checkId: 'lighthouse',
    tool: 'Lighthouse',
    status: 'pass',
    score: 92,
    grade: null,
    severity: null,
    findings: [],
    durationMs: 1234,
    ...overrides,
  };
}

test('validateCheckResult accepts a well-formed result', () => {
  const { valid, errors } = validateCheckResult(baseResult());
  assert.equal(valid, true, errors.join('; '));
});

test('status must never be absent', () => {
  const r = baseResult();
  delete r.status;
  const { valid, errors } = validateCheckResult(r);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('status')), errors.join('; '));
});

test('status must be a known value', () => {
  const { valid } = validateCheckResult(baseResult({ status: 'maybe' }));
  assert.equal(valid, false);
});

test('score 0 is a valid score (distinct from null)', () => {
  const { valid, errors } = validateCheckResult(baseResult({ score: 0 }));
  assert.equal(valid, true, errors.join('; '));
});

test('score null is valid (tool produces no score)', () => {
  const { valid, errors } = validateCheckResult(
    baseResult({ checkId: 'linkinator', tool: 'linkinator', score: null })
  );
  assert.equal(valid, true, errors.join('; '));
});

test('score undefined is rejected — a missing score must be explicit null, not 0-confusion', () => {
  const r = baseResult();
  delete r.score;
  const { valid, errors } = validateCheckResult(r);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes('score')), errors.join('; '));
});

test('skip status requires a reason (no silent pass)', () => {
  const { valid } = validateCheckResult(
    baseResult({ status: 'skip', score: null })
  );
  assert.equal(valid, false);
  const ok = validateCheckResult(
    baseResult({ status: 'skip', score: null, reason: 'nuclei not found in PATH' })
  );
  assert.equal(ok.valid, true, ok.errors.join('; '));
});

test('error status requires a reason', () => {
  const { valid } = validateCheckResult(baseResult({ status: 'error', score: null }));
  assert.equal(valid, false);
});

test('findings must carry a known severity and a message', () => {
  const bad = validateCheckResult(
    baseResult({ findings: [{ severity: 'nope', message: 'x' }] })
  );
  assert.equal(bad.valid, false);
  const good = validateCheckResult(
    baseResult({ findings: [{ severity: 'critical', message: 'CVE-2024-1 present' }] })
  );
  assert.equal(good.valid, true, good.errors.join('; '));
});

test('assertCheckResult throws on invalid input', () => {
  assert.throws(() => assertCheckResult({ checkId: 'x' }), /Invalid CheckResult/);
});

// --- security helpers ---

test("esc('<script>') escapes angle brackets", () => {
  assert.equal(esc('<script>'), '&lt;script&gt;');
});

test('esc neutralizes a full XSS payload', () => {
  assert.equal(
    esc(`</title><script>alert('x')</script>`),
    '&lt;/title&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;'
  );
});

test('esc returns empty string for null/undefined', () => {
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
});

test("sanitizeHostname('https://a.com/../x') returns 'a.com'", () => {
  assert.equal(sanitizeHostname('https://a.com/../x'), 'a.com');
});

test('sanitizeHostname neutralizes unusual hostname characters', () => {
  // userinfo is not part of hostname; ensure only hostname is used
  assert.equal(sanitizeHostname('https://user:pass@example.com:8443/path'), 'example.com');
});

test('isSafeHref allows http/https and rejects javascript: URLs', () => {
  assert.equal(isSafeHref('https://example.com'), true);
  assert.equal(isSafeHref('http://example.com'), true);
  assert.equal(isSafeHref("javascript:alert(1)"), false);
  assert.equal(isSafeHref('not a url'), false);
});

test('safeSpawn rejects a non-array args list (no shell-string interpolation)', () => {
  assert.throws(() => safeSpawn('echo', 'hi; rm -rf /'), /must be an array/);
});

test('safeSpawn runs a process and captures stdout without a shell', async () => {
  const res = await safeSpawn('node', ['-e', "process.stdout.write('ok')"], { timeoutMs: 5000 });
  assert.equal(res.timedOut, false);
  assert.equal(res.code, 0);
  assert.equal(res.stdout, 'ok');
});

test('safeSpawn does NOT interpret shell metacharacters in arguments', async () => {
  // If this were exec/shell, the `;` would chain a second command. With
  // spawn+array it is an inert literal argument echoed back verbatim.
  const payload = 'https://example.com; echo PWNED';
  const res = await safeSpawn('node', ['-e', 'process.stdout.write(process.argv[1])', payload], {
    timeoutMs: 5000,
  });
  assert.equal(res.stdout, payload);
  assert.ok(!res.stdout.includes('PWNED\n'), 'shell must not have executed the injected command');
});

test('safeSpawn reports timeout instead of hanging', async () => {
  const start = Date.now();
  const res = await safeSpawn('node', ['-e', 'setTimeout(()=>{}, 999000)'], { timeoutMs: 300 });
  assert.equal(res.timedOut, true);
  assert.ok(Date.now() - start < 3000, 'should resolve shortly after the timeout');
});
