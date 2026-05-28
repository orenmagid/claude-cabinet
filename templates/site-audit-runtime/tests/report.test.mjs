import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renderSingle, renderComparison } from '../src/report.mjs';
import { diff } from '../src/diff.mjs';

function fakeResult(id, overrides = {}) {
  return {
    checkId: id, tool: `Tool ${id}`, status: 'pass', score: 85,
    grade: null, severity: null, findings: [], durationMs: 1000,
    ...overrides,
  };
}

function fakeReport(url, results) {
  return { url, auditedAt: '2026-05-28T00:00:00Z', results, totalDurationMs: 5000 };
}

// --- XSS safety ---

test('XSS: <script> in a finding message is escaped in rendered HTML', () => {
  const report = fakeReport('https://evil.com', [
    fakeResult('xss-check', {
      findings: [{ severity: 'critical', message: '</title><script>alert(1)</script>' }],
    }),
  ]);
  const html = renderSingle(report);
  assert.ok(!html.includes('<script>alert'), 'raw script tag must not appear');
  assert.ok(html.includes('&lt;script&gt;'), 'script tag must be escaped');
});

test('XSS: malicious URL in finding is not a live javascript: href', () => {
  const report = fakeReport('https://x.com', [
    fakeResult('href-check', {
      findings: [{ severity: 'info', message: 'test', url: 'javascript:alert(1)' }],
    }),
  ]);
  const html = renderSingle(report);
  assert.ok(!html.includes('href="javascript:'), 'javascript: href must not appear');
});

// --- CSP meta tag ---

test('rendered HTML contains CSP meta tag', () => {
  const html = renderSingle(fakeReport('https://x.com', [fakeResult('a')]));
  assert.ok(html.includes('Content-Security-Policy'), 'CSP meta tag missing');
  assert.ok(html.includes("script-src 'unsafe-inline'"), 'CSP must allow inline script for toggle');
});

// --- no external resources ---

test('rendered HTML has zero external http(s) script/link refs', () => {
  const html = renderSingle(fakeReport('https://x.com', [fakeResult('a'), fakeResult('b')]));
  const externalScripts = html.match(/<script[^>]+src=["']https?:\/\//gi);
  const externalLinks = html.match(/<link[^>]+href=["']https?:\/\//gi);
  assert.equal(externalScripts, null, 'no external script src');
  assert.equal(externalLinks, null, 'no external link href');
});

// --- section count ---

test('section count equals number of checks in the report', () => {
  const results = [fakeResult('alpha'), fakeResult('beta'), fakeResult('gamma')];
  const html = renderSingle(fakeReport('https://x.com', results));
  const sections = html.match(/data-check-id="/g);
  assert.equal(sections?.length, 3, `expected 3 sections, got ${sections?.length}`);
});

// --- comparison: N/A for asymmetric availability ---

test('comparison: site-a-only check renders N/A delta (not a number)', () => {
  const reportA = fakeReport('https://a.com', [
    fakeResult('alpha', { score: 90 }),
    fakeResult('beta', { score: 80 }),
  ]);
  const reportB = fakeReport('https://b.com', [
    fakeResult('alpha', { score: 95 }),
    fakeResult('beta', { status: 'skip', score: null, reason: 'not available' }),
  ]);
  const delta = diff(reportA, reportB);
  const html = renderComparison(delta);

  const betaDelta = delta.deltas.find(d => d.checkId === 'beta');
  assert.equal(betaDelta.availability, 'site-a-only');
  assert.equal(betaDelta.deltaScore, null);
  assert.ok(html.includes('N/A'), 'must render N/A for one-sided check');
  assert.ok(html.includes('Asymmetric'), 'must warn about asymmetric availability');
});

test('comparison: both-sides check renders numeric delta', () => {
  const reportA = fakeReport('https://a.com', [fakeResult('alpha', { score: 70 })]);
  const reportB = fakeReport('https://b.com', [fakeResult('alpha', { score: 90 })]);
  const delta = diff(reportA, reportB);

  assert.equal(delta.deltas[0].deltaScore, 20);
  const html = renderComparison(delta);
  assert.ok(html.includes('+20'), 'positive delta should show +20');
});

// --- diff unit tests ---

test('diff: both-skip → neither availability', () => {
  const a = fakeReport('https://a.com', [fakeResult('x', { status: 'skip', score: null, reason: 'n/a' })]);
  const b = fakeReport('https://b.com', [fakeResult('x', { status: 'skip', score: null, reason: 'n/a' })]);
  const d = diff(a, b);
  assert.equal(d.deltas[0].availability, 'neither');
  assert.equal(d.summary.neither, 1);
});

test('diff: check only in report A → site-a-only', () => {
  const a = fakeReport('https://a.com', [fakeResult('only-a', { score: 50 })]);
  const b = fakeReport('https://b.com', []);
  const d = diff(a, b);
  assert.equal(d.deltas[0].availability, 'site-a-only');
  assert.equal(d.deltas[0].deltaScore, null);
});

// --- report filename helper ---

import { sanitizeHostname } from '../src/security.mjs';

test('report filename uses sanitized hostname', () => {
  const host = sanitizeHostname('https://evil.com/../../../etc/passwd');
  assert.equal(host, 'evil.com');
  const ts = '2026-05-28T00-00-00';
  const filename = `site-audit-${host}-${ts}.html`;
  assert.ok(!filename.includes('..'), 'no path traversal in filename');
});
