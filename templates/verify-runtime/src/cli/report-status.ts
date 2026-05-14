#!/usr/bin/env node
/**
 * Cross-run verdict status: where do you stand across all scenarios?
 *
 * Reads every `reports/*.summary.json`, finds the most recent
 * INTERACTIVE verdict per (scenario, checkId), and prints a
 * per-scenario status with one of four labels:
 *
 *   ○  unverdicted     — no real human verdicts ever recorded
 *                         (AUTO_SKIP=1 smoke rows are filtered out)
 *   ⚠  has-issues      — latest run has ≥1 I-verdict or auto-fail
 *   ⏱  stale           — clean but the git SHA the verdicts were taken
 *                         at is N commits behind HEAD
 *   ✓  clean           — clean AND at current HEAD
 *
 * Usage:
 *   cabinet-verify-report-status              cross-run status
 *   cabinet-verify-report-status --help
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import pc from 'picocolors';

interface VerdictRow {
  scenarioFile?: string;
  scenarioTitle?: string;
  checkId?: string;
  runId?: string;
  runStartedAt?: string;
  gitSha?: string;
  verdict?: string;
  notes?: string | null;
}

interface Summary {
  rows?: VerdictRow[];
}

interface Tally {
  P: number;
  I: number;
  N: number;
  S: number;
  autoFail: number;
  autoPass: number;
}

interface ScenarioStatus {
  file: string;
  title: string | null;
  latestHumanRunStartedAt: string | null;
  latestHumanGitSha: string | null;
  latestAnyGitSha: string | null;
  tally: Tally;
  interactiveVerdicts: number;
  autoFails: number;
  commitsAhead: number | null;
  statusKey: 'unverdicted' | 'has-issues' | 'stale' | 'clean';
}

const REPORTS_DIR = path.resolve(process.cwd(), 'reports');
const FEATURES_DIR = path.resolve(process.cwd(), 'features');

function printHelp(): void {
  process.stdout.write(
    `cabinet-verify-report-status — cross-run verdict status per scenario.\n\n` +
      `Usage:\n` +
      `  cabinet-verify-report-status     scan ./reports/, classify each scenario\n` +
      `  cabinet-verify-report-status --help\n\n` +
      `Reads every reports/*.summary.json, takes the latest interactive verdict per\n` +
      `(scenario, checkId), and labels each scenario clean / stale / has-issues /\n` +
      `unverdicted. "Stale" compares the last verdict's git sha to HEAD.\n`,
  );
}

function loadAllSummaries(): Summary[] {
  if (!fs.existsSync(REPORTS_DIR)) return [];
  return fs
    .readdirSync(REPORTS_DIR)
    .filter((f) => f.endsWith('.summary.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), 'utf8')) as Summary;
      } catch {
        return null;
      }
    })
    .filter((s): s is Summary => s !== null);
}

function isAutoSkip(row: VerdictRow): boolean {
  return row.notes === 'AUTO_SKIP=1 (smoke run)';
}

function listFeatureFiles(): string[] {
  if (!fs.existsSync(FEATURES_DIR)) return [];
  return fs
    .readdirSync(FEATURES_DIR)
    .filter((f) => f.endsWith('.feature'))
    .map((f) => `features/${f}`)
    .sort();
}

function computeTally(rows: VerdictRow[]): Tally {
  const tally: Tally = { P: 0, I: 0, N: 0, S: 0, autoFail: 0, autoPass: 0 };
  for (const r of rows) {
    if (r.verdict === 'auto:pass') tally.autoPass++;
    else if (r.verdict === 'auto:fail') tally.autoFail++;
    else if (typeof r.verdict === 'string' && r.verdict.startsWith('human:')) {
      const ch = r.verdict.charAt('human:'.length);
      if (ch === 'P' || ch === 'I' || ch === 'N' || ch === 'S') {
        tally[ch]++;
      }
    }
  }
  return tally;
}

function commitsAheadOf(sha: string): number | null {
  try {
    const range = `${sha}..HEAD`;
    const out = execSync(`git rev-list --count ${range}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return parseInt(out, 10);
  } catch {
    return null;
  }
}

function classifyScenario(s: ScenarioStatus): ScenarioStatus['statusKey'] {
  if (s.interactiveVerdicts === 0) return 'unverdicted';
  if (s.tally.I > 0 || s.tally.autoFail > 0) return 'has-issues';
  if ((s.commitsAhead ?? 0) > 0) return 'stale';
  return 'clean';
}

interface StatusMeta {
  icon: string;
  color: (s: string) => string;
  label: string;
  sortKey: number;
}

const STATUS_META: Record<ScenarioStatus['statusKey'], StatusMeta> = {
  unverdicted: { icon: '○', color: pc.dim, label: 'unverdicted', sortKey: 0 },
  'has-issues': { icon: '⚠', color: pc.yellow, label: 'has-issues', sortKey: 1 },
  stale: { icon: '⏱', color: pc.cyan, label: 'stale', sortKey: 2 },
  clean: { icon: '✓', color: pc.green, label: 'clean', sortKey: 3 },
};

function fmtTally(tally: Tally): string {
  const parts: string[] = [];
  if (tally.P > 0) parts.push(pc.green(`P:${tally.P}`));
  if (tally.I > 0) parts.push(pc.red(`I:${tally.I}`));
  if (tally.N > 0) parts.push(pc.cyan(`N:${tally.N}`));
  if (tally.S > 0) parts.push(pc.dim(`S:${tally.S}`));
  if (tally.autoFail > 0) parts.push(pc.bold(pc.red(`auto-fail:${tally.autoFail}`)));
  return parts.join(' ');
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const summaries = loadAllSummaries();

  // Group all rows by scenarioFile.
  const byScenario = new Map<string, VerdictRow[]>();
  for (const s of summaries) {
    for (const row of s.rows ?? []) {
      const file = row.scenarioFile;
      if (!file) continue;
      let arr = byScenario.get(file);
      if (!arr) {
        arr = [];
        byScenario.set(file, arr);
      }
      arr.push(row);
    }
  }

  const featureFiles = listFeatureFiles();

  const status: ScenarioStatus[] = featureFiles.map((file) => {
    const rows = byScenario.get(file) ?? [];
    const interactiveRows = rows.filter((r) => !isAutoSkip(r));
    const latestByCheckId = new Map<string, VerdictRow>();
    for (const r of interactiveRows) {
      if (!r.checkId) continue;
      const existing = latestByCheckId.get(r.checkId);
      const newer =
        !existing ||
        new Date(r.runStartedAt ?? '').getTime() > new Date(existing.runStartedAt ?? '').getTime();
      if (newer) latestByCheckId.set(r.checkId, r);
    }
    const latestRows = [...latestByCheckId.values()];
    const tally = computeTally(latestRows);

    // Auto-fail signal: count from latest RUN only, not historical per-checkId.
    const allRunIds = [...new Set(interactiveRows.map((r) => r.runId))]
      .filter((x): x is string => Boolean(x))
      .sort((a, b) => {
        const ta = interactiveRows.find((r) => r.runId === a)?.runStartedAt ?? '';
        const tb = interactiveRows.find((r) => r.runId === b)?.runStartedAt ?? '';
        return tb.localeCompare(ta);
      });
    const latestRunId = allRunIds[0];
    const latestRunRows = latestRunId
      ? interactiveRows.filter((r) => r.runId === latestRunId)
      : [];
    tally.autoFail = latestRunRows.filter((r) => r.verdict === 'auto:fail').length;

    let latestHuman: VerdictRow | null = null;
    let latestAny: VerdictRow | null = null;
    for (const r of latestRows) {
      if (
        !latestAny ||
        new Date(r.runStartedAt ?? '').getTime() > new Date(latestAny.runStartedAt ?? '').getTime()
      ) {
        latestAny = r;
      }
      const isHuman = typeof r.verdict === 'string' && r.verdict.startsWith('human:');
      if (
        isHuman &&
        (!latestHuman ||
          new Date(r.runStartedAt ?? '').getTime() > new Date(latestHuman.runStartedAt ?? '').getTime())
      ) {
        latestHuman = r;
      }
    }

    const interactiveVerdicts = tally.P + tally.I + tally.N + tally.S;

    const base: ScenarioStatus = {
      file,
      title: (latestAny ?? latestHuman)?.scenarioTitle ?? null,
      latestHumanRunStartedAt: latestHuman?.runStartedAt ?? null,
      latestHumanGitSha: latestHuman?.gitSha ?? null,
      latestAnyGitSha: latestAny?.gitSha ?? null,
      tally,
      interactiveVerdicts,
      autoFails: tally.autoFail,
      commitsAhead: null,
      statusKey: 'unverdicted',
    };
    base.commitsAhead = base.latestHumanGitSha ? commitsAheadOf(base.latestHumanGitSha) : null;
    base.statusKey = classifyScenario(base);
    return base;
  });

  let headSha = '?';
  try {
    headSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    /* not a git repo; tolerate */
  }

  process.stderr.write('\n');
  process.stderr.write(pc.bold('SCENARIO VERDICT STATUS') + '  ' + pc.dim(`HEAD ${headSha.slice(0, 8)}`) + '\n');
  process.stderr.write(pc.dim('─'.repeat(80)) + '\n');

  const ordered = [...status].sort((a, b) => {
    const ra = STATUS_META[a.statusKey].sortKey;
    const rb = STATUS_META[b.statusKey].sortKey;
    if (ra !== rb) return ra - rb;
    return a.file.localeCompare(b.file);
  });

  for (const s of ordered) {
    const meta = STATUS_META[s.statusKey];
    const fileShort = s.file.replace('features/', '');
    const titlePart = s.title ? pc.dim(` — ${s.title}`) : '';
    process.stderr.write(
      meta.color(meta.icon + '  ' + fileShort.padEnd(40)) +
        meta.color(meta.label) +
        titlePart +
        '\n',
    );
    if (s.latestHumanRunStartedAt) {
      const date = s.latestHumanRunStartedAt.slice(0, 10);
      const sha = (s.latestHumanGitSha ?? '????????').slice(0, 8);
      const ahead =
        s.commitsAhead == null
          ? pc.dim('(sha not local)')
          : s.commitsAhead === 0
          ? pc.dim('(at HEAD)')
          : pc.cyan(`(${s.commitsAhead} commits behind HEAD)`);
      process.stderr.write(
        pc.dim('     last verdicted ') +
          date +
          pc.dim(' @ ') +
          sha +
          ' ' +
          ahead +
          '   ' +
          fmtTally(s.tally) +
          '\n',
      );
    } else if (s.tally.autoFail > 0 || s.tally.autoPass > 0) {
      const sha = (s.latestAnyGitSha ?? '????????').slice(0, 8);
      process.stderr.write(
        pc.dim('     auto-only history @ ') + sha + '   ' + fmtTally(s.tally) + '\n',
      );
    }
  }

  const counts: Record<ScenarioStatus['statusKey'], number> = {
    'has-issues': 0,
    unverdicted: 0,
    stale: 0,
    clean: 0,
  };
  for (const s of status) counts[s.statusKey]++;

  process.stderr.write(pc.dim('─'.repeat(80)) + '\n');
  process.stderr.write(
    pc.bold('Summary: ') +
      pc.green(`${counts.clean} clean`) +
      ', ' +
      pc.cyan(`${counts.stale} stale`) +
      ', ' +
      pc.yellow(`${counts['has-issues']} has-issues`) +
      ', ' +
      pc.dim(`${counts.unverdicted} unverdicted`) +
      `  (of ${featureFiles.length} total)\n\n`,
  );

  if (counts['has-issues'] > 0) {
    process.stderr.write(
      pc.dim('Hint: ') +
        pc.yellow('has-issues') +
        pc.dim(' scenarios have I-verdicts or auto-fails worth filing. ') +
        pc.dim('Run ') +
        'cabinet-verify-report-last' +
        pc.dim(' for the per-row notes from the latest run.\n'),
    );
  }
  if (counts.unverdicted > 0) {
    const unverdictedFiles = ordered
      .filter((s) => s.statusKey === 'unverdicted')
      .map((s) => s.file)
      .join(' ');
    process.stderr.write(
      pc.dim('Hint: verdict the unverdicted scenarios:\n') +
        pc.dim('      ') +
        `npm run verify:scenario -- ${unverdictedFiles}\n`,
    );
  }
  if (counts['has-issues'] > 0 || counts.stale > 0) {
    process.stderr.write(
      pc.dim('Hint: re-running? add CABINET_VERIFY_SKIP_FRESH_PASSES=1 to auto-skip\n') +
        pc.dim('      items you already P/N-verdicted, so you only see the checks\n') +
        pc.dim('      that actually need a fresh look.\n'),
    );
  }
}

main();
