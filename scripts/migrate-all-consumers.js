/**
 * Walk ~/.claude/cc-registry.json and run --migrate-memory per consumer.
 *
 * CC-MAINTAINER-ONLY tooling. Lives in scripts/ (NOT lib/) so it is not
 * published to npm consumers — they have no registry to walk. Used once,
 * by the maintainer, to migrate their own registered projects off omega
 * (omega-winddown Phase 8b).
 *
 * Safety (from cabinet boundary-man critique):
 *  - REFUSES any registry path that is the home dir or an ancestor of it.
 *    Running project-scoped migration against $HOME would mutate global
 *    config as if it were a project.
 *  - Skips missing paths and already-migrated projects (idempotent resume).
 *  - Writes walk-state after each consumer so a fresh session resumes.
 *  - Confirm-per-consumer (injectable for tests); --batch N groups the
 *    dry-run display before collecting confirmations.
 *  - End-of-walk report: migrated / skipped(reason) / failed(error);
 *    total === registry size.
 *
 * @deprecated Remove after v1.0.0 — one-time omega-winddown tooling.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const readline = require('node:readline');
const { migrateMemoryCmd } = require('../lib/migrate-memory-cmd');

const SKIP_REASONS = {
  HOME: 'home-or-ancestor-refused',
  MISSING: 'path-missing',
  MIGRATED: 'already-migrated',
  NO_OMEGA: 'no-omega-detected',
  DECLINED: 'user-declined',
};

/**
 * True if `p` is the home dir itself or a strict ancestor of it.
 * (A descendant of home — a real project — returns false.)
 */
function isHomeOrAncestor(p, homeDir) {
  const resolved = path.resolve(p);
  const home = path.resolve(homeDir);
  if (resolved === home) return true;
  // Append a separator so "/Users/xyz" isn't treated as an ancestor of
  // "/Users/x". Guard the root case where resolved already ends in sep
  // ("/" + "/" would be "//" and never match).
  const prefix = resolved.endsWith(path.sep) ? resolved : resolved + path.sep;
  return home.startsWith(prefix);
}

function loadRegistry(registryPath) {
  if (!fs.existsSync(registryPath)) return { projects: [] };
  try {
    const data = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    return data && Array.isArray(data.projects) ? data : { projects: [] };
  } catch {
    return { projects: [] };
  }
}

function loadWalkState(walkStatePath) {
  if (!walkStatePath || !fs.existsSync(walkStatePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(walkStatePath, 'utf8'));
  } catch {
    return {};
  }
}

function saveWalkState(walkStatePath, state) {
  if (!walkStatePath) return;
  fs.mkdirSync(path.dirname(walkStatePath), { recursive: true });
  const tmp = walkStatePath + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, walkStatePath);
}

function readCcrcState(projectPath) {
  const ccrc = path.join(projectPath, '.ccrc.json');
  if (!fs.existsSync(ccrc)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(ccrc, 'utf8'));
    return data.migrated_from_omega || null;
  } catch {
    return null;
  }
}

/**
 * Walk the registry. Pure-ish: all I/O boundaries are injectable so the
 * walk logic is unit-testable without touching real consumer projects.
 *
 * @param {object} opts
 * @param {string} [opts.homeDir]
 * @param {string} [opts.registryPath]
 * @param {string} [opts.walkStatePath]
 * @param {boolean} [opts.dryRun] — pass through to migrateMemoryCmd
 * @param {(consumer, dryRunResult) => Promise<boolean>|boolean} [opts.confirm]
 *        — return true to proceed with the real migration for this consumer.
 *        Defaults to auto-yes (callers that want prompts pass a real fn).
 * @param {(opts) => Promise<object>} [opts.runMigrate] — injectable
 *        migrate runner (defaults to migrateMemoryCmd). Tests stub this.
 * @param {(msg) => void} [opts.log]
 * @returns {Promise<{migrated, skipped, failed, total}>}
 */
async function migrateAllConsumers(opts = {}) {
  const homeDir = opts.homeDir || os.homedir();
  const registryPath = opts.registryPath || path.join(homeDir, '.claude', 'cc-registry.json');
  const walkStatePath = opts.walkStatePath || null;
  const confirm = opts.confirm || (() => true);
  const runMigrate = opts.runMigrate || migrateMemoryCmd;
  const log = opts.log || (() => {});

  const registry = loadRegistry(registryPath);
  const walkState = loadWalkState(walkStatePath);

  // Walk-level dry-run must NOT persist walk-state — otherwise a later
  // real run would resume past every consumer the dry-run "processed."
  // Suppress persistence by nulling the path the recorder writes to.
  const persistPath = opts.dryRun ? null : walkStatePath;

  const report = { migrated: [], skipped: [], failed: [], total: registry.projects.length };

  for (const project of registry.projects) {
    const p = path.resolve(project.path);
    const label = project.name || p;

    // Resume: already processed in a prior session.
    if (walkState[p] && walkState[p].status) {
      const prior = walkState[p];
      log(`  ↪ ${label}: already processed (${prior.status}/${prior.reason || 'ok'}) — resuming past it`);
      bucketFor(report, prior.status).push({ path: p, name: label, reason: prior.reason, resumed: true });
      continue;
    }

    // SAFETY: refuse home dir or ancestor.
    if (isHomeOrAncestor(p, homeDir)) {
      log(`  ⛔ ${label}: REFUSED — ${p} is the home dir or an ancestor. Skipping.`);
      record(report, walkState, persistPath, p, label, 'skipped', SKIP_REASONS.HOME);
      continue;
    }

    // Skip missing paths.
    if (!fs.existsSync(p)) {
      log(`  ⚠ ${label}: path missing (${p}). Skipping.`);
      record(report, walkState, persistPath, p, label, 'skipped', SKIP_REASONS.MISSING);
      continue;
    }

    // Skip already-migrated.
    const state = readCcrcState(p);
    if (state && state.state === 'complete') {
      log(`  ✓ ${label}: already migrated (${state.date || 'unknown date'}). Skipping.`);
      record(report, walkState, persistPath, p, label, 'skipped', SKIP_REASONS.MIGRATED);
      continue;
    }

    // Dry-run to show the operator what would happen.
    let dryRunResult;
    try {
      dryRunResult = await runMigrate({ cwd: p, homeDir, dryRun: true, verbose: false });
    } catch (e) {
      log(`  ✗ ${label}: dry-run failed: ${e.message}`);
      record(report, walkState, persistPath, p, label, 'failed', e.message);
      continue;
    }

    // If omega isn't even present, nothing to migrate.
    if (dryRunResult && dryRunResult.reason === 'no-omega') {
      log(`  ○ ${label}: no omega install detected. Skipping.`);
      record(report, walkState, persistPath, p, label, 'skipped', SKIP_REASONS.NO_OMEGA);
      continue;
    }

    // Confirm.
    const ok = await confirm(project, dryRunResult);
    if (!ok) {
      log(`  ⏭ ${label}: user declined.`);
      record(report, walkState, persistPath, p, label, 'skipped', SKIP_REASONS.DECLINED);
      continue;
    }

    // Real run.
    if (opts.dryRun) {
      // Walk-level dry-run: report what WOULD happen, don't mutate.
      log(`  [dry-run] ${label}: would migrate.`);
      record(report, walkState, persistPath, p, label, 'migrated', 'dry-run');
      continue;
    }
    try {
      const result = await runMigrate({ cwd: p, homeDir, dryRun: false, verbose: false });
      if (result && (result.state?.state === 'complete' || result.skipped)) {
        log(`  ✓ ${label}: migrated.`);
        record(report, walkState, persistPath, p, label, 'migrated', null);
      } else {
        log(`  ✗ ${label}: migration returned unexpected state.`);
        record(report, walkState, persistPath, p, label, 'failed', 'unexpected-state');
      }
    } catch (e) {
      log(`  ✗ ${label}: ${e.message}`);
      record(report, walkState, persistPath, p, label, 'failed', e.message);
    }
  }

  return report;
}

function bucketFor(report, status) {
  return status === 'migrated' ? report.migrated : status === 'failed' ? report.failed : report.skipped;
}

function record(report, walkState, walkStatePath, p, name, status, reason) {
  bucketFor(report, status).push({ path: p, name, reason });
  walkState[p] = { status, reason, at: new Date().toISOString() };
  saveWalkState(walkStatePath, walkState);
}

// ---------------------------------------------------------------------------
// CLI wrapper (standalone: `node scripts/migrate-all-consumers.js [--batch N] [--dry-run] [--yes]`)
// ---------------------------------------------------------------------------

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a); }));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const autoYes = args.includes('--yes') || args.includes('-y');
  const batchIdx = args.indexOf('--batch');
  const batch = batchIdx !== -1 ? parseInt(args[batchIdx + 1], 10) || 1 : 1;

  const ccRepo = path.resolve(__dirname, '..');
  const walkStatePath = path.join(ccRepo, '.claude', 'migrate-all-consumers-walk-state.json');

  const confirm = autoYes
    ? () => true
    : async (project, dry) => {
        console.log('');
        console.log(`  Next: ${project.name} (${project.path})`);
        if (dry && dry.steps) {
          console.log(`  Would run ${dry.steps.length} migration steps.`);
        }
        const a = await ask('  Migrate this consumer? [y/N] ');
        return /^y(es)?$/i.test(a.trim());
      };

  console.log(`\n  Walking cc-registry consumers${dryRun ? ' [dry-run]' : ''} (batch=${batch})\n`);

  const report = await migrateAllConsumers({
    walkStatePath,
    dryRun,
    confirm,
    log: (m) => console.log(m),
  });

  console.log('\n  === Walk report ===');
  console.log(`  migrated: ${report.migrated.length}`);
  console.log(`  skipped:  ${report.skipped.length}`);
  for (const s of report.skipped) console.log(`    - ${s.name}: ${s.reason}`);
  console.log(`  failed:   ${report.failed.length}`);
  for (const f of report.failed) console.log(`    - ${f.name}: ${f.reason}`);
  const accounted = report.migrated.length + report.skipped.length + report.failed.length;
  console.log(`  total: ${accounted}/${report.total} ${accounted === report.total ? '✓' : '✗ MISMATCH'}`);
  console.log('');
}

if (require.main === module) {
  main().catch((e) => {
    console.error('migrate-all-consumers failed:', e.message);
    process.exit(1);
  });
}

module.exports = { migrateAllConsumers, isHomeOrAncestor, SKIP_REASONS };
