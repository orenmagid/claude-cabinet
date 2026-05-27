/**
 * Capture pre-migration omega state to a JSON snapshot.
 *
 * Phase 4's --migrate-memory uses this snapshot for DETERMINISTIC
 * removal of hooks / MCP entries / OMEGA block — match against
 * captured contents, not pattern-guess against live state. If the
 * user's config drifts between snapshot and migration, we know.
 *
 * Searches all three MCP config locations and matches omega by
 * command path (contains "omega-venv") rather than by key name —
 * omega is registered as "omega" in ~/.claude/settings.json but
 * as "omega-memory" in ~/.claude.json on observed installs.
 *
 * @deprecated Remove after v1.0.0 — one-time migration for v0.27.0 omega removal.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync, spawnSync } = require('node:child_process');

const OMEGA_BLOCK_BEGIN = '<!-- OMEGA:BEGIN';
const OMEGA_BLOCK_END = '<!-- OMEGA:END -->';
const OMEGA_VENV_MARKER = 'omega-venv';

function readJsonSafe(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return { _parseError: e.message };
  }
}

function captureOmegaHooks(settingsPath) {
  const settings = readJsonSafe(settingsPath);
  if (!settings || settings._parseError) {
    return { entries: [], parseError: settings?._parseError || null };
  }
  const hooks = settings.hooks || {};
  const entries = [];
  for (const [event, handlers] of Object.entries(hooks)) {
    if (!Array.isArray(handlers)) continue;
    for (const handler of handlers) {
      const subHooks = handler.hooks || [];
      for (let i = 0; i < subHooks.length; i++) {
        const h = subHooks[i];
        if (h && h.command && h.command.includes(OMEGA_VENV_MARKER)) {
          entries.push({
            event,
            matcher: handler.matcher || null,
            command: h.command,
            type: h.type || null,
            indexInHandler: i,
          });
        }
      }
    }
  }
  return { entries };
}

function captureOmegaBlock(claudeMdPath) {
  if (!fs.existsSync(claudeMdPath)) return { present: false };
  const text = fs.readFileSync(claudeMdPath, 'utf8');
  const beginIdx = text.indexOf(OMEGA_BLOCK_BEGIN);
  const endIdx = text.indexOf(OMEGA_BLOCK_END);

  const beginCount = text.split(OMEGA_BLOCK_BEGIN).length - 1;
  const endCount = text.split(OMEGA_BLOCK_END).length - 1;

  if (beginIdx === -1 && endIdx === -1) return { present: false };

  return {
    present: true,
    wellFormed: beginCount === 1 && endCount === 1 && beginIdx < endIdx,
    beginCount,
    endCount,
    blockText: beginIdx !== -1 && endIdx !== -1 && beginIdx < endIdx
      ? text.slice(beginIdx, endIdx + OMEGA_BLOCK_END.length)
      : null,
    fileBytes: Buffer.byteLength(text, 'utf8'),
  };
}

function captureMcpFromObject(mcpServers) {
  if (!mcpServers || typeof mcpServers !== 'object') return [];
  const entries = [];
  for (const [key, server] of Object.entries(mcpServers)) {
    const cmd = server?.command || '';
    const args = Array.isArray(server?.args) ? server.args.join(' ') : '';
    if (cmd.includes(OMEGA_VENV_MARKER) || args.includes(OMEGA_VENV_MARKER) || /^omega(-memory)?$/i.test(key)) {
      entries.push({
        key,
        command: cmd,
        args: server?.args || [],
        env: server?.env || {},
      });
    }
  }
  return entries;
}

function captureMcpLocations(opts) {
  const homeDir = opts.homeDir || os.homedir();
  const cwd = opts.cwd || process.cwd();

  const locations = {
    userSettings: path.join(homeDir, '.claude', 'settings.json'),
    userClaudeJson: path.join(homeDir, '.claude.json'),
    projectMcp: path.join(cwd, '.mcp.json'),
  };

  const result = {};
  for (const [name, filePath] of Object.entries(locations)) {
    const data = readJsonSafe(filePath);
    if (!data || data._parseError) {
      result[name] = { path: filePath, exists: fs.existsSync(filePath), entries: [], parseError: data?._parseError || null };
      continue;
    }
    result[name] = {
      path: filePath,
      exists: true,
      entries: captureMcpFromObject(data.mcpServers),
    };
  }
  return result;
}

function captureOmegaStats(omegaBin) {
  try {
    const result = spawnSync(omegaBin, ['stats'], { encoding: 'utf8' });
    if (result.status !== 0) return { error: `omega stats exited ${result.status}`, stderr: result.stderr };
    return { stdout: result.stdout.trim() };
  } catch (e) {
    return { error: e.message };
  }
}

function captureProjectKeys(omegaBin) {
  try {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-omega-keys-'));
    try {
      const result = spawnSync(omegaBin, ['export-obsidian', '--output-dir', tmpRoot], { encoding: 'utf8' });
      if (result.status !== 0) return { error: `omega export failed: ${result.stderr}` };

      const projectCounts = new Map();
      let nullCount = 0;
      const vaultDir = path.join(tmpRoot, 'omega-memories');
      if (!fs.existsSync(vaultDir)) return { error: 'no omega-memories/ in export' };

      for (const sub of fs.readdirSync(vaultDir)) {
        const subPath = path.join(vaultDir, sub);
        if (!fs.statSync(subPath).isDirectory()) continue;
        for (const f of fs.readdirSync(subPath)) {
          if (!f.endsWith('.md') || f === '_index.md') continue;
          const text = fs.readFileSync(path.join(subPath, f), 'utf8');
          const m = text.match(/^project:\s*(.*)$/m);
          if (!m || !m[1].trim() || m[1].trim() === 'null') {
            nullCount++;
            continue;
          }
          const proj = m[1].trim();
          projectCounts.set(proj, (projectCounts.get(proj) || 0) + 1);
        }
      }

      return {
        distinctKeys: Object.fromEntries([...projectCounts.entries()].sort((a, b) => b[1] - a[1])),
        nullCount,
        totalDistinct: projectCounts.size,
      };
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  } catch (e) {
    return { error: e.message };
  }
}

function captureGitSha(repoRoot, treePath) {
  try {
    const sha = execSync(`git -C ${JSON.stringify(repoRoot)} rev-parse HEAD:${treePath}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return sha;
  } catch (e) {
    return null;
  }
}

function captureSnapshot(opts = {}) {
  const homeDir = opts.homeDir || os.homedir();
  const cwd = opts.cwd || process.cwd();
  const settingsPath = opts.settingsPath || path.join(homeDir, '.claude', 'settings.json');
  const claudeMdPath = opts.claudeMdPath || path.join(homeDir, '.claude', 'CLAUDE.md');
  const omegaBin = opts.omegaBin || path.join(homeDir, '.claude-cabinet', 'omega-venv', 'bin', 'omega');
  const repoRoot = opts.repoRoot || cwd;

  const snapshot = {
    schemaVersion: 1,
    generated: new Date().toISOString(),
    paths: { homeDir, cwd, settingsPath, claudeMdPath, omegaBin, repoRoot },
    omegaBin: { path: omegaBin, present: fs.existsSync(omegaBin) },
    hooks: captureOmegaHooks(settingsPath),
    omegaBlock: captureOmegaBlock(claudeMdPath),
    mcp: captureMcpLocations({ homeDir, cwd }),
    omegaStats: snapshot_omegaPresent(omegaBin) ? captureOmegaStats(omegaBin) : { skipped: 'omega not present' },
    projectKeys: snapshot_omegaPresent(omegaBin) ? captureProjectKeys(omegaBin) : { skipped: 'omega not present' },
    gitSha: {
      'templates/skills/memory/': captureGitSha(repoRoot, 'templates/skills/memory/'),
      'templates/skills/memory/SKILL.md': captureGitSha(repoRoot, 'templates/skills/memory/SKILL.md'),
    },
  };

  if (opts.outputPath) {
    fs.mkdirSync(path.dirname(opts.outputPath), { recursive: true });
    fs.writeFileSync(opts.outputPath, JSON.stringify(snapshot, null, 2), 'utf8');
  }

  return snapshot;
}

function snapshot_omegaPresent(omegaBin) {
  try {
    return fs.statSync(omegaBin).isFile();
  } catch {
    return false;
  }
}

module.exports = {
  captureSnapshot,
  captureOmegaHooks,
  captureOmegaBlock,
  captureMcpLocations,
  captureProjectKeys,
};
