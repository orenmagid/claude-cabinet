'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  captureSnapshot,
  captureOmegaHooks,
  captureOmegaBlock,
  captureMcpLocations,
} = require('../../lib/migration-snapshot');

const FAKE_OMEGA = path.join(__dirname, '..', 'migrate-from-omega', 'fake-omega.js');

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cc-snap-test-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('captureOmegaHooks: matches by command path containing omega-venv', () => {
  const tmp = makeTmp();
  try {
    const settingsPath = path.join(tmp, 'settings.json');
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        hooks: {
          SessionStart: [
            {
              matcher: '*',
              hooks: [
                { type: 'command', command: '/home/user/.claude-cabinet/omega-venv/bin/fast_hook session_start' },
                { type: 'command', command: '/some/other/hook' },
              ],
            },
          ],
          Stop: [
            { hooks: [{ command: '/home/user/.claude-cabinet/omega-venv/bin/fast_hook stop' }] },
          ],
        },
      })
    );
    const result = captureOmegaHooks(settingsPath);
    assert.strictEqual(result.entries.length, 2);
    assert.ok(result.entries.every((e) => e.command.includes('omega-venv')));
    assert.strictEqual(result.entries[0].event, 'SessionStart');
    assert.strictEqual(result.entries[1].event, 'Stop');
  } finally {
    cleanup(tmp);
  }
});

test('captureOmegaHooks: parseError on malformed JSON', () => {
  const tmp = makeTmp();
  try {
    const settingsPath = path.join(tmp, 'settings.json');
    fs.writeFileSync(settingsPath, '{ invalid json');
    const result = captureOmegaHooks(settingsPath);
    assert.strictEqual(result.entries.length, 0);
    assert.ok(result.parseError);
  } finally {
    cleanup(tmp);
  }
});

test('captureOmegaBlock: well-formed block extracted', () => {
  const tmp = makeTmp();
  try {
    const claudeMdPath = path.join(tmp, 'CLAUDE.md');
    const block = '<!-- OMEGA:BEGIN — managed by omega -->\n## Memory\nText\n<!-- OMEGA:END -->';
    fs.writeFileSync(claudeMdPath, 'preceding content\n' + block + '\ntrailing\n');
    const result = captureOmegaBlock(claudeMdPath);
    assert.strictEqual(result.present, true);
    assert.strictEqual(result.wellFormed, true);
    assert.strictEqual(result.blockText, block);
    assert.strictEqual(result.beginCount, 1);
    assert.strictEqual(result.endCount, 1);
  } finally {
    cleanup(tmp);
  }
});

test('captureOmegaBlock: detects malformed (no END marker)', () => {
  const tmp = makeTmp();
  try {
    const claudeMdPath = path.join(tmp, 'CLAUDE.md');
    fs.writeFileSync(claudeMdPath, '<!-- OMEGA:BEGIN \n## Memory\n');
    const result = captureOmegaBlock(claudeMdPath);
    assert.strictEqual(result.present, true);
    assert.strictEqual(result.wellFormed, false);
    assert.strictEqual(result.endCount, 0);
    assert.strictEqual(result.blockText, null);
  } finally {
    cleanup(tmp);
  }
});

test('captureOmegaBlock: absent block', () => {
  const tmp = makeTmp();
  try {
    const claudeMdPath = path.join(tmp, 'CLAUDE.md');
    fs.writeFileSync(claudeMdPath, '# My CLAUDE.md\nNo omega here.\n');
    const result = captureOmegaBlock(claudeMdPath);
    assert.strictEqual(result.present, false);
  } finally {
    cleanup(tmp);
  }
});

test('captureMcpLocations: finds omega across all three configs', () => {
  const tmp = makeTmp();
  try {
    const homeDir = tmp;
    const cwd = path.join(tmp, 'project');
    fs.mkdirSync(path.join(homeDir, '.claude'), { recursive: true });
    fs.mkdirSync(cwd, { recursive: true });

    fs.writeFileSync(
      path.join(homeDir, '.claude', 'settings.json'),
      JSON.stringify({
        mcpServers: {
          omega: { command: '/path/to/omega-venv/bin/omega', args: ['serve'] },
          other: { command: '/path/to/other' },
        },
      })
    );
    fs.writeFileSync(
      path.join(homeDir, '.claude.json'),
      JSON.stringify({
        mcpServers: {
          'omega-memory': { command: '/another/omega-venv/bin/omega' },
        },
      })
    );
    fs.writeFileSync(path.join(cwd, '.mcp.json'), JSON.stringify({ mcpServers: { 'pib-db': { command: 'node' } } }));

    const result = captureMcpLocations({ homeDir, cwd });
    assert.strictEqual(result.userSettings.entries.length, 1);
    assert.strictEqual(result.userSettings.entries[0].key, 'omega');
    assert.strictEqual(result.userClaudeJson.entries.length, 1);
    assert.strictEqual(result.userClaudeJson.entries[0].key, 'omega-memory');
    assert.strictEqual(result.projectMcp.entries.length, 0);
  } finally {
    cleanup(tmp);
  }
});

test('captureSnapshot: end-to-end against fake omega', () => {
  const tmp = makeTmp();
  process.env.FAKE_OMEGA_FIXTURE = 'small';
  try {
    fs.mkdirSync(path.join(tmp, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.claude', 'settings.json'), JSON.stringify({ hooks: {} }));
    fs.writeFileSync(path.join(tmp, '.claude', 'CLAUDE.md'), '# CLAUDE.md\nNo omega block.\n');

    const outputPath = path.join(tmp, 'snapshot.json');
    const snap = captureSnapshot({
      homeDir: tmp,
      cwd: tmp,
      omegaBin: FAKE_OMEGA,
      outputPath,
    });

    assert.strictEqual(snap.schemaVersion, 1);
    assert.ok(snap.generated);
    assert.strictEqual(snap.omegaBin.present, true);
    assert.strictEqual(snap.hooks.entries.length, 0);
    assert.strictEqual(snap.omegaBlock.present, false);
    assert.ok(snap.projectKeys.distinctKeys);
    assert.ok(Object.keys(snap.projectKeys.distinctKeys).includes('claude-cabinet'));

    assert.ok(fs.existsSync(outputPath));
    const onDisk = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    assert.strictEqual(onDisk.schemaVersion, 1);
  } finally {
    delete process.env.FAKE_OMEGA_FIXTURE;
    cleanup(tmp);
  }
});

test('captureSnapshot: gracefully skips omega operations when bin absent', () => {
  const tmp = makeTmp();
  try {
    fs.mkdirSync(path.join(tmp, '.claude'), { recursive: true });
    const snap = captureSnapshot({
      homeDir: tmp,
      cwd: tmp,
      omegaBin: '/nonexistent/omega',
    });
    assert.strictEqual(snap.omegaBin.present, false);
    assert.ok(snap.omegaStats.skipped);
    assert.ok(snap.projectKeys.skipped);
  } finally {
    cleanup(tmp);
  }
});
