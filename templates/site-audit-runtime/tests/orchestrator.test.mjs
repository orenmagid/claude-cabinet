// Phase 1 tests: orchestrator runner, tool-detection contract, timeout
// framework, fixture injection, and the all-skip guard.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { auditSite, allSkipped, fixtureExecutor } from '../src/orchestrator.mjs';
import { validateCheckResult } from '../src/schema.mjs';

// --- helpers: fake check modules ---

function fakeCheck(id, overrides = {}) {
  return {
    checkId: id,
    tool: `Fake ${id}`,
    detect: async () => true,
    run: async () => ({ data: `raw-${id}` }),
    normalize: (raw, durationMs) => ({
      checkId: id,
      tool: `Fake ${id}`,
      status: 'pass',
      score: 85,
      grade: null,
      severity: null,
      findings: [],
      durationMs,
    }),
    ...overrides,
  };
}

function unavailableCheck(id) {
  return fakeCheck(id, { detect: async () => false });
}

function slowCheck(id, delayMs) {
  return fakeCheck(id, {
    run: async () => new Promise((resolve) => setTimeout(() => resolve({}), delayMs)),
  });
}

// --- orchestrator core ---

test('auditSite runs available checks and returns a SiteReport', async () => {
  const checks = [fakeCheck('alpha'), fakeCheck('beta')];
  const report = await auditSite('https://example.com', checks);

  assert.equal(report.url, 'https://example.com');
  assert.equal(report.results.length, 2);
  for (const r of report.results) {
    const { valid, errors } = validateCheckResult(r);
    assert.ok(valid, `${r.checkId}: ${errors.join('; ')}`);
    assert.equal(r.status, 'pass');
  }
});

test('unavailable check produces status:skip with a reason', async () => {
  const checks = [unavailableCheck('missing-tool')];
  const report = await auditSite('https://example.com', checks);

  assert.equal(report.results.length, 1);
  const r = report.results[0];
  assert.equal(r.status, 'skip');
  assert.ok(r.reason, 'skip result must include a reason');
  const { valid } = validateCheckResult(r);
  assert.ok(valid);
});

test('allSkipped returns true when every check is skipped', () => {
  const report = {
    url: 'https://x.com',
    auditedAt: '',
    results: [
      { checkId: 'a', tool: 'A', status: 'skip', score: null, grade: null, severity: null, findings: [], durationMs: 0, reason: 'not found' },
      { checkId: 'b', tool: 'B', status: 'skip', score: null, grade: null, severity: null, findings: [], durationMs: 0, reason: 'not found' },
    ],
    totalDurationMs: 0,
  };
  assert.equal(allSkipped(report), true);
});

test('allSkipped returns false when at least one check ran', () => {
  const report = {
    url: 'https://x.com',
    auditedAt: '',
    results: [
      { checkId: 'a', tool: 'A', status: 'skip', score: null, grade: null, severity: null, findings: [], durationMs: 0, reason: 'not found' },
      { checkId: 'b', tool: 'B', status: 'pass', score: 90, grade: null, severity: null, findings: [], durationMs: 100 },
    ],
    totalDurationMs: 100,
  };
  assert.equal(allSkipped(report), false);
});

// --- timeout ---

test('per-tool timeout produces status:error within reasonable time', async () => {
  const checks = [slowCheck('slow-tool', 999_000)];
  const start = Date.now();
  const report = await auditSite('https://example.com', checks, {
    timeouts: { 'slow-tool': 300 },
  });
  const elapsed = Date.now() - start;

  assert.equal(report.results.length, 1);
  assert.equal(report.results[0].status, 'error');
  assert.ok(report.results[0].reason.includes('timeout'), `reason: ${report.results[0].reason}`);
  assert.ok(elapsed < 3000, `should resolve quickly, took ${elapsed}ms`);
});

test('overall timeout kills remaining checks', async () => {
  const checks = [slowCheck('first', 50), slowCheck('second', 999_000)];
  const report = await auditSite('https://example.com', checks, {
    overallTimeoutMs: 200,
  });

  const second = report.results.find((r) => r.checkId === 'second');
  assert.ok(second);
  assert.equal(second.status, 'error');
  assert.ok(second.reason.includes('timeout') || second.reason.includes('overall'), second.reason);
});

// --- fixture mode ---

test('fixtureExecutor loads fixture JSON as stdout', async () => {
  const dir = join(tmpdir(), `sa-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'alpha.json'), JSON.stringify({ score: 42 }));

  const exec = fixtureExecutor(dir);
  const res = await exec.spawn('npx', ['lighthouse', 'https://x.com']);
  // The guess falls through to 'lighthouse', fixture won't match alpha
  // Let's test with a direct fixture name
  const res2 = await exec.spawn('alpha', []);
  assert.equal(res2.code, 0);
  assert.deepEqual(JSON.parse(res2.stdout), { score: 42 });

  rmSync(dir, { recursive: true });
});

// --- enabledChecks filter ---

test('enabledChecks filters to only requested checks', async () => {
  const checks = [fakeCheck('alpha'), fakeCheck('beta'), fakeCheck('gamma')];
  const report = await auditSite('https://example.com', checks, {
    enabledChecks: new Set(['beta']),
  });
  assert.equal(report.results.length, 1);
  assert.equal(report.results[0].checkId, 'beta');
});

// --- error in normalize ---

test('check whose normalize() returns invalid schema yields status:error', async () => {
  const bad = fakeCheck('bad-normalize', {
    normalize: () => ({ checkId: 'bad-normalize', tool: 'Bad' }),
  });
  const report = await auditSite('https://example.com', [bad]);
  assert.equal(report.results[0].status, 'error');
  assert.ok(report.results[0].reason.includes('invalid CheckResult'));
});

// --- error in run ---

test('check whose run() throws yields status:error, not a crash', async () => {
  const throwing = fakeCheck('thrower', {
    run: async () => { throw new Error('boom'); },
  });
  const report = await auditSite('https://example.com', [throwing]);
  assert.equal(report.results[0].status, 'error');
  assert.ok(report.results[0].reason.includes('boom'));
});
