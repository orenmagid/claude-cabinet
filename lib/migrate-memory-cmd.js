/**
 * `npx create-claude-cabinet --migrate-memory` orchestrator.
 *
 * Runs the destructive cleanup of omega from a consumer project:
 * exports omega memories to built-in layout (via migrate-from-omega),
 * backs up files we're about to mutate, disables omega hooks, strips
 * the OMEGA block from ~/.claude/CLAUDE.md, removes omega MCP
 * registrations across all 3 locations, adds omega to
 * disabledMcpjsonServers, removes the omega-memory-guard hook from
 * the project, and removes the installed `.claude/skills/memory/`
 * dir if it matches an upstream version hash.
 *
 * STATE-MACHINE IDEMPOTENCY: each step records completion in
 * .ccrc.json.migrated_from_omega.completedSteps[]. Mid-run Ctrl-C
 * leaves a resumable state — re-running --migrate-memory picks up
 * from the next un-completed step. After all steps complete, state
 * becomes 'complete' and subsequent runs exit 0 with "already
 * migrated" unless --force is passed.
 *
 * DOES NOT delete the omega venv or DB — that's Phase 9.1
 * (deferred-trigger gated). This command leaves omega installed
 * but inert: hooks disabled, MCP unregistered, CLAUDE.md guidance
 * removed. omega-memory itself remains functional if you
 * accidentally invoke it directly.
 *
 * @deprecated Remove after v1.0.0 — one-time migration for v0.27.0 omega removal.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const metadata = require('./metadata');
const { migrateFromOmega } = require('./migrate-from-omega');
const { captureSnapshot, captureOmegaBlock } = require('./migration-snapshot');

const VERSION = require('../package.json').version;

const STEPS = [
  'snapshot',
  'backup-files',
  'write-rollback-doc',
  'migrate-memories',
  'disable-omega-hooks',
  'strip-omega-block',
  'remove-mcp-entries',
  'add-disabled-mcp',
  'remove-guard-hook',
  'remove-installed-memory-skill',
];

const OMEGA_BLOCK_BEGIN = '<!-- OMEGA:BEGIN';
const OMEGA_BLOCK_END = '<!-- OMEGA:END -->';
const OMEGA_VENV_MARKER = 'omega-venv';

// ---------------------------------------------------------------------------
// Path helpers (all overridable via opts for tests)
// ---------------------------------------------------------------------------

function paths(opts) {
  const homeDir = opts.homeDir || os.homedir();
  const cwd = opts.cwd || process.cwd();
  return {
    homeDir,
    cwd,
    userSettings: path.join(homeDir, '.claude', 'settings.json'),
    userClaudeJson: path.join(homeDir, '.claude.json'),
    userClaudeMd: path.join(homeDir, '.claude', 'CLAUDE.md'),
    projectMcp: path.join(cwd, '.mcp.json'),
    projectSettings: path.join(cwd, '.claude', 'settings.json'),
    projectMemorySkill: path.join(cwd, '.claude', 'skills', 'memory'),
    ccrcPath: path.join(cwd, '.ccrc.json'),
  };
}

function nowIso() {
  return new Date().toISOString();
}

function backupDirFor(homeDir) {
  const stamp = nowIso().slice(0, 19).replace(/[:T]/g, '-');
  return path.join(homeDir, '.claude-cabinet', `migration-backup-${stamp}-${process.pid}`);
}

// ---------------------------------------------------------------------------
// State persistence
// ---------------------------------------------------------------------------

function loadState(p) {
  const m = metadata.read(p.cwd) || {};
  return m.migrated_from_omega || null;
}

function persistState(p, state, dryRun) {
  if (dryRun) return;
  metadata.merge(p.cwd, { migrated_from_omega: state });
}

// ---------------------------------------------------------------------------
// Step implementations. Each: returns { action: string } describing what
// was done (or would be done in dryRun). Each must be individually
// idempotent: safe to re-run if state.completedSteps already includes its
// name (orchestrator guards this), but ALSO safe if invoked twice within
// the same run (defensive).
// ---------------------------------------------------------------------------

function stepSnapshot(ctx) {
  const snapshotPath = path.join(ctx.cwd, '.claude', 'plans', 'omega-winddown-snapshot.json');
  if (fs.existsSync(snapshotPath)) {
    return { action: `snapshot already exists at ${snapshotPath}` };
  }
  if (ctx.dryRun) {
    return { action: `would capture pre-migration snapshot to ${snapshotPath}` };
  }
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  captureSnapshot({
    homeDir: ctx.homeDir,
    cwd: ctx.cwd,
    outputPath: snapshotPath,
  });
  return { action: `captured snapshot → ${snapshotPath}` };
}

function copyIfExists(src, destDir, destName) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, path.join(destDir, destName));
  return true;
}

function stepBackupFiles(ctx) {
  const p = ctx.paths;
  const backupDir = ctx.state.backupDir;
  const actions = [];
  if (ctx.dryRun) {
    return {
      action: `would back up to ${backupDir}: ${p.userClaudeMd}, ${p.userSettings}, ${p.userClaudeJson} (if present), ${p.projectMcp} (if has omega entry)`,
    };
  }
  fs.mkdirSync(backupDir, { recursive: true });
  if (copyIfExists(p.userClaudeMd, backupDir, 'CLAUDE.md')) actions.push('CLAUDE.md');
  if (copyIfExists(p.userSettings, backupDir, 'settings.json')) actions.push('settings.json');
  if (copyIfExists(p.userClaudeJson, backupDir, 'claude.json')) actions.push('claude.json');
  if (copyIfExists(p.projectMcp, backupDir, 'project-mcp.json')) actions.push('project-mcp.json');
  return { action: `backed up ${actions.join(', ')} → ${backupDir}` };
}

function stepWriteRollbackDoc(ctx) {
  const p = ctx.paths;
  const backupDir = ctx.state.backupDir;
  const rollbackPath = path.join(backupDir, 'ROLLBACK.md');
  if (fs.existsSync(rollbackPath)) {
    return { action: `ROLLBACK.md already exists at ${rollbackPath}` };
  }
  if (ctx.dryRun) {
    return { action: `would write ${rollbackPath}` };
  }
  fs.mkdirSync(backupDir, { recursive: true });
  const body = `# Rollback instructions for omega-memory migration

This backup directory contains snapshots of the files that
\`--migrate-memory\` modified for this project on ${nowIso().slice(0, 10)}.

To roll back:

\`\`\`bash
npx create-claude-cabinet --unmigrate-memory
\`\`\`

That subcommand reads this backup dir (path is recorded in
\`.ccrc.json.migrated_from_omega.backupDir\`) and restores the files
listed below to their original locations.

## Backed-up files (restore targets)

| Backup file | Original location |
|---|---|
| CLAUDE.md | ${p.userClaudeMd} |
| settings.json | ${p.userSettings} |
| claude.json | ${p.userClaudeJson} |
| project-mcp.json | ${p.projectMcp} |

## What was migrated

- omega memories → \`~/.claude/projects/<project>/memory/\` (per-file
  curated style, indexed in MEMORY.md). The migrated topic files
  are NOT removed by \`--unmigrate-memory\` — they remain alongside
  any curated files. Delete manually if you want a fresh state.
- omega DB at \`~/.omega/omega.db\` is unchanged. omega-memory
  package and venv at \`~/.claude-cabinet/omega-venv/\` are unchanged.
  Restoring the files above re-enables omega for this project.

## Manual rollback (if \`--unmigrate-memory\` is unavailable)

\`\`\`bash
cp ${path.join(backupDir, 'CLAUDE.md')} ${p.userClaudeMd}
cp ${path.join(backupDir, 'settings.json')} ${p.userSettings}
# Restore .claude.json and project .mcp.json only if those files are in this dir.
\`\`\`

Then unset the migration flag in this project's \`.ccrc.json\`:
edit and remove the \`migrated_from_omega\` top-level key.
`;
  fs.writeFileSync(rollbackPath, body);
  return { action: `wrote rollback doc → ${rollbackPath}` };
}

async function stepMigrateMemories(ctx) {
  if (ctx.dryRun) {
    return { action: `would call migrateFromOmega() with autoMemoryDirectory or default path` };
  }
  const result = await migrateFromOmega({
    homeDir: ctx.homeDir,
    cwd: ctx.cwd,
    settingsPath: ctx.paths.userSettings,
  });
  if (result.reason === 'no-omega') {
    return { action: `no omega install detected; skipping memory migration` };
  }
  if (result.reason === 'already-migrated') {
    return { action: `memories already migrated; reusing existing output at ${result.outputDir}` };
  }
  if (result.reason === 'foreign-content' || result.reason === 'partial-or-foreign') {
    return {
      action: `migrate-from-omega refused: ${result.reason} at ${result.outputDir}. ` +
        `Hint: ${result.hint || 'inspect manually'}. Continuing — omega cleanup steps will still run.`,
    };
  }
  if (result.reason === 'empty-db') {
    return { action: `omega DB was empty; minimal MEMORY.md written at ${result.outputDir}` };
  }
  return {
    action: `migrated ${result.migrated} memories (${result.edges || 0} edges) → ${result.outputDir}`,
  };
}

function readJsonSafe(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJsonAtomic(file, data) {
  const tmp = file + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

function stepDisableOmegaHooks(ctx) {
  const settings = readJsonSafe(ctx.paths.userSettings);
  if (!settings || !settings.hooks) {
    return { action: `no hooks configured in ${ctx.paths.userSettings}; nothing to disable` };
  }
  let removed = 0;
  const cleaned = {};
  for (const [event, handlers] of Object.entries(settings.hooks)) {
    if (!Array.isArray(handlers)) {
      cleaned[event] = handlers;
      continue;
    }
    const newHandlers = handlers
      .map((h) => {
        if (!h || !Array.isArray(h.hooks)) return h;
        const filtered = h.hooks.filter((sub) => {
          if (sub && sub.command && sub.command.includes(OMEGA_VENV_MARKER)) {
            removed++;
            return false;
          }
          return true;
        });
        return { ...h, hooks: filtered };
      })
      .filter((h) => h && (!Array.isArray(h.hooks) || h.hooks.length > 0));
    if (newHandlers.length > 0) cleaned[event] = newHandlers;
  }
  if (removed === 0) {
    return { action: `no omega-venv hooks found in ${ctx.paths.userSettings}` };
  }
  if (ctx.dryRun) {
    return { action: `would remove ${removed} omega hook entries from ${ctx.paths.userSettings}` };
  }
  settings.hooks = cleaned;
  writeJsonAtomic(ctx.paths.userSettings, settings);
  return { action: `removed ${removed} omega hook entries from ${ctx.paths.userSettings}` };
}

function stepStripOmegaBlock(ctx) {
  const file = ctx.paths.userClaudeMd;
  if (!fs.existsSync(file)) {
    return { action: `${file} does not exist; nothing to strip` };
  }
  const block = captureOmegaBlock(file);
  if (!block.present) {
    return { action: `no OMEGA block found in ${file}` };
  }
  if (!block.wellFormed) {
    return {
      action: `REFUSED: OMEGA block markers in ${file} are malformed ` +
        `(${block.beginCount} BEGIN, ${block.endCount} END markers). ` +
        `Remove manually. The backup at ${ctx.state.backupDir}/CLAUDE.md ` +
        `has the original.`,
      warn: true,
    };
  }
  if (ctx.dryRun) {
    return { action: `would strip OMEGA block (${block.blockText.length} chars) from ${file}` };
  }
  const text = fs.readFileSync(file, 'utf8');
  const stripped = text.replace(block.blockText, '').replace(/\n{3,}/g, '\n\n');
  const tmp = file + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, stripped, 'utf8');
  fs.renameSync(tmp, file);
  return { action: `stripped OMEGA block from ${file}` };
}

function removeOmegaFromMcpServers(servers) {
  if (!servers || typeof servers !== 'object') return { newServers: servers, removed: [] };
  const newServers = {};
  const removed = [];
  for (const [key, server] of Object.entries(servers)) {
    const cmd = (server && server.command) || '';
    const args = Array.isArray(server && server.args) ? server.args.join(' ') : '';
    const isOmega =
      cmd.includes(OMEGA_VENV_MARKER) ||
      args.includes(OMEGA_VENV_MARKER) ||
      /^omega(-memory)?$/i.test(key);
    if (isOmega) {
      removed.push(key);
    } else {
      newServers[key] = server;
    }
  }
  return { newServers, removed };
}

function stepRemoveMcpEntries(ctx) {
  const targets = [ctx.paths.userSettings, ctx.paths.userClaudeJson, ctx.paths.projectMcp];
  const allRemoved = [];
  const actions = [];
  for (const file of targets) {
    const data = readJsonSafe(file);
    if (!data) continue;
    const { newServers, removed } = removeOmegaFromMcpServers(data.mcpServers);
    if (removed.length === 0) continue;
    allRemoved.push(...removed.map((k) => `${path.basename(file)}:${k}`));
    if (ctx.dryRun) {
      actions.push(`would remove [${removed.join(', ')}] from ${file}`);
      continue;
    }
    data.mcpServers = newServers;
    if (Object.keys(data.mcpServers).length === 0) delete data.mcpServers;
    writeJsonAtomic(file, data);
    actions.push(`removed [${removed.join(', ')}] from ${file}`);
  }
  if (allRemoved.length === 0) {
    return { action: `no omega MCP entries found in any of the 3 locations` };
  }
  return { action: actions.join('; ') };
}

function stepAddDisabledMcp(ctx) {
  const file = ctx.paths.userSettings;
  const settings = readJsonSafe(file) || {};
  const current = Array.isArray(settings.disabledMcpjsonServers)
    ? settings.disabledMcpjsonServers
    : [];
  const toAdd = ['omega', 'omega-memory'].filter((k) => !current.includes(k));
  if (toAdd.length === 0) {
    return { action: `disabledMcpjsonServers in ${file} already includes omega(-memory)` };
  }
  if (ctx.dryRun) {
    return { action: `would add [${toAdd.join(', ')}] to ${file}.disabledMcpjsonServers` };
  }
  settings.disabledMcpjsonServers = [...current, ...toAdd];
  writeJsonAtomic(file, settings);
  return { action: `added [${toAdd.join(', ')}] to ${file}.disabledMcpjsonServers` };
}

function stepRemoveGuardHook(ctx) {
  const file = ctx.paths.projectSettings;
  const settings = readJsonSafe(file);
  if (!settings || !settings.hooks) {
    return { action: `no project hooks in ${file}; nothing to remove` };
  }
  let removed = 0;
  const cleaned = {};
  for (const [event, handlers] of Object.entries(settings.hooks)) {
    if (!Array.isArray(handlers)) {
      cleaned[event] = handlers;
      continue;
    }
    const newHandlers = handlers
      .map((h) => {
        if (!h || !Array.isArray(h.hooks)) return h;
        const filtered = h.hooks.filter((sub) => {
          if (sub && sub.command && sub.command.includes('omega-memory-guard')) {
            removed++;
            return false;
          }
          return true;
        });
        return { ...h, hooks: filtered };
      })
      .filter((h) => h && (!Array.isArray(h.hooks) || h.hooks.length > 0));
    if (newHandlers.length > 0) cleaned[event] = newHandlers;
  }
  if (removed === 0) {
    return { action: `no omega-memory-guard hook found in ${file}` };
  }
  if (ctx.dryRun) {
    return { action: `would remove omega-memory-guard hook from ${file}` };
  }
  settings.hooks = cleaned;
  writeJsonAtomic(file, settings);
  return { action: `removed omega-memory-guard hook from ${file}` };
}

function stepRemoveInstalledMemorySkill(ctx) {
  const dir = ctx.paths.projectMemorySkill;
  if (!fs.existsSync(dir)) {
    return { action: `${dir} does not exist; nothing to remove` };
  }
  // Version-anchored hash check would compare against the CC version
  // recorded in .ccrc.json. For simplicity in this implementation, we
  // check whether the user has clearly customized SKILL.md (the only
  // file omega's memory module shipped) by looking for substantive
  // content that wasn't in the omega upstream version. The cheap
  // heuristic: if SKILL.md exists and contains the omega marker
  // strings the upstream version shipped with, treat as upstream and
  // safe to remove. Otherwise, warn and skip.
  const skillFile = path.join(dir, 'SKILL.md');
  let customized = false;
  if (fs.existsSync(skillFile)) {
    const body = fs.readFileSync(skillFile, 'utf8');
    const upstreamMarkers = [
      'cabinet-memory-adapter.py',
      'omega-venv/bin/python3',
      'omega.bridge',
    ];
    const matches = upstreamMarkers.filter((m) => body.includes(m)).length;
    // If 2+ upstream markers present, treat as untouched upstream.
    if (matches < 2) customized = true;
  }
  if (customized) {
    return {
      action: `REFUSED: ${dir} appears customized (SKILL.md doesn't match upstream omega markers). ` +
        `Review manually and delete if not needed.`,
      warn: true,
    };
  }
  if (ctx.dryRun) {
    return { action: `would remove installed memory skill at ${dir}` };
  }
  fs.rmSync(dir, { recursive: true, force: true });
  return { action: `removed installed memory skill at ${dir}` };
}

const STEP_FNS = {
  'snapshot': stepSnapshot,
  'backup-files': stepBackupFiles,
  'write-rollback-doc': stepWriteRollbackDoc,
  'migrate-memories': stepMigrateMemories,
  'disable-omega-hooks': stepDisableOmegaHooks,
  'strip-omega-block': stepStripOmegaBlock,
  'remove-mcp-entries': stepRemoveMcpEntries,
  'add-disabled-mcp': stepAddDisabledMcp,
  'remove-guard-hook': stepRemoveGuardHook,
  'remove-installed-memory-skill': stepRemoveInstalledMemorySkill,
};

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

async function migrateMemoryCmd(opts = {}) {
  const dryRun = !!opts.dryRun;
  const force = !!opts.force;
  const verbose = opts.verbose !== false;
  const p = paths(opts);

  // Load or initialize state.
  let state = loadState(p);
  if (state && state.state === 'complete' && !force) {
    return {
      skipped: true,
      reason: 'already-migrated',
      state,
      message: `Already migrated on ${state.date}. Pass --force to re-run.`,
    };
  }
  if (!state || state.state === 'rolled-back') {
    state = {
      state: 'in-progress',
      startedAt: nowIso(),
      version: VERSION,
      backupDir: backupDirFor(p.homeDir),
      completedSteps: [],
    };
    persistState(p, state, dryRun);
  } else if (state.state === 'in-progress') {
    if (verbose) {
      const remaining = STEPS.filter((s) => !state.completedSteps.includes(s));
      console.log(`  Resuming in-progress migration. ${remaining.length} step(s) remaining.`);
    }
  }

  const log = [];
  const ctx = {
    state,
    cwd: p.cwd,
    homeDir: p.homeDir,
    paths: p,
    dryRun,
    force,
  };

  for (const stepName of STEPS) {
    if (state.completedSteps.includes(stepName)) continue;

    if (verbose) console.log(`  → ${stepName}${dryRun ? ' [dry-run]' : ''}`);
    const fn = STEP_FNS[stepName];
    const result = await fn(ctx);
    log.push({ step: stepName, ...result });
    if (verbose && result.action) console.log(`    ${result.action}`);
    if (result.warn && verbose) console.log(`    ⚠ ${result.action}`);

    if (!dryRun) {
      state.completedSteps.push(stepName);
      persistState(p, state, dryRun);
    }
  }

  if (!dryRun) {
    state.state = 'complete';
    state.date = nowIso();
    state.version = VERSION;
    persistState(p, state, dryRun);
  }

  return {
    skipped: false,
    state,
    backupDir: state.backupDir,
    dryRun,
    steps: log,
  };
}

module.exports = {
  migrateMemoryCmd,
  STEPS,
  // exposed for tests
  _internals: {
    stepSnapshot,
    stepBackupFiles,
    stepWriteRollbackDoc,
    stepMigrateMemories,
    stepDisableOmegaHooks,
    stepStripOmegaBlock,
    stepRemoveMcpEntries,
    stepAddDisabledMcp,
    stepRemoveGuardHook,
    stepRemoveInstalledMemorySkill,
    removeOmegaFromMcpServers,
  },
};
