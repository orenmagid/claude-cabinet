import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { out } from './output.js';

/**
 * Verdict ledger. Schema is shared with Phase F's review-server reporter
 * — keep field names stable. Append-mode writes mean Ctrl-C survives
 * (every verdict is on disk before the next step starts).
 */

export interface VerdictRow {
  runId: string;
  runStartedAt: string; // ISO timestamp
  gitSha: string;
  scenarioFile: string;
  scenarioTitle: string;
  stepText: string;
  checkId: string;
  /** Content-aware hash of the scenario path leading to this step.
   *  sha256 of the newline-joined step texts from scenario start through
   *  and including the target step, truncated to 16 hex chars. See
   *  CONVENTIONS.md §pathHash Spec. Empty string for `auto` rows where
   *  pathHash isn't computed; human-verdict rows are non-empty (the
   *  human-verdict call site is responsible for that invariant). */
  pathHash: string;
  acItemId: string | null; // optional mapping → external review-UI item ID; null if no mapping
  verdict: string; // 'auto:pass' | 'auto:fail' | 'human:P' | 'human:I' | 'human:S' | 'human:N'
  source: 'auto' | 'human';
  screenshotPath: string | null;
  notes: string | null;
  durationMs: number;
  role: string;
  costUsd: number | null;
}

export interface RunSummary {
  runId: string;
  runStartedAt: string;
  reportPath: string;
  total: number;
  passed: number;
  failed: number;
  humanVerdicts: number;
}

interface RecorderState {
  runId: string;
  runStartedAt: string;
  gitSha: string;
  jsonlPath: string;
  summaryPath: string;
  rows: VerdictRow[];
  scenarioFile: string;
  scenarioTitle: string;
  role: string;
}

let state: RecorderState | null = null;

function getGitSha(): string {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

function validateRow(row: VerdictRow): void {
  const requiredStr: (keyof VerdictRow)[] = [
    'runId',
    'runStartedAt',
    'gitSha',
    'scenarioFile',
    'scenarioTitle',
    'stepText',
    'checkId',
    'verdict',
    'source',
    'role',
  ];
  for (const k of requiredStr) {
    if (typeof row[k] !== 'string' || (row[k] as string).length === 0) {
      throw new Error(`verdict-recorder: row missing or empty required string field "${k}"`);
    }
  }
  if (!['auto', 'human'].includes(row.source)) {
    throw new Error(`verdict-recorder: invalid source "${row.source}"`);
  }
  if (typeof row.durationMs !== 'number' || row.durationMs < 0) {
    throw new Error(`verdict-recorder: invalid durationMs "${row.durationMs}"`);
  }
  if (typeof row.pathHash !== 'string') {
    throw new Error(`verdict-recorder: pathHash must be a string (got ${typeof row.pathHash})`);
  }
}

/**
 * Prune accumulated artifacts older than `maxAgeDays`. Per-check
 * screenshots overwrite naturally (named by checkId), so only the
 * timestamped failure screenshots and run reports grow unboundedly.
 */
async function pruneOldArtifacts(maxAgeDays: number): Promise<void> {
  const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let pruned = 0;

  // File-pattern targets: failure screenshots + run reports
  const fileTargets = [
    { dir: path.resolve(process.cwd(), 'screenshots'), pattern: /^failure-.*\.png$/ },
    { dir: path.resolve(process.cwd(), 'reports'), pattern: /^run-.*\.(jsonl|summary\.json)$/ },
  ];
  for (const { dir, pattern } of fileTargets) {
    let entries: string[] = [];
    try {
      entries = await fs.readdir(dir);
    } catch {
      continue; // dir doesn't exist yet — skip
    }
    for (const name of entries) {
      if (!pattern.test(name)) continue;
      const full = path.join(dir, name);
      try {
        const stat = await fs.stat(full);
        if (stat.mtimeMs < cutoffMs) {
          await fs.unlink(full);
          pruned++;
        }
      } catch {
        // race / permission — best-effort
      }
    }
  }

  // Directory target: downloads/<runId>/ — recursive remove of stale runs.
  // Each run's dir contains downloaded files; dir mtime ≈ last download.
  const downloadsDir = path.resolve(process.cwd(), 'downloads');
  let runDirs: string[] = [];
  try {
    runDirs = await fs.readdir(downloadsDir);
  } catch {
    // dir doesn't exist yet — fine
  }
  for (const runDir of runDirs) {
    const full = path.join(downloadsDir, runDir);
    try {
      const stat = await fs.stat(full);
      if (stat.isDirectory() && stat.mtimeMs < cutoffMs) {
        await fs.rm(full, { recursive: true, force: true });
        pruned++;
      }
    } catch {
      // race / permission — best-effort
    }
  }

  if (pruned > 0) {
    process.stderr.write(`  (pruned ${pruned} artifact${pruned === 1 ? '' : 's'} older than ${maxAgeDays} days)\n`);
  }
}

export async function startRun(): Promise<string> {
  const runStartedAt = new Date().toISOString();
  const runId = `run-${runStartedAt.replace(/[:.]/g, '-')}`;
  const reportsDir = path.resolve(process.cwd(), 'reports');
  await fs.mkdir(reportsDir, { recursive: true });

  // Prune anything older than 7 days. Recent artifacts stay available
  // for re-inspection (open old screenshots, re-read old reports).
  await pruneOldArtifacts(7);

  const jsonlPath = path.join(reportsDir, `${runId}.jsonl`);
  const summaryPath = path.join(reportsDir, `${runId}.summary.json`);

  state = {
    runId,
    runStartedAt,
    gitSha: getGitSha(),
    jsonlPath,
    summaryPath,
    rows: [],
    scenarioFile: '',
    scenarioTitle: '',
    role: '',
  };

  // Write a header line to the jsonl so a partial file is identifiable
  await fs.writeFile(
    jsonlPath,
    JSON.stringify({ kind: 'run-start', runId, runStartedAt, gitSha: state.gitSha }) + '\n',
    'utf8'
  );

  out.runStart(runId, state.gitSha, jsonlPath);

  return runId;
}

export function setScenarioContext(file: string, title: string, role: string): void {
  if (!state) throw new Error('verdict-recorder: setScenarioContext called before startRun');
  state.scenarioFile = file;
  state.scenarioTitle = title;
  state.role = role || state.role;
}

/** Read-only access to the current scenario's file path (relative to
 *  e2e/, e.g. "features/01-desktop-rewrite.feature"). Used by the
 *  fresh-pass cache to look up prior verdicts for the active scenario.
 *  Returns empty string before any scenario has started. */
export function getCurrentScenarioFile(): string {
  return state?.scenarioFile ?? '';
}

export interface RecordInput {
  checkId: string;
  stepText: string;
  verdict: string;
  source: 'auto' | 'human';
  screenshotPath?: string | null;
  notes?: string | null;
  durationMs: number;
  /** Content-aware hash for the (scenarioFile, checkId) cache key. See
   *  VerdictRow.pathHash. Defaults to empty string when not supplied
   *  (auto rows). Human-verdict callers must provide it. */
  pathHash?: string;
  acItemId?: string | null;
  costUsd?: number | null;
}

export async function recordVerdict(input: RecordInput): Promise<void> {
  if (!state) throw new Error('verdict-recorder: recordVerdict called before startRun');

  const row: VerdictRow = {
    runId: state.runId,
    runStartedAt: state.runStartedAt,
    gitSha: state.gitSha,
    scenarioFile: state.scenarioFile,
    scenarioTitle: state.scenarioTitle,
    stepText: input.stepText,
    checkId: input.checkId,
    pathHash: input.pathHash ?? '',
    acItemId: input.acItemId ?? null,
    verdict: input.verdict,
    source: input.source,
    screenshotPath: input.screenshotPath ?? null,
    notes: input.notes ?? null,
    durationMs: input.durationMs,
    role: state.role,
    costUsd: input.costUsd ?? null,
  };

  validateRow(row);
  state.rows.push(row);

  // Append-mode: every verdict on disk before next step starts.
  await fs.appendFile(state.jsonlPath, JSON.stringify(row) + '\n', 'utf8');
}

export async function endRun(): Promise<RunSummary> {
  if (!state) {
    return {
      runId: 'no-run',
      runStartedAt: new Date().toISOString(),
      reportPath: '',
      total: 0,
      passed: 0,
      failed: 0,
      humanVerdicts: 0,
    };
  }

  const total = state.rows.length;
  const passed = state.rows.filter(
    (r) => r.verdict === 'auto:pass' || r.verdict === 'human:P' || r.verdict === 'human:N'
  ).length;
  const failed = state.rows.filter(
    (r) => r.verdict === 'auto:fail' || r.verdict === 'human:I'
  ).length;
  const humanVerdicts = state.rows.filter((r) => r.source === 'human').length;

  const summary: RunSummary & { rows: VerdictRow[] } = {
    runId: state.runId,
    runStartedAt: state.runStartedAt,
    reportPath: state.summaryPath,
    total,
    passed,
    failed,
    humanVerdicts,
    rows: state.rows,
  };

  await fs.writeFile(state.summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  const result: RunSummary = {
    runId: state.runId,
    runStartedAt: state.runStartedAt,
    reportPath: state.summaryPath,
    total,
    passed,
    failed,
    humanVerdicts,
  };

  state = null;
  return result;
}

export function getCurrentRunId(): string | null {
  return state?.runId ?? null;
}

export function getCurrentRows(): readonly VerdictRow[] {
  return state?.rows ?? [];
}
