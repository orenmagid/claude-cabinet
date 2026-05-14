/**
 * Fresh-pass cache.
 *
 * When `CABINET_VERIFY_SKIP_FRESH_PASSES=1` is set, the human-verdict
 * pause and the manual-checklist runner consult this module to decide
 * whether to prompt the operator or auto-record `S` (skip).
 *
 * "Fresh pass" = the most recent human verdict for this
 * (scenarioFile, checkId, pathHash) combo is `human:P` or `human:N`.
 * AUTO_SKIP smoke rows and SKIP_FRESH_PASSES auto-skip rows are
 * filtered out — they don't count as real verdicts.
 *
 * The pathHash third component of the cache key is what makes the cache
 * content-aware (CONVENTIONS.md §pathHash Spec). Editing a step in a
 * scenario changes the pathHash of every step after it, which lookup-
 * misses the prior P/N verdict and re-prompts the operator. See
 * Phase 2 of the cabinet-verify extraction for the design rationale.
 *
 * Built lazily from `reports/*.jsonl` on first call. Re-reads cheaply;
 * no caching across process invocations (the cucumber-js process is
 * always fresh per `verify:*` invocation).
 *
 * Why per-run rebuild instead of a persistent cache: the verdict
 * ledger is the source of truth. A persistent cache would have to be
 * invalidated whenever the user re-runs a scenario, which is too
 * easy to get wrong. JSONL parsing across all reports takes <100 ms
 * even after 50+ runs.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPORTS_DIR_REL = 'reports';

interface FreshPassRow {
  scenarioFile: string;
  checkId: string;
  pathHash: string;
  verdict: string;
  runStartedAt: string;
  gitSha: string;
  notes: string | null;
}

let cache: Map<string, FreshPassRow> | null = null;

function key(scenarioFile: string, checkId: string, pathHash: string): string {
  return `${scenarioFile}::${checkId}::${pathHash}`;
}

function isAutoSkip(notes: string | null): boolean {
  return notes === 'AUTO_SKIP=1 (smoke run)';
}

/**
 * Rows written by the SKIP_FRESH_PASSES auto-skip path (this module's
 * own consumers in human-verdict.ts and manual-runner.ts). They look
 * like real `human:S` rows but they're a passthrough — the operator
 * never typed S. Without filtering them, the FIRST run with
 * SKIP_FRESH_PASSES=1 records S rows for previously-passed checks,
 * and the SECOND run sees those S rows as "latest verdict" and
 * decides the check is no longer fresh, re-prompting the operator
 * for everything they thought they'd skipped. The check below
 * matches the prefix written by both call sites.
 */
function isSkippedFreshPass(notes: string | null): boolean {
  return notes !== null && notes.startsWith('SKIP_FRESH_PASSES=1;');
}

function loadCache(): Map<string, FreshPassRow> {
  if (cache !== null) return cache;
  cache = new Map();
  const reportsDir = path.resolve(process.cwd(), REPORTS_DIR_REL);
  if (!fs.existsSync(reportsDir)) return cache;
  const jsonlFiles = fs
    .readdirSync(reportsDir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => path.join(reportsDir, f));
  for (const file of jsonlFiles) {
    let text: string;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      let row: FreshPassRow;
      try {
        const parsed = JSON.parse(line);
        if (
          typeof parsed.scenarioFile !== 'string' ||
          typeof parsed.checkId !== 'string' ||
          typeof parsed.verdict !== 'string' ||
          typeof parsed.runStartedAt !== 'string'
        ) {
          continue;
        }
        // Legacy rows (pre-pathHash, written before this schema change)
        // do NOT get a conjured pathHash. Conjuring one from the
        // CURRENT .feature content would silently match a current-run
        // pathHash on edited content — defeating the entire content-
        // aware invariant. Such rows are skipped so the operator
        // re-verdicts them against the new content. This is the
        // conservative-over-fine bias documented in CONVENTIONS.md.
        const pathHash =
          typeof parsed.pathHash === 'string' && parsed.pathHash.length > 0
            ? parsed.pathHash
            : '';
        if (!pathHash) continue;
        row = {
          scenarioFile: parsed.scenarioFile,
          checkId: parsed.checkId,
          pathHash,
          verdict: parsed.verdict,
          runStartedAt: parsed.runStartedAt,
          gitSha: parsed.gitSha ?? '',
          notes: parsed.notes ?? null,
        };
      } catch {
        continue;
      }
      // Filter AUTO_SKIP smoke rows — they're not real verdicts.
      if (isAutoSkip(row.notes)) continue;
      // Filter rows written by the skip-fresh-pass auto-skip path
      // itself. Without this filter the cache's "latest verdict" for
      // a previously-passed check becomes the auto-recorded S row,
      // and the next run re-prompts the operator for everything they
      // already P/N-verdicted.
      if (isSkippedFreshPass(row.notes)) continue;
      // Only consider human verdicts (auto-pass / auto-fail aren't
      // human verdicts; they don't gate the skip-fresh-passes path).
      if (!row.verdict.startsWith('human:')) continue;
      const k = key(row.scenarioFile, row.checkId, row.pathHash);
      const existing = cache.get(k);
      const newer =
        !existing ||
        new Date(row.runStartedAt).getTime() > new Date(existing.runStartedAt).getTime();
      if (newer) cache.set(k, row);
    }
  }
  return cache;
}

/**
 * Returns true if the given (scenarioFile, checkId, currentPathHash)
 * has a fresh human:P or human:N verdict in the ledger AND skipping is
 * enabled via env var. The caller (askHumanVerdict / walkManualChecklist)
 * uses this to short-circuit the prompt.
 *
 * `scenarioFile` should be the relative path Cucumber records (e.g.
 * "features/01-desktop-rewrite.feature"). `checkId` is the
 * checkId for the step (e.g. "1.04"). `currentPathHash` is the path-
 * aware hash for the same step computed from the CURRENT .feature
 * content — if it differs from the cached row's hash, the verdict
 * doesn't apply.
 */
export function isFreshPass(
  scenarioFile: string,
  checkId: string,
  currentPathHash: string,
): boolean {
  if (process.env.CABINET_VERIFY_SKIP_FRESH_PASSES !== '1') return false;
  const c = loadCache();
  const row = c.get(key(scenarioFile, checkId, currentPathHash));
  if (!row) return false;
  return row.verdict === 'human:P' || row.verdict === 'human:N';
}

/**
 * Same as `isFreshPass` but returns the recorded row when matched —
 * used by the auto-skip path to write a useful notes field
 * ("skipped — fresh pass at <date> @ <sha>") to the new ledger row.
 */
export function getFreshPass(
  scenarioFile: string,
  checkId: string,
  currentPathHash: string,
): FreshPassRow | null {
  if (process.env.CABINET_VERIFY_SKIP_FRESH_PASSES !== '1') return null;
  const c = loadCache();
  const row = c.get(key(scenarioFile, checkId, currentPathHash));
  if (!row) return null;
  if (row.verdict !== 'human:P' && row.verdict !== 'human:N') return null;
  return row;
}

/** For testing — reset the cache between scenarios that mutate the ledger. */
export function _clearFreshPassCache(): void {
  cache = null;
}

export type { FreshPassRow };
