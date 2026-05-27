'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  migrateFromOmega,
  canonicalizeProjectKey,
  PREAMBLE_MARKER,
} = require('../../lib/migrate-from-omega');

const FAKE_OMEGA = path.join(__dirname, 'fake-omega.js');
const FAKE_OMEGA_MISSING = path.join(__dirname, 'fake-omega-nonexistent.js');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cc-mfo-test-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function runOpts(extra = {}) {
  const tmp = makeTmp();
  const outputDir = path.join(tmp, 'memory');
  return {
    cleanup: () => cleanup(tmp),
    opts: {
      omegaBin: FAKE_OMEGA,
      outputDir,
      currentProject: 'claude-cabinet',
      homeDir: tmp,
      cwd: tmp,
      ...extra,
    },
    tmp,
    outputDir,
  };
}

// ---------------------------------------------------------------------------
// Unit tests: canonicalizeProjectKey
// ---------------------------------------------------------------------------

test('canonicalizeProjectKey: null project → unscoped', () => {
  assert.deepStrictEqual(canonicalizeProjectKey(null), { canonical: null, kind: 'unscoped' });
  assert.deepStrictEqual(canonicalizeProjectKey(''), { canonical: null, kind: 'unscoped' });
});

test('canonicalizeProjectKey: bare slug stays bare', () => {
  assert.deepStrictEqual(canonicalizeProjectKey('claude-cabinet', { homeDir: '/Users/test' }), {
    canonical: 'claude-cabinet',
    kind: 'project',
  });
});

test('canonicalizeProjectKey: absolute path strips /Users/<user>/', () => {
  assert.deepStrictEqual(
    canonicalizeProjectKey('/Users/test/claude-cabinet', { homeDir: '/Users/test' }),
    { canonical: 'claude-cabinet', kind: 'project' }
  );
});

test('canonicalizeProjectKey: worktree path collapses to host project', () => {
  assert.deepStrictEqual(
    canonicalizeProjectKey('/Users/test/flow/.claude/worktrees/foo-abc', { homeDir: '/Users/test' }),
    { canonical: 'flow', kind: 'project' }
  );
});

test('canonicalizeProjectKey: subdir path collapses to top slug', () => {
  assert.deepStrictEqual(
    canonicalizeProjectKey('/Users/test/flow/areas/school', { homeDir: '/Users/test' }),
    { canonical: 'flow', kind: 'project' }
  );
});

test('canonicalizeProjectKey: agent paths bucket together', () => {
  assert.deepStrictEqual(canonicalizeProjectKey('agent-deadbeef'), { canonical: 'subagent-residue', kind: 'agent' });
  assert.deepStrictEqual(canonicalizeProjectKey('agent-a7a007c59fc2'), { canonical: 'subagent-residue', kind: 'agent' });
});

// ---------------------------------------------------------------------------
// Integration tests: migrateFromOmega
// ---------------------------------------------------------------------------

test('migrateFromOmega: no-omega when bin missing', async () => {
  const ctx = runOpts({ omegaBin: FAKE_OMEGA_MISSING });
  try {
    const r = await migrateFromOmega(ctx.opts);
    assert.strictEqual(r.migrated, 0);
    assert.strictEqual(r.reason, 'no-omega');
  } finally {
    ctx.cleanup();
  }
});

test('migrateFromOmega: empty DB writes minimal MEMORY.md with preamble', async () => {
  const ctx = runOpts();
  process.env.FAKE_OMEGA_FIXTURE = 'empty';
  try {
    const r = await migrateFromOmega(ctx.opts);
    assert.strictEqual(r.migrated, 0);
    assert.strictEqual(r.reason, 'empty-db');
    const memoryMd = fs.readFileSync(path.join(ctx.outputDir, 'MEMORY.md'), 'utf8');
    assert.ok(memoryMd.includes(PREAMBLE_MARKER));
    assert.ok(memoryMd.toLowerCase().includes('no prior memories'));
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    ctx.cleanup();
  }
});

test('migrateFromOmega: empty DB dry-run returns preview without writing', async () => {
  const ctx = runOpts({ dryRun: true });
  process.env.FAKE_OMEGA_FIXTURE = 'empty';
  try {
    const r = await migrateFromOmega(ctx.opts);
    assert.strictEqual(r.dryRun, true);
    assert.strictEqual(r.migrated, 0);
    assert.ok(r.memoryMdPreview);
    assert.strictEqual(fs.existsSync(ctx.outputDir), false);
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    ctx.cleanup();
  }
});

test('migrateFromOmega: small fixture writes topic files and valid MEMORY.md', async () => {
  const ctx = runOpts();
  process.env.FAKE_OMEGA_FIXTURE = 'small';
  try {
    const r = await migrateFromOmega(ctx.opts);
    assert.strictEqual(r.migrated, 8);

    const files = fs.readdirSync(ctx.outputDir).filter((f) => f.endsWith('.md'));
    assert.ok(files.includes('MEMORY.md'));
    assert.ok(files.includes('decisions.md'));
    assert.ok(files.includes('lessons.md'));
    assert.ok(files.includes('preferences.md'));
    assert.ok(files.includes('constraints.md'));

    const topicCount = files.filter((f) => f !== 'MEMORY.md').length;
    assert.ok(topicCount >= 4 && topicCount <= 9, `topic count ${topicCount} out of 4-9`);

    const memoryMd = fs.readFileSync(path.join(ctx.outputDir, 'MEMORY.md'), 'utf8');
    assert.ok(memoryMd.includes(PREAMBLE_MARKER));
    const lines = memoryMd.split('\n').length;
    const bytes = Buffer.byteLength(memoryMd, 'utf8');
    assert.ok(lines <= 200, `MEMORY.md lines: ${lines}`);
    assert.ok(bytes <= 25000, `MEMORY.md bytes: ${bytes}`);
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    ctx.cleanup();
  }
});

test('migrateFromOmega: multi-project — worktree/subdir collapse, agent isolates, null unscoped, others cross-project', async () => {
  const ctx = runOpts();
  process.env.FAKE_OMEGA_FIXTURE = 'multi';
  try {
    const r = await migrateFromOmega(ctx.opts);
    assert.strictEqual(r.migrated, 9);

    const files = fs.readdirSync(ctx.outputDir);
    assert.ok(files.includes('cross-flow.md'), 'cross-flow.md expected (per-project cross- file)');
    assert.ok(files.includes('unscoped.md'), 'unscoped.md expected');
    assert.ok(files.includes('subagent-residue.md'), 'subagent-residue.md expected');

    const decisions = fs.readFileSync(path.join(ctx.outputDir, 'decisions.md'), 'utf8');
    assert.ok(decisions.includes('mem-bbbbbbbbbb01'), 'bare cc memory missing from decisions');
    assert.ok(decisions.includes('mem-bbbbbbbbbb02'), 'abs-path cc memory missing from decisions');

    const lessons = fs.readFileSync(path.join(ctx.outputDir, 'lessons.md'), 'utf8');
    assert.ok(lessons.includes('mem-bbbbbbbbbb03'), 'worktree memory missing from lessons (should collapse)');
    assert.ok(lessons.includes('mem-bbbbbbbbbb04'), 'subdir memory missing from lessons (should collapse)');

    const cross = fs.readFileSync(path.join(ctx.outputDir, 'cross-flow.md'), 'utf8');
    assert.ok(cross.includes('mem-bbbbbbbbbb05'), 'flow bare in cross-flow.md');
    assert.ok(cross.includes('mem-bbbbbbbbbb06'), 'flow abs in cross-flow.md');
    assert.ok(cross.includes('mem-bbbbbbbbbb07'), 'flow subdir in cross-flow.md');

    const agent = fs.readFileSync(path.join(ctx.outputDir, 'subagent-residue.md'), 'utf8');
    assert.ok(agent.includes('mem-bbbbbbbbbb08'), 'agent memory missing');

    const unscoped = fs.readFileSync(path.join(ctx.outputDir, 'unscoped.md'), 'utf8');
    assert.ok(unscoped.includes('mem-bbbbbbbbbb09'), 'null-project memory missing from unscoped');
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    ctx.cleanup();
  }
});

test('migrateFromOmega: no memory appears in two topic files (dedup invariant)', async () => {
  const ctx = runOpts();
  process.env.FAKE_OMEGA_FIXTURE = 'multi';
  try {
    await migrateFromOmega(ctx.opts);
    const files = fs.readdirSync(ctx.outputDir).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md');
    const seen = new Map();
    for (const f of files) {
      const content = fs.readFileSync(path.join(ctx.outputDir, f), 'utf8');
      const ids = content.match(/mem-[a-f0-9]+/g) || [];
      for (const id of new Set(ids)) {
        if (seen.has(id)) {
          assert.fail(`memory ${id} appears in both ${seen.get(id)} and ${f}`);
        }
        seen.set(id, f);
      }
    }
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    ctx.cleanup();
  }
});

test('migrateFromOmega: oversized topics shard with recent/archive labels and stay within cap', async () => {
  const ctx = runOpts();
  process.env.FAKE_OMEGA_FIXTURE = 'oversized';
  try {
    const r = await migrateFromOmega(ctx.opts);
    assert.strictEqual(r.migrated, 80);

    const files = fs.readdirSync(ctx.outputDir);
    const hasShards = files.some((f) => /^(lessons|decisions)-(recent|archive)(-\d+)?\.md$/.test(f));
    assert.ok(hasShards, `expected sharded files; got: ${files.join(', ')}`);

    for (const f of files.filter((x) => x.endsWith('.md'))) {
      const bytes = fs.statSync(path.join(ctx.outputDir, f)).size;
      assert.ok(bytes <= 50000, `${f} is ${bytes} bytes (>50KB cap)`);
    }
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    ctx.cleanup();
  }
});

test('migrateFromOmega: idempotent — second run returns already-migrated', async () => {
  const ctx = runOpts();
  process.env.FAKE_OMEGA_FIXTURE = 'small';
  try {
    const first = await migrateFromOmega(ctx.opts);
    assert.strictEqual(first.migrated, 8);

    const second = await migrateFromOmega(ctx.opts);
    assert.strictEqual(second.migrated, 0);
    assert.strictEqual(second.reason, 'already-migrated');
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    ctx.cleanup();
  }
});

test('migrateFromOmega: force overrides already-migrated', async () => {
  const ctx = runOpts();
  process.env.FAKE_OMEGA_FIXTURE = 'small';
  try {
    await migrateFromOmega(ctx.opts);
    const r = await migrateFromOmega({ ...ctx.opts, force: true });
    assert.strictEqual(r.migrated, 8);
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    ctx.cleanup();
  }
});

test('migrateFromOmega: refuses on foreign content (existing decisions.md without preamble)', async () => {
  const ctx = runOpts();
  process.env.FAKE_OMEGA_FIXTURE = 'small';
  fs.mkdirSync(ctx.outputDir, { recursive: true });
  fs.writeFileSync(path.join(ctx.outputDir, 'decisions.md'), '# User wrote this\n');
  try {
    const r = await migrateFromOmega(ctx.opts);
    assert.strictEqual(r.migrated, 0);
    assert.ok(r.reason === 'partial-or-foreign' || r.reason === 'foreign-content');
    assert.strictEqual(fs.readFileSync(path.join(ctx.outputDir, 'decisions.md'), 'utf8'), '# User wrote this\n');
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    ctx.cleanup();
  }
});

test('migrateFromOmega: autoMemoryDirectory with literal ~ throws', async () => {
  const ctx = runOpts();
  const settingsPath = path.join(ctx.tmp, 'settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify({ autoMemoryDirectory: '~/somewhere' }));
  process.env.FAKE_OMEGA_FIXTURE = 'small';
  try {
    await assert.rejects(
      migrateFromOmega({ ...ctx.opts, outputDir: undefined, settingsPath }),
      /literal/i
    );
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    ctx.cleanup();
  }
});

test('migrateFromOmega: edges captured to edges.json sidecar', async () => {
  const ctx = runOpts();
  process.env.FAKE_OMEGA_FIXTURE = 'with-edges';
  try {
    const r = await migrateFromOmega(ctx.opts);
    assert.strictEqual(r.migrated, 2);
    assert.ok(r.edges >= 2, `expected edges captured, got ${r.edges}`);
    const edgesPath = path.join(ctx.outputDir, 'edges.json');
    assert.ok(fs.existsSync(edgesPath), 'edges.json sidecar missing');
    const edges = JSON.parse(fs.readFileSync(edgesPath, 'utf8'));
    assert.ok(edges.count >= 2);
    assert.ok(Array.isArray(edges.edges));
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    ctx.cleanup();
  }
});

test('migrateFromOmega: dry-run with non-empty fixture does not write files', async () => {
  const ctx = runOpts({ dryRun: true });
  process.env.FAKE_OMEGA_FIXTURE = 'small';
  try {
    const r = await migrateFromOmega(ctx.opts);
    assert.strictEqual(r.dryRun, true);
    assert.strictEqual(r.migrated, 8);
    assert.ok(r.topicFiles && r.topicFiles.length >= 4);
    assert.ok(r.memoryMdPreview.includes(PREAMBLE_MARKER));
    assert.strictEqual(fs.existsSync(ctx.outputDir), false);
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    ctx.cleanup();
  }
});

test('migrateFromOmega: content-hash invariant — every omega memory ID appears in output', async () => {
  const ctx = runOpts();
  process.env.FAKE_OMEGA_FIXTURE = 'multi';
  try {
    await migrateFromOmega(ctx.opts);
    const expectedIds = [
      'mem-bbbbbbbbbb01', 'mem-bbbbbbbbbb02', 'mem-bbbbbbbbbb03', 'mem-bbbbbbbbbb04',
      'mem-bbbbbbbbbb05', 'mem-bbbbbbbbbb06', 'mem-bbbbbbbbbb07', 'mem-bbbbbbbbbb08',
      'mem-bbbbbbbbbb09',
    ];
    const allContent = fs
      .readdirSync(ctx.outputDir)
      .filter((f) => f.endsWith('.md') && f !== 'MEMORY.md')
      .map((f) => fs.readFileSync(path.join(ctx.outputDir, f), 'utf8'))
      .join('\n');
    for (const id of expectedIds) {
      assert.ok(allContent.includes(id), `missing memory ${id} after migration`);
    }
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    ctx.cleanup();
  }
});
