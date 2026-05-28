'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { migrateAllConsumers, isHomeOrAncestor, SKIP_REASONS } = require('../../scripts/migrate-all-consumers');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cc-mac-test-'));
}
function cleanup(...d) {
  for (const x of d) fs.rmSync(x, { recursive: true, force: true });
}
function writeRegistry(p, projects) {
  fs.writeFileSync(p, JSON.stringify({ projects }, null, 2));
}

// ---------------------------------------------------------------------------
// isHomeOrAncestor
// ---------------------------------------------------------------------------

test('isHomeOrAncestor: home dir itself → true', () => {
  assert.strictEqual(isHomeOrAncestor('/Users/x', '/Users/x'), true);
});

test('isHomeOrAncestor: ancestor of home → true', () => {
  assert.strictEqual(isHomeOrAncestor('/Users', '/Users/x'), true);
  assert.strictEqual(isHomeOrAncestor('/', '/Users/x'), true);
});

test('isHomeOrAncestor: descendant (real project) → false', () => {
  assert.strictEqual(isHomeOrAncestor('/Users/x/flow', '/Users/x'), false);
  assert.strictEqual(isHomeOrAncestor('/Users/x/a/b', '/Users/x'), false);
});

test('isHomeOrAncestor: sibling/unrelated → false', () => {
  assert.strictEqual(isHomeOrAncestor('/Users/y', '/Users/x'), false);
  assert.strictEqual(isHomeOrAncestor('/Users/xyz', '/Users/x'), false); // prefix but not ancestor
});

// ---------------------------------------------------------------------------
// migrateAllConsumers — walk logic with injected runMigrate
// ---------------------------------------------------------------------------

function setup() {
  const home = makeTmp();
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  const registryPath = path.join(home, '.claude', 'cc-registry.json');
  const walkStatePath = path.join(home, 'walk-state.json');
  return { home, registryPath, walkStatePath };
}

// Make a real existing project dir under home with an optional ccrc state.
function makeProject(home, name, { migrated = false } = {}) {
  const p = path.join(home, name);
  fs.mkdirSync(p, { recursive: true });
  if (migrated) {
    fs.writeFileSync(path.join(p, '.ccrc.json'), JSON.stringify({ migrated_from_omega: { state: 'complete', date: '2026-05-28' } }));
  }
  return p;
}

test('refuses home dir and ancestor entries', async () => {
  const { home, registryPath, walkStatePath } = setup();
  try {
    const flow = makeProject(home, 'flow');
    writeRegistry(registryPath, [
      { path: home, name: 'home-bogus' },
      { path: path.dirname(home), name: 'ancestor-bogus' },
      { path: flow, name: 'flow' },
    ]);
    const runMigrate = async () => ({ state: { state: 'complete' } });
    const report = await migrateAllConsumers({ homeDir: home, registryPath, walkStatePath, runMigrate, confirm: () => true });

    const homeSkip = report.skipped.find((s) => s.name === 'home-bogus');
    const ancestorSkip = report.skipped.find((s) => s.name === 'ancestor-bogus');
    assert.strictEqual(homeSkip.reason, SKIP_REASONS.HOME);
    assert.strictEqual(ancestorSkip.reason, SKIP_REASONS.HOME);
    assert.ok(report.migrated.find((m) => m.name === 'flow'));
  } finally {
    cleanup(home);
  }
});

test('skips missing paths', async () => {
  const { home, registryPath, walkStatePath } = setup();
  try {
    writeRegistry(registryPath, [{ path: path.join(home, 'ghost'), name: 'ghost' }]);
    const report = await migrateAllConsumers({ homeDir: home, registryPath, walkStatePath, runMigrate: async () => ({}), confirm: () => true });
    assert.strictEqual(report.skipped[0].reason, SKIP_REASONS.MISSING);
  } finally {
    cleanup(home);
  }
});

test('skips already-migrated projects', async () => {
  const { home, registryPath, walkStatePath } = setup();
  try {
    const done = makeProject(home, 'done-proj', { migrated: true });
    writeRegistry(registryPath, [{ path: done, name: 'done-proj' }]);
    let called = false;
    const runMigrate = async () => { called = true; return {}; };
    const report = await migrateAllConsumers({ homeDir: home, registryPath, walkStatePath, runMigrate, confirm: () => true });
    assert.strictEqual(report.skipped[0].reason, SKIP_REASONS.MIGRATED);
    assert.strictEqual(called, false, 'should not run migrate on already-migrated');
  } finally {
    cleanup(home);
  }
});

test('skips no-omega projects (dry-run reports no-omega)', async () => {
  const { home, registryPath, walkStatePath } = setup();
  try {
    const p = makeProject(home, 'no-omega-proj');
    writeRegistry(registryPath, [{ path: p, name: 'no-omega-proj' }]);
    const runMigrate = async (o) => (o.dryRun ? { reason: 'no-omega', migrated: 0 } : { state: { state: 'complete' } });
    const report = await migrateAllConsumers({ homeDir: home, registryPath, walkStatePath, runMigrate, confirm: () => true });
    assert.strictEqual(report.skipped[0].reason, SKIP_REASONS.NO_OMEGA);
  } finally {
    cleanup(home);
  }
});

test('user-declined is recorded', async () => {
  const { home, registryPath, walkStatePath } = setup();
  try {
    const p = makeProject(home, 'declined-proj');
    writeRegistry(registryPath, [{ path: p, name: 'declined-proj' }]);
    const runMigrate = async (o) => (o.dryRun ? { steps: [1, 2, 3] } : { state: { state: 'complete' } });
    const report = await migrateAllConsumers({ homeDir: home, registryPath, walkStatePath, runMigrate, confirm: () => false });
    assert.strictEqual(report.skipped[0].reason, SKIP_REASONS.DECLINED);
  } finally {
    cleanup(home);
  }
});

test('migrates confirmed consumers; total accounts for every registry entry', async () => {
  const { home, registryPath, walkStatePath } = setup();
  try {
    const a = makeProject(home, 'a');
    const b = makeProject(home, 'b');
    const c = makeProject(home, 'c', { migrated: true });
    writeRegistry(registryPath, [
      { path: home, name: 'home' },
      { path: a, name: 'a' },
      { path: b, name: 'b' },
      { path: c, name: 'c' },
      { path: path.join(home, 'ghost'), name: 'ghost' },
    ]);
    const runMigrate = async (o) => (o.dryRun ? { steps: [1] } : { state: { state: 'complete' } });
    const report = await migrateAllConsumers({ homeDir: home, registryPath, walkStatePath, runMigrate, confirm: () => true });

    assert.strictEqual(report.migrated.length, 2); // a, b
    assert.strictEqual(report.failed.length, 0);
    const accounted = report.migrated.length + report.skipped.length + report.failed.length;
    assert.strictEqual(accounted, report.total, 'total must equal registry size');
    assert.strictEqual(report.total, 5);
  } finally {
    cleanup(home);
  }
});

test('failed migration is captured with error', async () => {
  const { home, registryPath, walkStatePath } = setup();
  try {
    const p = makeProject(home, 'boom');
    writeRegistry(registryPath, [{ path: p, name: 'boom' }]);
    const runMigrate = async (o) => {
      if (o.dryRun) return { steps: [1] };
      throw new Error('migration exploded');
    };
    const report = await migrateAllConsumers({ homeDir: home, registryPath, walkStatePath, runMigrate, confirm: () => true });
    assert.strictEqual(report.failed[0].reason, 'migration exploded');
  } finally {
    cleanup(home);
  }
});

test('walk-state persists and resumes (skips already-processed on re-run)', async () => {
  const { home, registryPath, walkStatePath } = setup();
  try {
    const a = makeProject(home, 'a');
    writeRegistry(registryPath, [{ path: a, name: 'a' }]);
    let runCount = 0;
    const runMigrate = async (o) => { if (!o.dryRun) runCount++; return o.dryRun ? { steps: [1] } : { state: { state: 'complete' } }; };

    await migrateAllConsumers({ homeDir: home, registryPath, walkStatePath, runMigrate, confirm: () => true });
    assert.strictEqual(runCount, 1);
    assert.ok(fs.existsSync(walkStatePath), 'walk-state written');

    // Re-run: should resume past the already-processed consumer.
    const report2 = await migrateAllConsumers({ homeDir: home, registryPath, walkStatePath, runMigrate, confirm: () => true });
    assert.strictEqual(runCount, 1, 'should not re-run migration on resume');
    assert.ok(report2.migrated[0].resumed, 'resumed flag set');
  } finally {
    cleanup(home);
  }
});

test('walk-level dry-run does not call real migrate', async () => {
  const { home, registryPath, walkStatePath } = setup();
  try {
    const a = makeProject(home, 'a');
    writeRegistry(registryPath, [{ path: a, name: 'a' }]);
    let realRun = false;
    const runMigrate = async (o) => { if (!o.dryRun) realRun = true; return o.dryRun ? { steps: [1] } : { state: { state: 'complete' } }; };
    const report = await migrateAllConsumers({ homeDir: home, registryPath, walkStatePath, runMigrate, confirm: () => true, dryRun: true });
    assert.strictEqual(realRun, false, 'walk dry-run must not perform real migration');
    assert.strictEqual(report.migrated[0].reason, 'dry-run');
    assert.strictEqual(fs.existsSync(walkStatePath), false, 'walk dry-run must NOT persist walk-state (would poison a later real run)');
  } finally {
    cleanup(home);
  }
});

test('empty / missing registry → zero total, no crash', async () => {
  const { home, walkStatePath } = setup();
  try {
    const report = await migrateAllConsumers({ homeDir: home, registryPath: path.join(home, 'nope.json'), walkStatePath, runMigrate: async () => ({}), confirm: () => true });
    assert.strictEqual(report.total, 0);
    assert.deepStrictEqual(report.migrated, []);
  } finally {
    cleanup(home);
  }
});
