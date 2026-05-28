// Security helpers shared by every check module and the HTML report.
//
// These exist because /cc-site-audit takes a user-supplied URL and feeds it to
// external tools, then embeds target-scraped content (titles, headers, meta)
// into a report file. Both are injection surfaces. The mitigations are
// centralized here so no individual check can get them wrong:
//
//   - safeSpawn:        never constructs a shell string. spawn + arg array,
//                       shell:false. A malicious URL is an inert argument.
//   - esc:              HTML-escapes target content before it lands in a report,
//                       preventing stored XSS in the generated HTML.
//   - isSafeHref:       gates href values to http/https (blocks javascript: URLs).
//   - sanitizeHostname: makes a URL hostname safe to use in a filename.

import { spawn } from 'node:child_process';

/**
 * HTML-escape a value before interpolating it into the report.
 * @param {unknown} str
 * @returns {string}
 */
export function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Reduce a URL to a filesystem-safe hostname for report filenames.
 * URL.hostname already strips path/query, so traversal sequences in the
 * path cannot reach the filename; this additionally neutralizes any
 * non-portable characters (e.g. punycode-decoded IDN output).
 * @param {string} url
 * @returns {string}
 */
export function sanitizeHostname(url) {
  return new URL(url).hostname.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * True only for http/https URLs. Use before emitting a value as an href
 * so a scraped `javascript:` URL is rendered as text, not a live link.
 * @param {unknown} url
 * @returns {boolean}
 */
export function isSafeHref(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Spawn an external tool safely.
 *
 * NEVER builds a shell command string — args are passed as an explicit array
 * with shell:false, so user-supplied URLs cannot be interpreted by a shell.
 * Always resolves (never rejects); a spawn error or timeout is reported via
 * the returned object so callers can normalize it to a CheckResult.
 *
 * @param {string} cmd
 * @param {string[]} [args]
 * @param {{ timeoutMs?: number, input?: string, env?: NodeJS.ProcessEnv, cwd?: string }} [opts]
 * @returns {Promise<{ code: number|null, stdout: string, stderr: string, timedOut: boolean }>}
 */
export function safeSpawn(cmd, args = [], opts = {}) {
  if (!Array.isArray(args)) {
    throw new TypeError('safeSpawn args must be an array — no shell-string interpolation');
  }
  const { timeoutMs = 60000, input, env, cwd } = opts;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const child = spawn(cmd, args, {
      env: env ?? process.env,
      cwd,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    };

    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      stderr += String(err?.message ?? err);
      finish(typeof err?.code === 'number' ? err.code : -1);
    });
    child.on('close', (code) => finish(code));

    if (input != null) {
      child.stdin?.write(input);
      child.stdin?.end();
    }
  });
}
