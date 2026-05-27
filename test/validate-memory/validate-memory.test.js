'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

let validateMemoryDir;
test.before(async () => {
  const mod = await import('../../scripts/validate-memory.mjs');
  validateMemoryDir = mod.validateMemoryDir;
});

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cc-vm-test-'));
}
function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeFiles(memoryDir, files) {
  fs.mkdirSync(memoryDir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(path.join(memoryDir, name), body, 'utf8');
  }
}

test('validateMemoryDir: passes on a well-formed dir', () => {
  const tmp = makeTmp();
  try {
    const memDir = path.join(tmp, 'memory');
    writeFiles(memDir, {
      'MEMORY.md':
        '# Memory Index\n\n## Curated entries\n- [One](one.md) — first\n- [Two](two.md) — second\n',
      'one.md': '# One\n\ncontent',
      'two.md': '# Two\n\ncontent',
    });
    const { violations, warnings } = validateMemoryDir({ memoryDir: memDir });
    assert.deepStrictEqual(violations, []);
    assert.deepStrictEqual(warnings, []);
  } finally {
    cleanup(tmp);
  }
});

test('validateMemoryDir: missing memory dir → violation', () => {
  const { violations } = validateMemoryDir({ memoryDir: '/nonexistent/path/abc' });
  assert.strictEqual(violations.length, 1);
  assert.match(violations[0], /does not exist/);
});

test('validateMemoryDir: missing MEMORY.md → violation', () => {
  const tmp = makeTmp();
  try {
    const memDir = path.join(tmp, 'memory');
    writeFiles(memDir, { 'one.md': '# One' });
    const { violations } = validateMemoryDir({ memoryDir: memDir });
    assert.ok(violations.some((v) => /MEMORY\.md missing/.test(v)));
  } finally {
    cleanup(tmp);
  }
});

test('validateMemoryDir: orphan memory file → violation', () => {
  const tmp = makeTmp();
  try {
    const memDir = path.join(tmp, 'memory');
    writeFiles(memDir, {
      'MEMORY.md': '# Memory Index\n\n- [One](one.md) — one\n',
      'one.md': '# One',
      'orphan.md': '# Orphan',
    });
    const { violations } = validateMemoryDir({ memoryDir: memDir });
    assert.ok(violations.some((v) => /orphan memory file: orphan\.md/.test(v)));
  } finally {
    cleanup(tmp);
  }
});

test('validateMemoryDir: broken reference (indexed but missing) → violation', () => {
  const tmp = makeTmp();
  try {
    const memDir = path.join(tmp, 'memory');
    writeFiles(memDir, {
      'MEMORY.md': '# Memory Index\n\n- [Missing](missing.md) — file does not exist\n',
    });
    const { violations } = validateMemoryDir({ memoryDir: memDir });
    assert.ok(violations.some((v) => /broken reference.*missing\.md/.test(v)));
  } finally {
    cleanup(tmp);
  }
});

test('validateMemoryDir: MEMORY.md exceeds 200 lines → violation', () => {
  const tmp = makeTmp();
  try {
    const memDir = path.join(tmp, 'memory');
    const bigIndex = '# Memory Index\n' + 'x\n'.repeat(250);
    writeFiles(memDir, { 'MEMORY.md': bigIndex });
    const { violations } = validateMemoryDir({ memoryDir: memDir });
    assert.ok(violations.some((v) => /MEMORY\.md exceeds line cap/.test(v)));
  } finally {
    cleanup(tmp);
  }
});

test('validateMemoryDir: MEMORY.md exceeds 25KB → violation', () => {
  const tmp = makeTmp();
  try {
    const memDir = path.join(tmp, 'memory');
    const bigIndex = '# Memory Index\n\n' + 'x'.repeat(26_000);
    writeFiles(memDir, { 'MEMORY.md': bigIndex });
    const { violations } = validateMemoryDir({ memoryDir: memDir });
    assert.ok(violations.some((v) => /exceeds byte cap/.test(v)));
  } finally {
    cleanup(tmp);
  }
});

test('validateMemoryDir: topic file >50KB → violation', () => {
  const tmp = makeTmp();
  try {
    const memDir = path.join(tmp, 'memory');
    writeFiles(memDir, {
      'MEMORY.md': '# Memory Index\n\n- **lessons.md** (1) — desc\n',
      'lessons.md': '# lessons\n' + 'x'.repeat(51_000),
    });
    const { violations } = validateMemoryDir({ memoryDir: memDir });
    assert.ok(violations.some((v) => /topic file too large: lessons\.md/.test(v)));
  } finally {
    cleanup(tmp);
  }
});

test('validateMemoryDir: curated file >50KB → NO violation (no cap on curated)', () => {
  const tmp = makeTmp();
  try {
    const memDir = path.join(tmp, 'memory');
    writeFiles(memDir, {
      'MEMORY.md': '# Memory Index\n\n- [Big curated](my_big_curated_memory.md) — desc\n',
      'my_big_curated_memory.md': '# Big\n' + 'x'.repeat(60_000),
    });
    const { violations } = validateMemoryDir({ memoryDir: memDir });
    assert.deepStrictEqual(violations, []);
  } finally {
    cleanup(tmp);
  }
});

test('validateMemoryDir: parses both index formats (bold and link)', () => {
  const tmp = makeTmp();
  try {
    const memDir = path.join(tmp, 'memory');
    writeFiles(memDir, {
      'MEMORY.md':
        '# Memory Index\n\n## Topic files\n- **decisions.md** (5) — migrated\n\n## Curated\n- [Curated](my_note.md) — desc\n',
      'decisions.md': '# decisions',
      'my_note.md': '# note',
    });
    const { violations } = validateMemoryDir({ memoryDir: memDir });
    assert.deepStrictEqual(violations, []);
  } finally {
    cleanup(tmp);
  }
});

test('validateMemoryDir: ignores edges.json and .DS_Store', () => {
  const tmp = makeTmp();
  try {
    const memDir = path.join(tmp, 'memory');
    writeFiles(memDir, {
      'MEMORY.md': '# Memory Index\n\n- [One](one.md) — one\n',
      'one.md': '# One',
      'edges.json': '{"edges": []}',
    });
    fs.writeFileSync(path.join(memDir, '.DS_Store'), '');
    const { violations } = validateMemoryDir({ memoryDir: memDir });
    assert.deepStrictEqual(violations, []);
  } finally {
    cleanup(tmp);
  }
});

test('validateMemoryDir: against the real CC memory dir passes (post-Phase-2)', () => {
  const realDir = path.join(os.homedir(), '.claude', 'projects', '-Users-orenmagid-claude-cabinet', 'memory');
  if (!fs.existsSync(realDir)) {
    // Skip if not on the dogfood machine
    return;
  }
  const { violations } = validateMemoryDir({ memoryDir: realDir });
  assert.deepStrictEqual(violations, [], `real CC dir should pass validation; got: ${violations.join('; ')}`);
});
