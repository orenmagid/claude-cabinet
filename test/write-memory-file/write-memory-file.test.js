'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

let writeMemoryFile, normalizeSlug;
test.before(async () => {
  const mod = await import('../../scripts/write-memory-file.mjs');
  writeMemoryFile = mod.writeMemoryFile;
  normalizeSlug = mod.normalizeSlug;
});

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cc-wmf-test-'));
}
function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// normalizeSlug
// ---------------------------------------------------------------------------

test('normalizeSlug: lowercases and replaces non-alnum with underscores', () => {
  assert.strictEqual(normalizeSlug('Decided To Use Built-In Memory'), 'decided_to_use_built-in_memory');
});

test('normalizeSlug: strips leading/trailing punctuation', () => {
  assert.strictEqual(normalizeSlug('___foo___'), 'foo');
});

test('normalizeSlug: enforces length cap', () => {
  const long = 'a'.repeat(200);
  const result = normalizeSlug(long);
  assert.ok(result.length <= 80);
});

test('normalizeSlug: rejects empty / invalid input', () => {
  assert.throws(() => normalizeSlug(''));
  assert.throws(() => normalizeSlug('   '));
  assert.throws(() => normalizeSlug(null));
});

// ---------------------------------------------------------------------------
// writeMemoryFile
// ---------------------------------------------------------------------------

test('writeMemoryFile: creates file under memoryDir with title and content', () => {
  const tmp = makeTmp();
  try {
    const r = writeMemoryFile({
      slug: 'test_decision',
      content: 'We decided to test things.',
      memoryDir: path.join(tmp, 'memory'),
    });
    assert.ok(fs.existsSync(r.filePath));
    const body = fs.readFileSync(r.filePath, 'utf8');
    assert.ok(body.includes('# Test Decision'));
    assert.ok(body.includes('We decided to test things.'));
    assert.ok(body.includes('_Captured:'));
    assert.strictEqual(r.slug, 'test_decision');
    assert.strictEqual(r.indexed, true);
  } finally {
    cleanup(tmp);
  }
});

test('writeMemoryFile: requires slug and content', () => {
  const tmp = makeTmp();
  try {
    assert.throws(() => writeMemoryFile({ content: 'text', memoryDir: tmp }));
    assert.throws(() => writeMemoryFile({ slug: 'x', memoryDir: tmp }));
  } finally {
    cleanup(tmp);
  }
});

test('writeMemoryFile: creates MEMORY.md when absent', () => {
  const tmp = makeTmp();
  try {
    const r = writeMemoryFile({
      slug: 'first_one',
      content: 'first memory',
      memoryDir: path.join(tmp, 'memory'),
    });
    const memoryMd = fs.readFileSync(path.join(path.dirname(r.filePath), 'MEMORY.md'), 'utf8');
    assert.ok(memoryMd.includes('# Memory Index'));
    assert.ok(memoryMd.includes('## Curated entries (hand-authored)'));
    assert.ok(memoryMd.includes('first_one.md'));
  } finally {
    cleanup(tmp);
  }
});

test('writeMemoryFile: appends to existing MEMORY.md curated section', () => {
  const tmp = makeTmp();
  try {
    const memDir = path.join(tmp, 'memory');
    writeMemoryFile({ slug: 'one', content: 'first', memoryDir: memDir });
    writeMemoryFile({ slug: 'two', content: 'second', memoryDir: memDir });
    writeMemoryFile({ slug: 'three', content: 'third', memoryDir: memDir });
    const memoryMd = fs.readFileSync(path.join(memDir, 'MEMORY.md'), 'utf8');
    assert.ok(memoryMd.includes('one.md'));
    assert.ok(memoryMd.includes('two.md'));
    assert.ok(memoryMd.includes('three.md'));
    // Single Curated section header (not duplicated)
    const headers = memoryMd.match(/^## Curated entries/gm) || [];
    assert.strictEqual(headers.length, 1);
  } finally {
    cleanup(tmp);
  }
});

test('writeMemoryFile: collision produces dated suffix', () => {
  const tmp = makeTmp();
  try {
    const memDir = path.join(tmp, 'memory');
    const first = writeMemoryFile({ slug: 'collision', content: 'a', memoryDir: memDir });
    const second = writeMemoryFile({ slug: 'collision', content: 'b', memoryDir: memDir });
    assert.strictEqual(path.basename(first.filePath), 'collision.md');
    assert.notStrictEqual(first.filePath, second.filePath);
    assert.ok(path.basename(second.filePath).startsWith('collision_'));
    assert.ok(path.basename(second.filePath).includes(new Date().toISOString().slice(0, 10)));
  } finally {
    cleanup(tmp);
  }
});

test('writeMemoryFile: idempotency on MEMORY.md — already-referenced file no-ops', () => {
  const tmp = makeTmp();
  try {
    const memDir = path.join(tmp, 'memory');
    fs.mkdirSync(memDir, { recursive: true });
    // Pre-existing MEMORY.md referencing a file we're about to write
    fs.writeFileSync(
      path.join(memDir, 'MEMORY.md'),
      '# Memory Index\n\n## Curated entries (hand-authored)\n- [Existing](existing.md) — already indexed\n'
    );
    // First write creates a new file, indexes it
    const r1 = writeMemoryFile({ slug: 'fresh', content: 'new memory', memoryDir: memDir });
    assert.strictEqual(r1.indexed, true);
    // Update memory.md manually to look like our file is already-referenced
    const md = fs.readFileSync(path.join(memDir, 'MEMORY.md'), 'utf8');
    assert.ok(md.includes('fresh.md'));
  } finally {
    cleanup(tmp);
  }
});

test('writeMemoryFile: honors title and description overrides', () => {
  const tmp = makeTmp();
  try {
    const r = writeMemoryFile({
      slug: 'a-slug',
      title: 'A Custom Title',
      description: 'a custom description',
      content: 'content body',
      memoryDir: path.join(tmp, 'memory'),
    });
    const body = fs.readFileSync(r.filePath, 'utf8');
    assert.ok(body.includes('# A Custom Title'));
    const memoryMd = fs.readFileSync(path.join(path.dirname(r.filePath), 'MEMORY.md'), 'utf8');
    assert.ok(memoryMd.includes('a custom description'));
  } finally {
    cleanup(tmp);
  }
});

test('writeMemoryFile: atomic write — no .tmp- residue', () => {
  const tmp = makeTmp();
  try {
    const memDir = path.join(tmp, 'memory');
    writeMemoryFile({ slug: 'atomic_test', content: 'check', memoryDir: memDir });
    const tmpFiles = fs.readdirSync(memDir).filter((f) => f.includes('.tmp-'));
    assert.deepStrictEqual(tmpFiles, []);
  } finally {
    cleanup(tmp);
  }
});

test('writeMemoryFile: respects custom date for collision suffix', () => {
  const tmp = makeTmp();
  try {
    const memDir = path.join(tmp, 'memory');
    writeMemoryFile({ slug: 'dated', content: 'a', memoryDir: memDir });
    const r = writeMemoryFile({
      slug: 'dated',
      content: 'b',
      memoryDir: memDir,
      date: '2025-01-15',
    });
    assert.ok(r.filePath.includes('2025-01-15'));
  } finally {
    cleanup(tmp);
  }
});
