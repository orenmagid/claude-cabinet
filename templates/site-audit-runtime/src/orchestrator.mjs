// The orchestrator iterates registered check modules with a uniform contract:
//   detect() → is the tool available?
//   run(url, executor) → raw tool output
//   normalize(raw) → CheckResult
//
// Key design choices from the QA + security critique:
//   - Checks never know about comparison mode (auditSite()×2 + diff outside).
//   - An injectable executor replaces real safeSpawn/fetch in fixture mode,
//     so the whole pipeline is testable in CI with zero installed tools.
//   - Per-tool + overall timeouts prevent hangs on adversarial/slow targets.
//   - status:'skip' for missing tools, status:'error' for timeouts — never a
//     silent pass (the #1 correctness trap the QA review blocked on).

import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { validateCheckResult } from './schema.mjs';
import { safeSpawn } from './security.mjs';

/**
 * @typedef {Object} CheckModule
 * @property {string} checkId
 * @property {string} tool
 * @property {(executor: Executor) => Promise<boolean>} detect
 * @property {(url: string, executor: Executor) => Promise<*>} run
 * @property {(raw: *, durationMs: number) => import('./schema.mjs').CheckResult} normalize
 * @property {number} [defaultTimeoutMs]
 */

/**
 * @typedef {Object} Executor
 * @property {typeof safeSpawn} spawn
 * @property {typeof globalThis.fetch} fetch
 */

/**
 * @typedef {Object} AuditOptions
 * @property {Executor} [executor]
 * @property {Record<string, number>} [timeouts]     Per-check override: { checkId: ms }
 * @property {number} [overallTimeoutMs]
 * @property {string|null} [fixtureDir]
 * @property {Set<string>|null} [enabledChecks]       null = all
 * @property {Record<string, object>} [checkOpts]    Per-check options: { checkId: { ... } }
 */

/**
 * @typedef {Object} SiteReport
 * @property {string} url
 * @property {string} auditedAt
 * @property {import('./schema.mjs').CheckResult[]} results
 * @property {number} totalDurationMs
 */

const DEFAULT_TIMEOUTS = {
  lighthouse: 120_000,
  testssl: 180_000,
  nuclei: 300_000,
  unlighthouse: 300_000,
  blacklight: 120_000,
};
const FALLBACK_TIMEOUT = 60_000;
const MAX_CONCURRENCY = 4;

/**
 * Discover check modules by looking for .mjs files in src/checks/.
 * Resolved relative to this file so it works from the installed runtime dir.
 * @returns {Promise<CheckModule[]>}
 */
export async function discoverChecks() {
  const checksDir = new URL('./checks/', import.meta.url);
  // Node 20.11+ supports fs.readdirSync with URL; fallback for earlier:
  const { readdirSync } = await import('node:fs');
  const dirPath = new URL('.', checksDir).pathname;
  if (!existsSync(dirPath)) return [];
  const entries = readdirSync(dirPath).filter((f) => f.endsWith('.mjs'));
  const modules = [];
  for (const f of entries) {
    const mod = await import(new URL(f, checksDir).href);
    if (mod.checkId && mod.detect && mod.run && mod.normalize) {
      modules.push(mod);
    }
  }
  return modules;
}

/**
 * Build an executor backed by fixture files instead of real tools.
 * Each fixture file is tests/fixtures/<checkId>.json.
 * @param {string} fixtureDir
 * @returns {Executor}
 */
export function fixtureExecutor(fixtureDir) {
  return {
    async spawn(cmd, args = [], opts = {}) {
      const checkId = guessCheckId(cmd, args);
      const fixturePath = join(fixtureDir, `${checkId}.json`);
      if (existsSync(fixturePath)) {
        return { code: 0, stdout: readFileSync(fixturePath, 'utf8'), stderr: '', timedOut: false };
      }
      return { code: 1, stdout: '', stderr: `fixture not found: ${fixturePath}`, timedOut: false };
    },
    async fetch(url, init) {
      return new Response('{}', { status: 200, headers: {} });
    },
  };
}

function guessCheckId(cmd, args) {
  const allTokens = [cmd, ...args].join(' ').toLowerCase();
  if (allTokens.includes('lighthouse')) return 'lighthouse';
  if (allTokens.includes('axe')) return 'axe-core';
  if (allTokens.includes('pa11y')) return 'pa11y';
  if (allTokens.includes('linkinator')) return 'linkinator';
  if (allTokens.includes('testssl')) return 'testssl';
  if (allTokens.includes('nuclei')) return 'nuclei';
  if (allTokens.includes('unlighthouse')) return 'unlighthouse';
  if (allTokens.includes('observatory')) return 'observatory';
  if (allTokens.includes('blacklight')) return 'blacklight';
  if (allTokens.includes('dig')) return 'dns';
  if (allTokens.includes('openssl')) return 'ssl-cert';
  return basename(cmd).replace(/\.\w+$/, '');
}

function realExecutor() {
  return {
    spawn: safeSpawn,
    fetch: globalThis.fetch,
  };
}

/**
 * Run all checks against a single URL and return a SiteReport.
 * @param {string} url
 * @param {CheckModule[]} checks
 * @param {AuditOptions} [opts]
 * @returns {Promise<SiteReport>}
 */
export async function auditSite(url, checks, opts = {}) {
  const executor = opts.fixtureDir
    ? fixtureExecutor(opts.fixtureDir)
    : opts.executor ?? realExecutor();
  const timeouts = opts.timeouts ?? {};
  const overallDeadline = opts.overallTimeoutMs
    ? Date.now() + opts.overallTimeoutMs
    : Infinity;

  const filtered = opts.enabledChecks
    ? checks.filter((c) => opts.enabledChecks.has(c.checkId))
    : checks;

  const results = [];
  const queue = [...filtered];

  async function processCheck(check) {
    if (Date.now() >= overallDeadline) {
      return {
        checkId: check.checkId,
        tool: check.tool,
        status: 'error',
        score: null,
        grade: null,
        severity: null,
        findings: [],
        durationMs: 0,
        reason: 'overall timeout exceeded',
      };
    }

    const baseTimeout =
      timeouts[check.checkId] ??
      check.defaultTimeoutMs ??
      DEFAULT_TIMEOUTS[check.checkId] ??
      FALLBACK_TIMEOUT;
    const remainingBudget = Math.max(0, overallDeadline - Date.now());
    const perToolTimeout = overallDeadline === Infinity
      ? baseTimeout
      : Math.min(baseTimeout, remainingBudget);

    const start = Date.now();
    let available;
    try {
      available = await check.detect(executor);
    } catch {
      available = false;
    }

    if (!available) {
      return {
        checkId: check.checkId,
        tool: check.tool,
        status: 'skip',
        score: null,
        grade: null,
        severity: null,
        findings: [],
        durationMs: Date.now() - start,
        reason: `${check.tool} not available`,
      };
    }

    try {
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => resolve({ __timedOut: true }), perToolTimeout)
      );
      const perCheckOpts = (opts.checkOpts ?? {})[check.checkId] ?? {};
      const runPromise = check.run(url, executor, perCheckOpts);
      const raw = await Promise.race([runPromise, timeoutPromise]);

      if (raw && raw.__timedOut) {
        return {
          checkId: check.checkId,
          tool: check.tool,
          status: 'error',
          score: null,
          grade: null,
          severity: null,
          findings: [],
          durationMs: Date.now() - start,
          reason: `timeout after ${Math.round(perToolTimeout / 1000)}s`,
        };
      }

      const result = check.normalize(raw, Date.now() - start);
      const { valid, errors } = validateCheckResult(result);
      if (!valid) {
        return {
          checkId: check.checkId,
          tool: check.tool,
          status: 'error',
          score: null,
          grade: null,
          severity: null,
          findings: [],
          durationMs: Date.now() - start,
          reason: `normalize produced invalid CheckResult: ${errors.join('; ')}`,
        };
      }
      return result;
    } catch (err) {
      return {
        checkId: check.checkId,
        tool: check.tool,
        status: 'error',
        score: null,
        grade: null,
        severity: null,
        findings: [],
        durationMs: Date.now() - start,
        reason: String(err?.message ?? err),
      };
    }
  }

  // Bounded concurrency: run up to MAX_CONCURRENCY checks at a time.
  async function runPool() {
    const executing = new Set();
    for (const check of queue) {
      const p = processCheck(check).then((r) => {
        results.push(r);
        executing.delete(p);
      });
      executing.add(p);
      if (executing.size >= MAX_CONCURRENCY) {
        await Promise.race(executing);
      }
    }
    await Promise.all(executing);
  }

  const totalStart = Date.now();
  await runPool();

  return {
    url,
    auditedAt: new Date().toISOString(),
    results,
    totalDurationMs: Date.now() - totalStart,
  };
}

/**
 * True when every check was skipped — a sign that no tools are installed,
 * which should exit non-zero instead of producing a misleading clean report.
 * @param {SiteReport} report
 * @returns {boolean}
 */
export function allSkipped(report) {
  return report.results.length > 0 && report.results.every((r) => r.status === 'skip');
}
