/**
 * pathHash unit tests.
 *
 * Per CONVENTIONS.md §pathHash Spec and the Phase 2 action plan ACs.
 *
 * Tests:
 *  - determinism: same input → same hash, 10× sequential invocations
 *  - invalidation: editing an upstream step changes hash for downstream
 *  - format: 16-char hex string
 *  - checkId extraction: quoted-arg form, bare form, no-match
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  computePathHash,
  computePathHashSafe,
  extractCheckIdFromStep,
  GherkinParseError,
  _clearPathHashCache,
} from '../src/path-hash.js';

const fixturePath = path.resolve('test/fixtures/sample.feature');

test('computePathHash is deterministic across 10 sequential invocations', () => {
  _clearPathHashCache();
  const first = computePathHash(fixturePath, '1.05');
  assert.match(first, /^[0-9a-f]{16}$/, 'pathHash should be 16 hex chars');
  for (let i = 0; i < 9; i++) {
    const next = computePathHash(fixturePath, '1.05');
    assert.equal(next, first, `invocation ${i + 2} differs from first`);
  }
});

test('editing step 2 changes pathHash for step 5 (downstream invalidation)', async () => {
  _clearPathHashCache();
  const baseline = computePathHash(fixturePath, '1.05');

  // Create a temp copy of the fixture with step 2 modified.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pathhash-edit-'));
  try {
    const tmpFeature = path.join(tmpDir, 'sample.feature');
    let content = fs.readFileSync(fixturePath, 'utf8');
    // Mutate step 1.02's text content (the words after the checkId).
    content = content.replace(
      'the navbar has a Rewrite link',
      'the navbar has a Different link',
    );
    fs.writeFileSync(tmpFeature, content, 'utf8');

    _clearPathHashCache();
    const modified = computePathHash(tmpFeature, '1.05');
    assert.match(modified, /^[0-9a-f]{16}$/);
    assert.notEqual(modified, baseline, 'editing step 2 should change pathHash of step 5');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('editing step 2 does NOT change pathHash for step 1 (upstream stability)', () => {
  _clearPathHashCache();
  const baseline = computePathHash(fixturePath, '1.01');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pathhash-step1-'));
  try {
    const tmpFeature = path.join(tmpDir, 'sample.feature');
    let content = fs.readFileSync(fixturePath, 'utf8');
    content = content.replace(
      'the navbar has a Rewrite link',
      'the navbar has a Different link',
    );
    fs.writeFileSync(tmpFeature, content, 'utf8');

    _clearPathHashCache();
    const modifiedStep1 = computePathHash(tmpFeature, '1.01');
    assert.equal(
      modifiedStep1,
      baseline,
      'step 1 hash should be unchanged when step 2 is edited (step 1 precedes the edit)',
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('computePathHash throws when checkId is not found', () => {
  _clearPathHashCache();
  assert.throws(
    () => computePathHash(fixturePath, '99.99'),
    /no step matching checkId "99\.99"/,
  );
});

test('computePathHashSafe returns empty string on error', () => {
  _clearPathHashCache();
  assert.equal(computePathHashSafe(fixturePath, '99.99'), '');
  assert.equal(computePathHashSafe('/nonexistent.feature', '1.01'), '');
});

test('extractCheckIdFromStep: quoted-arg form', () => {
  assert.equal(
    extractCheckIdFromStep('check "1.01 workspace-heading-visible" the workspace heading is visible'),
    '1.01',
  );
  assert.equal(
    extractCheckIdFromStep('ask the human "1.04 first-impression: does this feel right?"'),
    '1.04',
  );
});

test('extractCheckIdFromStep: bare-token form', () => {
  assert.equal(extractCheckIdFromStep('1.05 the user clicks Download PDF'), '1.05');
  assert.equal(extractCheckIdFromStep('  1.05  leading whitespace'), '1.05');
});

test('extractCheckIdFromStep: empty input', () => {
  assert.equal(extractCheckIdFromStep(''), null);
  assert.equal(extractCheckIdFromStep('   '), null);
});

test('throws on Scenario Outline (v0.1.0 limitation)', () => {
  _clearPathHashCache();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pathhash-outline-'));
  try {
    const tmpFeature = path.join(tmpDir, 'outline.feature');
    fs.writeFileSync(
      tmpFeature,
      `Feature: Outline test
  Scenario Outline: Sign in as <role>
    When I sign in as "<role>"
    Then check "1.01 ok" the dashboard loads

    Examples:
      | role  |
      | user  |
      | admin |
`,
      'utf8',
    );
    assert.throws(
      () => computePathHash(tmpFeature, '1.01'),
      /Scenario Outline.+is not yet supported/,
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('throws on cross-scenario duplicate checkId', () => {
  _clearPathHashCache();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pathhash-dup-'));
  try {
    const tmpFeature = path.join(tmpDir, 'dup.feature');
    fs.writeFileSync(
      tmpFeature,
      `Feature: Duplicate checkId across scenarios
  Scenario: First
    Then check "1.01 same-id" first scenario assertion

  Scenario: Second
    Then check "1.01 same-id" second scenario assertion
`,
      'utf8',
    );
    assert.throws(
      () => computePathHash(tmpFeature, '1.01'),
      /appears in multiple scenarios.+rename one of them/,
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('GherkinParseError is thrown (not swallowed) on corrupt .feature', () => {
  _clearPathHashCache();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pathhash-corrupt-'));
  try {
    const tmpFeature = path.join(tmpDir, 'corrupt.feature');
    fs.writeFileSync(tmpFeature, 'this is not valid gherkin syntax!!! @@@\n', 'utf8');
    // computePathHash should throw GherkinParseError
    assert.throws(() => computePathHash(tmpFeature, '1.01'), GherkinParseError);
    // computePathHashSafe should ALSO throw (re-throws parse errors)
    assert.throws(() => computePathHashSafe(tmpFeature, '1.01'), GherkinParseError);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('content-hash cache works across same-mtime edits (regression for mtime-cache staleness)', () => {
  _clearPathHashCache();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pathhash-mtime-'));
  try {
    const tmpFeature = path.join(tmpDir, 'edit.feature');
    fs.writeFileSync(
      tmpFeature,
      `Feature: T
  Scenario: Sample
    Then check "1.01 a" first assertion
    And check "1.02 b" second assertion
`,
      'utf8',
    );
    const before = computePathHash(tmpFeature, '1.02');

    // Edit step 1 and immediately recompute. Force same mtime by
    // resetting it explicitly. The content-hash cache should still
    // invalidate.
    const stat = fs.statSync(tmpFeature);
    fs.writeFileSync(
      tmpFeature,
      `Feature: T
  Scenario: Sample
    Then check "1.01 a-MUTATED" first assertion
    And check "1.02 b" second assertion
`,
      'utf8',
    );
    // Restore mtime to simulate same-millisecond write
    fs.utimesSync(tmpFeature, stat.atime, stat.mtime);

    const after = computePathHash(tmpFeature, '1.02');
    assert.notEqual(
      after,
      before,
      'content-hashed cache should invalidate even when mtime is unchanged',
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Background steps are NOT included in pathHash input', () => {
  // If Background were included, hashing step 1.01 would include
  // "Given the local dev stack is up" + step 1.01. We don't have a
  // direct way to assert this from the outside, but we can verify
  // that a feature WITHOUT a Background gets the same hash as a
  // feature WITH a Background when both have identical scenario
  // steps.
  _clearPathHashCache();
  const baseline = computePathHash(fixturePath, '1.01');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pathhash-bg-'));
  try {
    const tmpFeature = path.join(tmpDir, 'sample-nobg.feature');
    let content = fs.readFileSync(fixturePath, 'utf8');
    // Strip the Background block.
    content = content.replace(/\n  Background:[\s\S]+?\n\n/, '\n\n');
    fs.writeFileSync(tmpFeature, content, 'utf8');

    _clearPathHashCache();
    const withoutBg = computePathHash(tmpFeature, '1.01');
    assert.equal(
      withoutBg,
      baseline,
      'pathHash should be identical with or without Background (Background is excluded)',
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
