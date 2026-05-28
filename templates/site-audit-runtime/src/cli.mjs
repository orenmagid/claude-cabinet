// CLI entry for the site-audit engine.
//
// Phase 0 ships the arg parser and a runnable skeleton. The orchestrator,
// checks, and report wiring land in later phases — main() prints a clear
// "not yet wired" notice until then so the binary runs without crashing.

import { isSafeHref } from './security.mjs';

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
export async function main(argv) {
  const opts = parseArgs(argv);
  const err = validateOptions(opts);
  if (err) {
    process.stderr.write(`${err}\n`);
    return 2;
  }
  // Engine wiring (orchestrator + checks + report) lands in Phase 1+.
  process.stdout.write(
    `cc-site-audit ${opts.mode} mode\n` +
      `  targets: ${opts.urls.join(', ')}\n` +
      '  (audit engine not yet wired — Phase 0 scaffold only)\n'
  );
  return 0;
}
