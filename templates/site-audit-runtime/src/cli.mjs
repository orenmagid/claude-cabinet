// CLI entry for the site-audit engine.
//
// Phase 0 ships the arg parser and a runnable skeleton. The orchestrator,
// checks, and report wiring land in later phases — main() prints a clear
// "not yet wired" notice until then so the binary runs without crashing.

import { isSafeHref } from './security.mjs';
import { discoverChecks, auditSite, allSkipped } from './orchestrator.mjs';

/**
 * @typedef {Object} CliOptions
 * @property {'single'|'compare'} mode
 * @property {string[]} urls
 * @property {string|null} fixtureDir       --fixture-dir: run from captured tool output (CI/offline)
 * @property {number|null} overallTimeoutMs --overall-timeout: hard ceiling across all checks (seconds in, ms out)
 * @property {string|null} out              --out: report output directory
 */

/**
 * Parse argv (already sliced past `node script`) into CliOptions.
 * Supports `--flag value` and `--flag=value`. The `compare` subcommand
 * selects comparison mode and consumes the next two positionals as URLs.
 * @param {string[]} argv
 * @returns {CliOptions}
 */
export function parseArgs(argv) {
  /** @type {CliOptions} */
  const opts = { mode: 'single', urls: [], fixtureDir: null, overallTimeoutMs: null, out: null };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--fixture-dir') opts.fixtureDir = argv[++i] ?? null;
    else if (a.startsWith('--fixture-dir=')) opts.fixtureDir = a.slice('--fixture-dir='.length);
    else if (a === '--overall-timeout') opts.overallTimeoutMs = toMs(argv[++i]);
    else if (a.startsWith('--overall-timeout=')) opts.overallTimeoutMs = toMs(a.slice('--overall-timeout='.length));
    else if (a === '--out') opts.out = argv[++i] ?? null;
    else if (a.startsWith('--out=')) opts.out = a.slice('--out='.length);
    else positional.push(a);
  }

  if (positional[0] === 'compare') {
    opts.mode = 'compare';
    opts.urls = positional.slice(1, 3);
  } else {
    opts.mode = 'single';
    opts.urls = positional.slice(0, 1);
  }

  return opts;
}

function toMs(seconds) {
  const n = Number(seconds);
  return Number.isFinite(n) && n > 0 ? n * 1000 : null;
}

/**
 * Validate parsed options. Returns an error string, or null when valid.
 * @param {CliOptions} opts
 * @returns {string|null}
 */
export function validateOptions(opts) {
  const expected = opts.mode === 'compare' ? 2 : 1;
  if (opts.urls.length < expected || opts.urls.some((u) => !u)) {
    return opts.mode === 'compare'
      ? 'compare mode needs two URLs: cc-site-audit compare <url-a> <url-b>'
      : 'usage: cc-site-audit <url>  |  cc-site-audit compare <url-a> <url-b>';
  }
  for (const u of opts.urls) {
    if (!isSafeHref(u)) return `not a valid http(s) URL: ${u}`;
  }
  return null;
}

/**
 * @param {string[]} argv
 * @returns {Promise<number>} process exit code
 */
function printSummary(report) {
  process.stdout.write(`\n  Site: ${report.url}\n`);
  process.stdout.write(`  Time: ${(report.totalDurationMs / 1000).toFixed(1)}s\n\n`);
  for (const r of report.results) {
    const score = r.score !== null ? ` ${r.score}/100` : '';
    const grade = r.grade ? ` (${r.grade})` : '';
    const icon = r.status === 'pass' ? '+' : r.status === 'fail' ? '!' : r.status === 'skip' ? '-' : 'x';
    const reason = r.reason ? ` — ${r.reason}` : '';
    process.stdout.write(`  [${icon}] ${r.tool}${score}${grade}${reason}\n`);
    if (r.findings.length > 0) {
      const top = r.findings.slice(0, 3);
      for (const f of top) {
        process.stdout.write(`      ${f.severity}: ${f.message}\n`);
      }
      if (r.findings.length > 3) {
        process.stdout.write(`      ... and ${r.findings.length - 3} more\n`);
      }
    }
  }
}

/**
 * @param {string[]} argv
 * @returns {Promise<number>} process exit code
 */
export async function main(argv) {
  const opts = parseArgs(argv);
  const err = validateOptions(opts);
  if (err) {
    process.stderr.write(`${err}\n`);
    return 2;
  }
  const checks = await discoverChecks();
  if (checks.length === 0) {
    process.stderr.write('no check modules found in src/checks/ — nothing to audit\n');
    return 1;
  }

  const auditOpts = {
    fixtureDir: opts.fixtureDir,
    overallTimeoutMs: opts.overallTimeoutMs,
  };

  if (opts.mode === 'single') {
    const report = await auditSite(opts.urls[0], checks, auditOpts);

    if (allSkipped(report)) {
      process.stderr.write(
        'all checks skipped — no audit tools available.\n' +
        'Install at least one: lighthouse, @axe-core/cli, pa11y, linkinator, testssl.sh\n'
      );
      return 1;
    }

    printSummary(report);
    // HTML report wiring lands in Phase 5.
    return 0;
  }

  // Compare mode: auditSite() × 2 in parallel — no mode-branching inside checks.
  const [reportA, reportB] = await Promise.all([
    auditSite(opts.urls[0], checks, auditOpts),
    auditSite(opts.urls[1], checks, auditOpts),
  ]);

  if (allSkipped(reportA) && allSkipped(reportB)) {
    process.stderr.write('all checks skipped for both sites — no audit tools available.\n');
    return 1;
  }

  printSummary(reportA);
  process.stdout.write('\n---\n\n');
  printSummary(reportB);
  // Diff + HTML comparison report wiring lands in Phase 5.
  return 0;
}
