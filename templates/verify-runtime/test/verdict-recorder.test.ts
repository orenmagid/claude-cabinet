/**
 * Smoke test for verdict-recorder: confirm end-to-end startRun →
 * setScenarioContext → recordVerdict → endRun writes a well-formed
 * summary report.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  startRun,
  setScenarioContext,
  recordVerdict,
  endRun,
} from '../src/verdict-recorder.js';

test('startRun → recordVerdict → endRun writes summary with total/passed', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cabinet-verify-smoke-'));
  const originalCwd = process.cwd();
  process.chdir(tmpDir);
  try {
    const runId = await startRun();
    assert.match(runId, /^run-\d{4}-\d{2}-\d{2}T/);

    setScenarioContext('test.feature', 'Smoke', 'user');

    await recordVerdict({
      checkId: '0.01',
      stepText: 'smoke',
      verdict: 'auto:pass',
      source: 'auto',
      durationMs: 5,
    });

    const summary = await endRun();
    assert.equal(summary.total, 1);
    assert.equal(summary.passed, 1);
    assert.equal(summary.failed, 0);
    assert.equal(summary.humanVerdicts, 0);

    const summaryPath = path.join(tmpDir, 'reports', `${runId}.summary.json`);
    const summaryStat = await fs.stat(summaryPath);
    assert.ok(summaryStat.isFile(), 'summary.json should exist');

    const summaryContent = JSON.parse(await fs.readFile(summaryPath, 'utf8'));
    assert.equal(summaryContent.total, 1);
    assert.equal(summaryContent.passed, 1);
    assert.ok(Array.isArray(summaryContent.rows), 'summary should include rows array');
    assert.equal(summaryContent.rows.length, 1);
    assert.equal(summaryContent.rows[0].checkId, '0.01');
  } finally {
    process.chdir(originalCwd);
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
