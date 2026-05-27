'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  migrateMemoryCmd,
  STEPS,
  _internals,
} = require('../../lib/migrate-memory-cmd');
const metadata = require('../../lib/metadata');

const FAKE_OMEGA = path.join(__dirname, '..', 'migrate-from-omega', 'fake-omega.js');

function makeTmpHome() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-mmc-home-'));
  fs.mkdirSync(path.join(tmp, '.claude'), { recursive: true });
  return tmp;
}

function makeTmpCwd() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-mmc-cwd-'));
  return tmp;
}

function cleanup(...dirs) {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// removeOmegaFromMcpServers unit
// ---------------------------------------------------------------------------

test('removeOmegaFromMcpServers: removes by command path', () => {
  const { newServers, removed } = _internals.removeOmegaFromMcpServers({
    omega: { command: '/path/to/omega-venv/bin/omega' },
    other: { command: '/other' },
  });
  assert.deepStrictEqual(removed, ['omega']);
  assert.deepStrictEqual(newServers, { other: { command: '/other' } });
});

test('removeOmegaFromMcpServers: removes by alternative key name', () => {
  const { newServers, removed } = _internals.removeOmegaFromMcpServers({
    'omega-memory': { command: '/other/path' },
    pibdb: { command: 'node' },
  });
  assert.deepStrictEqual(removed, ['omega-memory']);
  assert.deepStrictEqual(Object.keys(newServers), ['pibdb']);
});

test('removeOmegaFromMcpServers: null/empty input safe', () => {
  assert.deepStrictEqual(_internals.removeOmegaFromMcpServers(null).removed, []);
  assert.deepStrictEqual(_internals.removeOmegaFromMcpServers({}).removed, []);
});

// ---------------------------------------------------------------------------
// Full orchestrator integration
// ---------------------------------------------------------------------------

function seedFullOmegaState(homeDir, cwd) {
  // Seed ~/.claude/settings.json with omega hooks + omega MCP entry
  fs.writeFileSync(
    path.join(homeDir, '.claude', 'settings.json'),
    JSON.stringify({
      hooks: {
        SessionStart: [
          {
            matcher: '*',
            hooks: [
              { type: 'command', command: '/home/x/.claude-cabinet/omega-venv/bin/fast_hook session_start' },
              { type: 'command', command: '/other/non-omega-hook' },
            ],
          },
        ],
        Stop: [{ hooks: [{ command: '/home/x/.claude-cabinet/omega-venv/bin/fast_hook stop' }] }],
      },
      mcpServers: {
        omega: { command: '/home/x/.claude-cabinet/omega-venv/bin/omega', args: ['serve'] },
        pibdb: { command: 'node' },
      },
    })
  );

  // Seed ~/.claude.json with omega-memory entry (different key name)
  fs.writeFileSync(
    path.join(homeDir, '.claude.json'),
    JSON.stringify({
      mcpServers: {
        'omega-memory': { command: '/home/x/.claude-cabinet/omega-venv/bin/omega' },
      },
    })
  );

  // Seed ~/.claude/CLAUDE.md with OMEGA block
  fs.writeFileSync(
    path.join(homeDir, '.claude', 'CLAUDE.md'),
    `# Global CLAUDE.md

<!-- OMEGA:BEGIN -->
## Memory (OMEGA)
Call omega_welcome().
<!-- OMEGA:END -->

Other content here.
`
  );

  // Seed project .ccrc.json so metadata.read works
  fs.writeFileSync(path.join(cwd, '.ccrc.json'), JSON.stringify({ version: '0.26.0' }));

  // Seed project .claude/settings.json with omega-memory-guard hook
  fs.mkdirSync(path.join(cwd, '.claude'), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, '.claude', 'settings.json'),
    JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: 'Write|Edit', hooks: [{ type: 'command', command: '.claude/hooks/omega-memory-guard.sh' }] },
        ],
      },
    })
  );

  // Seed installed memory skill (upstream omega version markers)
  fs.mkdirSync(path.join(cwd, '.claude', 'skills', 'memory'), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, '.claude', 'skills', 'memory', 'SKILL.md'),
    '# memory\nUses cabinet-memory-adapter.py and omega-venv/bin/python3 via omega.bridge.\n'
  );
}

test('migrateMemoryCmd: dry-run reports all steps without mutating', async () => {
  const home = makeTmpHome();
  const cwd = makeTmpCwd();
  try {
    seedFullOmegaState(home, cwd);
    process.env.FAKE_OMEGA_FIXTURE = 'small';

    const claudeMdBefore = fs.readFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'utf8');
    const settingsBefore = fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8');

    const result = await migrateMemoryCmd({
      homeDir: home,
      cwd,
      dryRun: true,
      verbose: false,
    });

    assert.strictEqual(result.dryRun, true);
    assert.strictEqual(result.skipped, false);
    assert.ok(result.steps.length >= STEPS.length - 1);

    // No mutations to user state files
    assert.strictEqual(fs.readFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'utf8'), claudeMdBefore);
    assert.strictEqual(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'), settingsBefore);

    // No backup dir written
    const backups = fs.existsSync(path.join(home, '.claude-cabinet')) ? fs.readdirSync(path.join(home, '.claude-cabinet')) : [];
    assert.deepStrictEqual(backups, []);

    // .ccrc.json untouched
    const meta = metadata.read(cwd);
    assert.strictEqual(meta.migrated_from_omega, undefined);
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    cleanup(home, cwd);
  }
});

test('migrateMemoryCmd: full run mutates expected files and writes backup', async () => {
  const home = makeTmpHome();
  const cwd = makeTmpCwd();
  try {
    seedFullOmegaState(home, cwd);
    process.env.FAKE_OMEGA_FIXTURE = 'small';

    const result = await migrateMemoryCmd({
      homeDir: home,
      cwd,
      verbose: false,
    });

    assert.strictEqual(result.skipped, false);
    assert.strictEqual(result.state.state, 'complete');
    assert.ok(result.backupDir.startsWith(path.join(home, '.claude-cabinet')));

    // CLAUDE.md OMEGA block stripped
    const claudeMd = fs.readFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'utf8');
    assert.ok(!claudeMd.includes('OMEGA:BEGIN'), 'OMEGA:BEGIN should be gone');
    assert.ok(!claudeMd.includes('OMEGA:END'), 'OMEGA:END should be gone');
    assert.ok(claudeMd.includes('Other content here'), 'non-OMEGA content preserved');

    // settings.json — omega hooks removed, non-omega hook preserved
    const settings = JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'));
    const allCommands = JSON.stringify(settings.hooks || {});
    assert.ok(!allCommands.includes('omega-venv'), 'omega-venv hooks gone');
    assert.ok(allCommands.includes('non-omega-hook'), 'non-omega hook preserved');

    // MCP omega entries removed from both locations
    assert.strictEqual(settings.mcpServers?.omega, undefined);
    const claudeJson = JSON.parse(fs.readFileSync(path.join(home, '.claude.json'), 'utf8'));
    assert.strictEqual(claudeJson.mcpServers?.['omega-memory'], undefined);

    // disabledMcpjsonServers includes omega
    assert.ok((settings.disabledMcpjsonServers || []).includes('omega'));

    // Project's omega-memory-guard hook removed
    const projectSettings = JSON.parse(fs.readFileSync(path.join(cwd, '.claude', 'settings.json'), 'utf8'));
    const projectCommands = JSON.stringify(projectSettings.hooks || {});
    assert.ok(!projectCommands.includes('omega-memory-guard'));

    // Installed memory skill removed
    assert.strictEqual(fs.existsSync(path.join(cwd, '.claude', 'skills', 'memory')), false);

    // .ccrc.json flag set with all steps recorded
    const meta = metadata.read(cwd);
    assert.strictEqual(meta.migrated_from_omega.state, 'complete');
    assert.deepStrictEqual(meta.migrated_from_omega.completedSteps, STEPS);
    assert.ok(meta.migrated_from_omega.backupDir);

    // Backup files present
    const backupDir = meta.migrated_from_omega.backupDir;
    assert.ok(fs.existsSync(path.join(backupDir, 'CLAUDE.md')));
    assert.ok(fs.existsSync(path.join(backupDir, 'settings.json')));
    assert.ok(fs.existsSync(path.join(backupDir, 'claude.json')));
    assert.ok(fs.existsSync(path.join(backupDir, 'ROLLBACK.md')));
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    cleanup(home, cwd);
  }
});

test('migrateMemoryCmd: second run is no-op (already-migrated)', async () => {
  const home = makeTmpHome();
  const cwd = makeTmpCwd();
  try {
    seedFullOmegaState(home, cwd);
    process.env.FAKE_OMEGA_FIXTURE = 'small';

    await migrateMemoryCmd({ homeDir: home, cwd, verbose: false });
    const second = await migrateMemoryCmd({ homeDir: home, cwd, verbose: false });

    assert.strictEqual(second.skipped, true);
    assert.strictEqual(second.reason, 'already-migrated');
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    cleanup(home, cwd);
  }
});

test('migrateMemoryCmd: resumes from in-progress state (mid-run interruption)', async () => {
  const home = makeTmpHome();
  const cwd = makeTmpCwd();
  try {
    seedFullOmegaState(home, cwd);
    process.env.FAKE_OMEGA_FIXTURE = 'small';

    // Simulate a crash mid-run: completedSteps contains the first few steps,
    // state is 'in-progress'. The backupDir exists from the prior partial run.
    const backupDir = path.join(home, '.claude-cabinet', 'partial-backup');
    fs.mkdirSync(backupDir, { recursive: true });
    metadata.merge(cwd, {
      migrated_from_omega: {
        state: 'in-progress',
        startedAt: '2026-05-27T18:00:00Z',
        backupDir,
        completedSteps: ['snapshot', 'backup-files', 'write-rollback-doc'],
      },
    });

    const result = await migrateMemoryCmd({ homeDir: home, cwd, verbose: false });

    // Should pick up where it left off and complete successfully.
    assert.strictEqual(result.skipped, false);
    assert.strictEqual(result.state.state, 'complete');
    // backupDir should match what was already in state, not a fresh one.
    assert.strictEqual(result.backupDir, backupDir);
    // All steps recorded.
    assert.deepStrictEqual(result.state.completedSteps, STEPS);
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    cleanup(home, cwd);
  }
});

test('migrateMemoryCmd: refuses to strip malformed OMEGA block', async () => {
  const home = makeTmpHome();
  const cwd = makeTmpCwd();
  try {
    seedFullOmegaState(home, cwd);
    // Corrupt the OMEGA block — remove END marker
    fs.writeFileSync(
      path.join(home, '.claude', 'CLAUDE.md'),
      '# CLAUDE.md\n<!-- OMEGA:BEGIN -->\nMemory section\nNo end marker.\n'
    );
    process.env.FAKE_OMEGA_FIXTURE = 'small';

    const result = await migrateMemoryCmd({ homeDir: home, cwd, verbose: false });

    // The strip step should warn but not crash; other steps still complete.
    const stripResult = result.steps.find((s) => s.step === 'strip-omega-block');
    assert.ok(stripResult, 'strip step ran');
    assert.match(stripResult.action, /REFUSED/);
    // CLAUDE.md should be untouched (backup remains the source of truth).
    const claudeMd = fs.readFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'utf8');
    assert.ok(claudeMd.includes('No end marker'), 'malformed file untouched');
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    cleanup(home, cwd);
  }
});

test('migrateMemoryCmd: skips customized installed memory skill with warning', async () => {
  const home = makeTmpHome();
  const cwd = makeTmpCwd();
  try {
    seedFullOmegaState(home, cwd);
    // Overwrite the memory skill with custom content (no upstream markers)
    fs.writeFileSync(
      path.join(cwd, '.claude', 'skills', 'memory', 'SKILL.md'),
      '# memory (heavily customized for this project)\nNothing here matches upstream.\n'
    );
    process.env.FAKE_OMEGA_FIXTURE = 'small';

    const result = await migrateMemoryCmd({ homeDir: home, cwd, verbose: false });

    const removeResult = result.steps.find((s) => s.step === 'remove-installed-memory-skill');
    assert.ok(removeResult);
    assert.match(removeResult.action, /REFUSED|customized/i);
    // Memory skill dir should still exist
    assert.strictEqual(fs.existsSync(path.join(cwd, '.claude', 'skills', 'memory')), true);
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    cleanup(home, cwd);
  }
});

test('migrateMemoryCmd: omega absent — migrate-memories step reports no-omega gracefully', async () => {
  const home = makeTmpHome();
  const cwd = makeTmpCwd();
  try {
    // Seed only the .ccrc.json — no omega state to find
    fs.writeFileSync(path.join(cwd, '.ccrc.json'), JSON.stringify({ version: '0.26.0' }));
    fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({}));
    fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), '# Clean CLAUDE.md\n');

    const result = await migrateMemoryCmd({ homeDir: home, cwd, verbose: false });

    assert.strictEqual(result.skipped, false);
    assert.strictEqual(result.state.state, 'complete');
    const migrateStep = result.steps.find((s) => s.step === 'migrate-memories');
    assert.match(migrateStep.action, /no omega install detected/);
  } finally {
    cleanup(home, cwd);
  }
});

test('migrateMemoryCmd: force flag re-runs after already-migrated', async () => {
  const home = makeTmpHome();
  const cwd = makeTmpCwd();
  try {
    seedFullOmegaState(home, cwd);
    process.env.FAKE_OMEGA_FIXTURE = 'small';

    await migrateMemoryCmd({ homeDir: home, cwd, verbose: false });

    // Re-seed omega state so steps have something to act on the second time
    seedFullOmegaState(home, cwd);

    const second = await migrateMemoryCmd({ homeDir: home, cwd, verbose: false, force: true });
    assert.strictEqual(second.skipped, false);
    assert.strictEqual(second.state.state, 'complete');
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    cleanup(home, cwd);
  }
});

test('migrateMemoryCmd: preserves unknown .ccrc.json keys', async () => {
  const home = makeTmpHome();
  const cwd = makeTmpCwd();
  try {
    seedFullOmegaState(home, cwd);
    // Inject an unknown top-level key into .ccrc.json
    const existing = metadata.read(cwd);
    metadata.write(cwd, { ...existing, customField: 'preserve me' });
    process.env.FAKE_OMEGA_FIXTURE = 'small';

    await migrateMemoryCmd({ homeDir: home, cwd, verbose: false });

    const meta = metadata.read(cwd);
    assert.strictEqual(meta.customField, 'preserve me');
    assert.strictEqual(meta.migrated_from_omega.state, 'complete');
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    cleanup(home, cwd);
  }
});
