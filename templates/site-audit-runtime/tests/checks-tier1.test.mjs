import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateCheckResult } from '../src/schema.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fix = (id) => readFileSync(join(__dirname, 'fixtures', `${id}.json`), 'utf8');

// helper: simulate { code, stdout, stderr, timedOut } from fixture
const ok = (id) => ({ code: 0, stdout: fix(id), stderr: '', timedOut: false });

// --- lighthouse ---
import * as lighthouse from '../src/checks/lighthouse.mjs';

test('lighthouse: normalize fixture produces valid CheckResult with scores', () => {
  const r = lighthouse.normalize(ok('lighthouse'), 5000);
  const { valid, errors } = validateCheckResult(r);
  assert.ok(valid, errors.join('; '));
  assert.equal(r.checkId, 'lighthouse');
  assert.equal(typeof r.score, 'number');
  assert.ok(r.score >= 0 && r.score <= 100, `score ${r.score}`);
  assert.ok(r.grade, `grade should be set, got ${r.grade}`);
  assert.ok(r.findings.length > 0, 'should have findings for low-scoring audits');
});

// --- axe-core ---
import * as axeCore from '../src/checks/axe-core.mjs';

test('axe-core: normalize fixture produces valid CheckResult with severity-mapped findings', () => {
  const r = axeCore.normalize(ok('axe-core'), 3000);
  const { valid, errors } = validateCheckResult(r);
  assert.ok(valid, errors.join('; '));
  assert.equal(r.checkId, 'axe-core');
  assert.equal(r.status, 'fail');
  assert.equal(r.score, null);
  assert.ok(r.findings.length >= 2, 'fixture has 2 violations');
  assert.ok(r.findings.some(f => f.severity === 'critical'), 'image-alt is critical');
  assert.ok(r.findings.some(f => f.severity === 'serious'), 'color-contrast is serious');
});

// --- security-headers ---
import * as secHeaders from '../src/checks/security-headers.mjs';

test('security-headers: normalize with all headers present → pass', () => {
  const headers = {
    'content-security-policy': "default-src 'self'",
    'strict-transport-security': 'max-age=31536000',
    'x-frame-options': 'DENY',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=()',
  };
  const r = secHeaders.normalize(headers, 200);
  const { valid, errors } = validateCheckResult(r);
  assert.ok(valid, errors.join('; '));
  assert.equal(r.status, 'pass');
  assert.equal(r.score, 100);
  assert.equal(r.findings.length, 0);
});

test('security-headers: missing headers → fail with findings', () => {
  const r = secHeaders.normalize({}, 200);
  const { valid, errors } = validateCheckResult(r);
  assert.ok(valid, errors.join('; '));
  assert.equal(r.status, 'fail');
  assert.ok(r.score < 100);
  assert.ok(r.findings.length >= 6, 'all 6 headers missing');
});

test('security-headers: unsafe-eval in CSP → finding', () => {
  const r = secHeaders.normalize({ 'content-security-policy': "default-src 'self' 'unsafe-eval'" }, 200);
  assert.ok(r.findings.some(f => f.message.includes('unsafe-eval')));
});

// --- observatory ---
import * as observatory from '../src/checks/observatory.mjs';

test('observatory: normalize fixture produces valid CheckResult with grade', () => {
  const r = observatory.normalize(ok('observatory'), 4000);
  const { valid, errors } = validateCheckResult(r);
  assert.ok(valid, errors.join('; '));
  assert.equal(r.checkId, 'observatory');
  assert.equal(r.grade, 'B+');
  assert.equal(r.status, 'pass');
  assert.ok(r.findings.length >= 2, 'fixture has failures/warnings');
});

// --- testssl ---
import * as testssl from '../src/checks/testssl.mjs';

test('testssl: normalize fixture produces valid CheckResult with TLS findings', () => {
  const r = testssl.normalize(ok('testssl'), 30000);
  const { valid, errors } = validateCheckResult(r);
  assert.ok(valid, errors.join('; '));
  assert.equal(r.checkId, 'testssl');
  assert.ok(r.findings.length >= 2, 'TLS 1.1 + SWEET32');
  assert.ok(r.findings.some(f => f.context?.includes('CVE')), 'SWEET32 has a CVE');
});

// --- meta-og ---
import * as metaOg from '../src/checks/meta-og.mjs';

test('meta-og: full HTML with all tags → pass', () => {
  const html = `<html><head>
    <title>Test Page</title>
    <meta name="description" content="A test page for auditing">
    <link rel="canonical" href="https://example.com/">
    <meta property="og:title" content="Test">
    <meta property="og:description" content="A test">
    <meta property="og:image" content="https://example.com/img.jpg">
    <meta property="og:url" content="https://example.com/">
    <meta name="twitter:card" content="summary">
  </head><body></body></html>`;
  const r = metaOg.normalize(html, 500);
  const { valid, errors } = validateCheckResult(r);
  assert.ok(valid, errors.join('; '));
  assert.equal(r.status, 'pass');
  assert.equal(r.score, 100);
});

test('meta-og: missing everything → fail with findings', () => {
  const r = metaOg.normalize('<html><head></head><body></body></html>', 500);
  const { valid, errors } = validateCheckResult(r);
  assert.ok(valid, errors.join('; '));
  assert.equal(r.status, 'fail');
  assert.ok(r.findings.length >= 4, `only ${r.findings.length} findings`);
});

// --- structured-data ---
import * as structuredData from '../src/checks/structured-data.mjs';

test('structured-data: valid JSON-LD → pass', () => {
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Organization","name":"Test Corp","url":"https://example.com"}
  </script></head><body></body></html>`;
  const r = structuredData.normalize(html, 300);
  const { valid, errors } = validateCheckResult(r);
  assert.ok(valid, errors.join('; '));
  assert.equal(r.status, 'pass');
});

test('structured-data: no JSON-LD → fail', () => {
  const r = structuredData.normalize('<html><body>no data</body></html>', 300);
  assert.equal(r.status, 'fail');
  assert.ok(r.findings.some(f => f.message.includes('No JSON-LD')));
});

test('structured-data: malformed JSON-LD → findings', () => {
  const html = '<html><head><script type="application/ld+json">{not valid json</script></head></html>';
  const r = structuredData.normalize(html, 300);
  assert.ok(r.findings.some(f => f.message.includes('Malformed')));
});

// --- linkinator ---
import * as linkinator from '../src/checks/linkinator.mjs';

test('linkinator: normalize fixture produces valid CheckResult with broken link', () => {
  const r = linkinator.normalize(ok('linkinator'), 8000);
  const { valid, errors } = validateCheckResult(r);
  assert.ok(valid, errors.join('; '));
  assert.equal(r.checkId, 'linkinator');
  assert.equal(r.status, 'fail');
  assert.ok(r.findings.some(f => f.message.includes('404')), 'should report the 404');
});

// --- dns ---
import * as dns from '../src/checks/dns.mjs';

test('dns: normalize with all records present → pass', () => {
  const raw = {
    hostname: 'example.com',
    dnssec: { code: 0, stdout: 'A 93.184.216.34\nRRSIG A 13 2 86400 ...\n', stderr: '' },
    spf: { code: 0, stdout: '"v=spf1 include:_spf.google.com ~all"\n', stderr: '' },
    dmarc: { code: 0, stdout: '"v=DMARC1; p=reject; rua=mailto:d@example.com"\n', stderr: '' },
    http2: { code: 0, stdout: '2', stderr: '' },
  };
  const r = dns.normalize(raw, 2000);
  const { valid, errors } = validateCheckResult(r);
  assert.ok(valid, errors.join('; '));
  assert.equal(r.status, 'pass');
  assert.equal(r.score, 100);
});

test('dns: missing DMARC and DNSSEC → findings', () => {
  const raw = {
    hostname: 'example.com',
    dnssec: { code: 0, stdout: 'A 93.184.216.34\n', stderr: '' },
    spf: { code: 0, stdout: '"v=spf1 include:_spf.google.com ~all"\n', stderr: '' },
    dmarc: { code: 0, stdout: '\n', stderr: '' },
    http2: { code: 0, stdout: '2', stderr: '' },
  };
  const r = dns.normalize(raw, 2000);
  assert.equal(r.status, 'fail');
  assert.ok(r.findings.some(f => f.message.includes('DNSSEC')));
  assert.ok(r.findings.some(f => f.message.includes('DMARC')));
});

// --- ssl-cert ---
import * as sslCert from '../src/checks/ssl-cert.mjs';

test('ssl-cert: valid cert → pass', () => {
  const raw = {
    code: 0, timedOut: false, stderr: '',
    stdout: 'CONNECTED\nnotBefore=Jan 1 00:00:00 2026 GMT\nnotAfter=Dec 31 23:59:59 2027 GMT\nverify return:1\n',
  };
  const r = sslCert.normalize(raw, 1000);
  const { valid, errors } = validateCheckResult(r);
  assert.ok(valid, errors.join('; '));
  assert.equal(r.status, 'pass');
  assert.equal(r.findings.length, 0);
});

test('ssl-cert: expired cert → critical finding', () => {
  const raw = {
    code: 0, timedOut: false, stderr: '',
    stdout: 'CONNECTED\nnotBefore=Jan 1 2020 GMT\nnotAfter=Jan 1 2021 GMT\nverify error:num=10:certificate has expired\n',
  };
  const r = sslCert.normalize(raw, 1000);
  assert.equal(r.status, 'fail');
  assert.ok(r.findings.some(f => f.severity === 'critical' && f.message.includes('expired')));
});

// --- cross-cutting: no exec/execSync in any check module ---
import { readFileSync as readFS, readdirSync } from 'node:fs';

test('no check module uses exec/execSync (security invariant)', () => {
  const checksDir = join(__dirname, '..', 'src', 'checks');
  const files = readdirSync(checksDir).filter(f => f.endsWith('.mjs'));
  for (const f of files) {
    const src = readFS(join(checksDir, f), 'utf8');
    assert.ok(!src.includes('execSync('), `${f} contains execSync`);
    assert.ok(!/child_process|exec\(|execFile\(/.test(src.replace(/\bre\.exec\b/g, '')), `${f} imports exec/execFile from child_process`);
  }
});

// --- dns and ssl-cert pass hostname, not full URL ---
test('dns.run passes hostname to dig (not full URL)', async () => {
  let capturedArgs = [];
  const mockExecutor = {
    spawn: async (cmd, args) => {
      if (cmd === 'dig') capturedArgs.push(...args);
      return { code: 0, stdout: '', stderr: '' };
    },
    fetch: async () => new Response(''),
  };
  await dns.run('https://example.com/path?query=1', mockExecutor);
  assert.ok(!capturedArgs.some(a => a.includes('https://')), `dig received a full URL: ${capturedArgs}`);
  assert.ok(capturedArgs.includes('example.com'), 'dig should receive hostname');
});

test('ssl-cert.run passes hostname to openssl (not full URL)', async () => {
  let capturedArgs = [];
  const mockExecutor = {
    spawn: async (cmd, args) => { capturedArgs = args; return { code: 0, stdout: '', stderr: '' }; },
  };
  await sslCert.run('https://secure.example.com/page', mockExecutor);
  assert.ok(!capturedArgs.some(a => a.includes('https://')), `openssl received a full URL: ${capturedArgs}`);
  assert.ok(capturedArgs.some(a => a.includes('secure.example.com')), 'openssl should receive hostname');
});
