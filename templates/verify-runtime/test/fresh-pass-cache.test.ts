/**
 * fresh-pass-cache unit tests.
 *
 * Per CONVENTIONS.md §pathHash Spec and the Phase 2 action plan ACs.
 *
 * Tests:
 *  - getFreshPass returns null when pathHashes mismatch
 *  - getFreshPass returns the row when pathHashes match AND verdict is P/N
 *  - env-var gating (CABINET_VERIFY_SKIP_FRESH_PASSES)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { isFreshPass, getFreshPass, _clearFreshPassCache } from '../src/fresh-pass-cache.js';

/**
 * Helper: write a single-row JSONL ledger at <cwd>/reports/<runId>.jsonl
 * with the given fields.
 */
function writeLedgerRow(opts: {
  reportsDir: string;
  runId: string;
  scenarioFile: string;
  checkId: string;
  pathHash: string;
  verdict: string;
  runStartedAt: string;
  notes?: string | null;
}): void {
  fs.mkdirSync(opts.reportsDir, { recursive: true });
  const row = {
    runId: opts.runId,
    runStartedAt: opts.runStartedAt,
    gitSha: 'deadbeef',
    scenarioFile: opts.scenarioFile,
    scenarioTitle: 'Test',
    stepText: 'sample',
    checkId: opts.checkId,
    pathHash: opts.pathHash,
    acItemId: null,
    verdict: opts.verdict,
    source: 'human',
    screenshotPath: null,
    notes: opts.notes ?? null,
    durationMs: 0,
    role: 'user',
    costUsd: null,
  };
  const jsonlPath = path.join(opts.reportsDir, `${opts.runId}.jsonl`);
  fs.appendFileSync(jsonlPath, JSON.stringify(row) + '\n', 'utf8');
}

test('getFreshPass returns null when env var is not set', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freshpass-noenv-'));
  const originalCwd = process.cwd();
  process.chdir(tmpDir);
  delete process.env.CABINET_VERIFY_SKIP_FRESH_PASSES;
  _clearFreshPassCache();
  try {
    writeLedgerRow({
      reportsDir: path.join(tmpDir, 'reports'),
      runId: 'run-test',
      scenarioFile: 'features/x.feature',
      checkId: '1.01',
      pathHash: 'aaaa1111bbbb2222',
      verdict: 'human:P',
      runStartedAt: '2026-05-14T00:00:00Z',
    });
    assert.equal(
      getFreshPass('features/x.feature', '1.01', 'aaaa1111bbbb2222'),
      null,
      'no env var → null even with matching row',
    );
    assert.equal(isFreshPass('features/x.feature', '1.01', 'aaaa1111bbbb2222'), false);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('getFreshPass returns null when pathHash mismatches', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freshpass-mismatch-'));
  const originalCwd = process.cwd();
  process.chdir(tmpDir);
  process.env.CABINET_VERIFY_SKIP_FRESH_PASSES = '1';
  _clearFreshPassCache();
  try {
    writeLedgerRow({
      reportsDir: path.join(tmpDir, 'reports'),
      runId: 'run-test',
      scenarioFile: 'features/x.feature',
      checkId: '1.01',
      pathHash: 'aaaa1111bbbb2222',
      verdict: 'human:P',
      runStartedAt: '2026-05-14T00:00:00Z',
    });
    // Ledger has aaaa1111bbbb2222, lookup is cccc3333dddd4444.
    assert.equal(
      getFreshPass('features/x.feature', '1.01', 'cccc3333dddd4444'),
      null,
      'mismatched pathHash → null',
    );
    assert.equal(
      isFreshPass('features/x.feature', '1.01', 'cccc3333dddd4444'),
      false,
    );
  } finally {
    delete process.env.CABINET_VERIFY_SKIP_FRESH_PASSES;
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('getFreshPass returns row when pathHash matches and verdict is P', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freshpass-match-p-'));
  const originalCwd = process.cwd();
  process.chdir(tmpDir);
  process.env.CABINET_VERIFY_SKIP_FRESH_PASSES = '1';
  _clearFreshPassCache();
  try {
    writeLedgerRow({
      reportsDir: path.join(tmpDir, 'reports'),
      runId: 'run-test',
      scenarioFile: 'features/x.feature',
      checkId: '1.01',
      pathHash: 'aaaa1111bbbb2222',
      verdict: 'human:P',
      runStartedAt: '2026-05-14T00:00:00Z',
    });
    const row = getFreshPass('features/x.feature', '1.01', 'aaaa1111bbbb2222');
    assert.ok(row, 'matching pathHash + P verdict should return row');
    assert.equal(row.verdict, 'human:P');
    assert.equal(row.pathHash, 'aaaa1111bbbb2222');
    assert.equal(isFreshPass('features/x.feature', '1.01', 'aaaa1111bbbb2222'), true);
  } finally {
    delete process.env.CABINET_VERIFY_SKIP_FRESH_PASSES;
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('getFreshPass returns row when pathHash matches and verdict is N', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freshpass-match-n-'));
  const originalCwd = process.cwd();
  process.chdir(tmpDir);
  process.env.CABINET_VERIFY_SKIP_FRESH_PASSES = '1';
  _clearFreshPassCache();
  try {
    writeLedgerRow({
      reportsDir: path.join(tmpDir, 'reports'),
      runId: 'run-test',
      scenarioFile: 'features/x.feature',
      checkId: '1.01',
      pathHash: 'aaaa1111bbbb2222',
      verdict: 'human:N',
      runStartedAt: '2026-05-14T00:00:00Z',
    });
    const row = getFreshPass('features/x.feature', '1.01', 'aaaa1111bbbb2222');
    assert.ok(row, 'matching pathHash + N verdict should return row');
    assert.equal(row.verdict, 'human:N');
  } finally {
    delete process.env.CABINET_VERIFY_SKIP_FRESH_PASSES;
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('getFreshPass returns null when pathHash matches but verdict is I', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freshpass-issue-'));
  const originalCwd = process.cwd();
  process.chdir(tmpDir);
  process.env.CABINET_VERIFY_SKIP_FRESH_PASSES = '1';
  _clearFreshPassCache();
  try {
    writeLedgerRow({
      reportsDir: path.join(tmpDir, 'reports'),
      runId: 'run-test',
      scenarioFile: 'features/x.feature',
      checkId: '1.01',
      pathHash: 'aaaa1111bbbb2222',
      verdict: 'human:I',
      runStartedAt: '2026-05-14T00:00:00Z',
    });
    assert.equal(
      getFreshPass('features/x.feature', '1.01', 'aaaa1111bbbb2222'),
      null,
      'I verdict should not count as fresh pass',
    );
  } finally {
    delete process.env.CABINET_VERIFY_SKIP_FRESH_PASSES;
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('legacy ledger row (no pathHash) is skipped, never matches current run', () => {
  // Critical regression test: pre-Phase-2 ledger rows lack pathHash.
  // We must NOT conjure one from the current .feature content (would
  // silently auto-skip the operator on edited scenarios). The row
  // must be ignored entirely.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freshpass-legacy-'));
  const originalCwd = process.cwd();
  process.chdir(tmpDir);
  process.env.CABINET_VERIFY_SKIP_FRESH_PASSES = '1';
  _clearFreshPassCache();
  try {
    // Hand-write a row WITHOUT pathHash field (legacy shape).
    const reportsDir = path.join(tmpDir, 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    const legacyRow = {
      runId: 'run-legacy',
      runStartedAt: '2026-04-01T00:00:00Z',
      gitSha: 'oldsha',
      scenarioFile: 'features/x.feature',
      scenarioTitle: 'Test',
      stepText: 'sample',
      checkId: '1.01',
      // pathHash: intentionally omitted (legacy)
      verdict: 'human:P',
      source: 'human',
      notes: null,
      durationMs: 0,
      role: 'user',
    };
    fs.writeFileSync(
      path.join(reportsDir, 'run-legacy.jsonl'),
      JSON.stringify(legacyRow) + '\n',
      'utf8',
    );

    // Any pathHash should miss (the legacy row was skipped during load).
    assert.equal(
      getFreshPass('features/x.feature', '1.01', 'aaaa1111bbbb2222'),
      null,
      'legacy row must not match — operator should re-verdict',
    );
    assert.equal(
      isFreshPass('features/x.feature', '1.01', 'aaaa1111bbbb2222'),
      false,
    );
  } finally {
    delete process.env.CABINET_VERIFY_SKIP_FRESH_PASSES;
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('SKIP_FRESH_PASSES auto-skip rows are filtered (do not count as fresh)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freshpass-skipfresh-'));
  const originalCwd = process.cwd();
  process.chdir(tmpDir);
  process.env.CABINET_VERIFY_SKIP_FRESH_PASSES = '1';
  _clearFreshPassCache();
  try {
    // First row: a real P verdict.
    writeLedgerRow({
      reportsDir: path.join(tmpDir, 'reports'),
      runId: 'run-1',
      scenarioFile: 'features/x.feature',
      checkId: '1.01',
      pathHash: 'aaaa1111bbbb2222',
      verdict: 'human:P',
      runStartedAt: '2026-05-13T00:00:00Z',
    });
    // Second row: a SKIP_FRESH_PASSES auto-skip (later in time).
    writeLedgerRow({
      reportsDir: path.join(tmpDir, 'reports'),
      runId: 'run-2',
      scenarioFile: 'features/x.feature',
      checkId: '1.01',
      pathHash: 'aaaa1111bbbb2222',
      verdict: 'human:S',
      runStartedAt: '2026-05-14T00:00:00Z',
      notes: 'SKIP_FRESH_PASSES=1; prior human:P on 2026-05-13 @ deadbeef',
    });
    // The auto-skip row should be filtered; the real P should win.
    const row = getFreshPass('features/x.feature', '1.01', 'aaaa1111bbbb2222');
    assert.ok(row);
    assert.equal(row.verdict, 'human:P', 'real P should win over later SKIP auto-skip row');
  } finally {
    delete process.env.CABINET_VERIFY_SKIP_FRESH_PASSES;
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
