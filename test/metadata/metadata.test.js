'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const meta = require('../../lib/metadata');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cc-meta-test-'));
}
function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('write + read round-trip', () => {
  const tmp = makeTmp();
  try {
    meta.write(tmp, { foo: 1, bar: 'two' });
    assert.deepStrictEqual(meta.read(tmp), { foo: 1, bar: 'two' });
  } finally {
    cleanup(tmp);
  }
});

test('read returns null when neither .ccrc.json nor .corrc.json exists', () => {
  const tmp = makeTmp();
  try {
    assert.strictEqual(meta.read(tmp), null);
  } finally {
    cleanup(tmp);
  }
});

test('merge: preserves unknown top-level keys when adding new ones', () => {
  const tmp = makeTmp();
  try {
    meta.write(tmp, { foo: 1, migrated_from_omega: { state: 'complete' } });
    const merged = meta.merge(tmp, { newField: 'hello' });
    assert.deepStrictEqual(merged, {
      foo: 1,
      migrated_from_omega: { state: 'complete' },
      newField: 'hello',
    });
    assert.deepStrictEqual(meta.read(tmp), merged);
  } finally {
    cleanup(tmp);
  }
});

test('merge: overwrites colliding keys (shallow merge semantics)', () => {
  const tmp = makeTmp();
  try {
    meta.write(tmp, { state: 'old', other: 'kept' });
    meta.merge(tmp, { state: 'new' });
    assert.deepStrictEqual(meta.read(tmp), { state: 'new', other: 'kept' });
  } finally {
    cleanup(tmp);
  }
});

test('merge: works on empty .ccrc.json (no existing file)', () => {
  const tmp = makeTmp();
  try {
    const merged = meta.merge(tmp, { fresh: true });
    assert.deepStrictEqual(merged, { fresh: true });
  } finally {
    cleanup(tmp);
  }
});

test('create: preserves unknown top-level keys across (re)installs', () => {
  const tmp = makeTmp();
  try {
    meta.write(tmp, {
      version: '0.26.0',
      modules: { 'old-module': true },
      migrated_from_omega: {
        state: 'complete',
        date: '2026-05-27',
        backupDir: '~/.claude-cabinet/migration-backup-2026-05-27',
      },
    });

    const result = meta.create(tmp, {
      modules: ['session-loop', 'hooks'],
      skipped: { audit: 'opted out' },
      version: '0.27.0',
      manifest: { 'lib/cli.js': 'abc123' },
    });

    assert.ok(result.migrated_from_omega, 'migrated_from_omega survived create()');
    assert.strictEqual(result.migrated_from_omega.state, 'complete');
    assert.strictEqual(result.version, '0.27.0');
    assert.deepStrictEqual(result.modules, { 'session-loop': true, hooks: true });
    assert.deepStrictEqual(result.skipped, { audit: 'opted out' });
  } finally {
    cleanup(tmp);
  }
});

test('create: resets modules/skipped/manifest on each call (not merge)', () => {
  const tmp = makeTmp();
  try {
    meta.write(tmp, {
      version: '0.26.0',
      modules: { 'old-module': true, 'should-be-gone': true },
      skipped: { 'old-skip': 'reason' },
      manifest: { 'old-file': 'hash' },
    });

    const result = meta.create(tmp, {
      modules: ['session-loop'],
      skipped: {},
      version: '0.27.0',
      manifest: { 'new-file': 'newhash' },
    });

    assert.deepStrictEqual(result.modules, { 'session-loop': true });
    assert.deepStrictEqual(result.skipped, {});
    assert.deepStrictEqual(result.manifest, { 'new-file': 'newhash' });
    assert.ok(!result.modules['old-module'], 'old module should not survive');
    assert.ok(!result.skipped['old-skip'], 'old skip should not survive');
  } finally {
    cleanup(tmp);
  }
});

test('create: works on first install (no existing file)', () => {
  const tmp = makeTmp();
  try {
    const result = meta.create(tmp, {
      modules: ['session-loop'],
      skipped: {},
      version: '0.27.0',
      manifest: {},
    });
    assert.strictEqual(result.version, '0.27.0');
    assert.deepStrictEqual(result.modules, { 'session-loop': true });
    assert.strictEqual(result.migrated_from_omega, undefined);
  } finally {
    cleanup(tmp);
  }
});
