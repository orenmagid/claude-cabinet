import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateCheckResult } from '../src/schema.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fix = (id) => readFileSync(join(__dirname, 'fixtures', `${id}.json`), 'utf8');
const ok = (id) => ({ code: 0, stdout: fix(id), stderr: '', timedOut: false });

// --- unlighthouse ---
import * as unlighthouse from '../src/checks/unlighthouse.mjs';

test('unlighthouse: normalize fixture aggregates per-route scores', () => {
  const r = unlighthouse.normalize(ok('unlighthouse'), 60000);
  const { valid, errors } = validateCheckResult(r);
  assert.ok(valid, errors.join('; '));
  assert.equal(r.checkId, 'unlighthouse');
  assert.equal(typeof r.score, 'number');
  assert.ok(r.findings.some(f => f.message.includes('/contact')), 'low-scoring route should appear');
});

// --- website-carbon ---
import * as websiteCarbon from '../src/checks/website-carbon.mjs';

test('website-carbon: small page → pass with low CO2', () => {
  const r = websiteCarbon.normalize({ bytes: 50_000 }, 500);
  const { valid, errors } = validateCheckResult(r);
  assert.ok(valid, errors.join('; '));
  assert.equal(r.status, 'pass');
  assert.ok(r.findings[0].message.includes('g CO2'));
  assert.ok(r.score > 90, `small page should score high, got ${r.score}`);
});

test('website-carbon: huge page → fail with high CO2', () => {
  const r = websiteCarbon.normalize({ bytes: 10_000_000 }, 800);
  const { valid, errors } = validateCheckResult(r);
  assert.ok(valid, errors.join('; '));
  assert.equal(r.status, 'fail');
  assert.ok(r.score < 50, `huge page should score low, got ${r.score}`);
});

test('website-carbon: no external API needed (pure local calc)', () => {
  const r = websiteCarbon.normalize({ bytes: 200_000 }, 300);
  assert.ok(r.findings[0].message.includes('g CO2'), 'should compute CO2 locally');
});
