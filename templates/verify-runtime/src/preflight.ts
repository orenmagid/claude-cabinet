/**
 * Generic dev-stack reachability preflight.
 *
 * The value here is the pattern (fetch with timeout + clear error
 * message), not the URLs — projects supply their own URLs via env
 * vars or function arguments.
 *
 * Two surface levels:
 *  - `preflight()`: low-level, takes opts, throws on unreachable.
 *  - `runPreflightCli()`: thin CLI wrapper used by the
 *    `cabinet-verify-preflight` bin; reads CABINET_VERIFY_DEV_URL,
 *    prints results to stderr, exits 0/1.
 *
 * Consuming projects with extra checks (fixture-file presence, env-
 * var completeness, platform detection) wrap `preflight()` in their
 * own `e2e/scripts/preflight.mjs` that runs project-specific checks
 * alongside the runtime call.
 */

export interface PreflightOptions {
  /** Full URL whose health is being verified. Required. */
  devStackUrl: string;
  /** Optional path appended to devStackUrl for the health probe.
   *  When absent, probes `devStackUrl` directly. */
  healthEndpoint?: string;
  /** Abort the fetch after this many milliseconds (default 5000). */
  timeoutMs?: number;
}

/**
 * Probe `devStackUrl + healthEndpoint` and throw an Error whose
 * message includes the URL and the literal phrase "stack unreachable"
 * if it doesn't return a 2xx (or 304) response within timeoutMs.
 *
 * Returns silently on success.
 */
export async function preflight(opts: PreflightOptions): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  const url = opts.healthEndpoint
    ? `${opts.devStackUrl.replace(/\/$/, '')}${opts.healthEndpoint}`
    : opts.devStackUrl;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok && r.status !== 304) {
      throw new Error(
        `stack unreachable: ${url} returned HTTP ${r.status}. ` +
          `Check the dev stack is running.`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('stack unreachable')) {
      throw err;
    }
    throw new Error(
      `stack unreachable at ${url}: ${msg}. ` +
        `Verify the dev stack is running and the URL is correct.`,
    );
  }
}

/**
 * Run preflight from a CLI context. Reads CABINET_VERIFY_DEV_URL (or
 * --url flag) and an optional --health-endpoint flag. Prints success
 * to stderr and exits 0, or prints the failure message to stderr and
 * exits 1.
 *
 * The bin `cabinet-verify-preflight` calls this. Consuming projects
 * may also call it from their own preflight script to delegate the
 * runtime portion.
 */
export async function runPreflightCli(argv: string[]): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stderr.write(
      `cabinet-verify-preflight — verify dev stack reachability before a run.\n\n` +
        `Usage:\n` +
        `  cabinet-verify-preflight [--url <devStackUrl>] [--health-endpoint <path>] [--timeout <ms>]\n\n` +
        `Env:\n` +
        `  CABINET_VERIFY_DEV_URL    Default URL when --url is absent (e.g. http://localhost:5173)\n\n` +
        `Exit codes:\n` +
        `  0  reachable\n` +
        `  1  unreachable (stack down, wrong URL, timeout)\n`,
    );
    return 0;
  }

  const urlArg = readArg(argv, '--url');
  const endpointArg = readArg(argv, '--health-endpoint');
  const timeoutArg = readArg(argv, '--timeout');

  const devStackUrl = urlArg || process.env.CABINET_VERIFY_DEV_URL;
  if (!devStackUrl) {
    process.stderr.write(
      `cabinet-verify-preflight: no URL specified.\n` +
        `Pass --url <url> or set CABINET_VERIFY_DEV_URL.\n`,
    );
    return 1;
  }
  const timeoutMs = timeoutArg ? Number.parseInt(timeoutArg, 10) : undefined;

  try {
    await preflight({
      devStackUrl,
      healthEndpoint: endpointArg || undefined,
      timeoutMs,
    });
    process.stderr.write(`  ✓ reachable: ${devStackUrl}${endpointArg ?? ''}\n`);
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`  ✗ ${msg}\n`);
    return 1;
  }
}

function readArg(argv: string[], flag: string): string | null {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx === argv.length - 1) return null;
  return argv[idx + 1];
}
