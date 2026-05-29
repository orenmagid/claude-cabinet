// Unlighthouse crawls every page and runs Lighthouse on each, producing
// aggregated scores. Heavier than single-page Lighthouse — use for
// multi-page audit coverage.

import { readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export const checkId = 'unlighthouse';
export const tool = 'Unlighthouse (full-site crawl)';
export const whyItMatters = "Runs Lighthouse on every page of your site, not just the homepage — catches performance and accessibility problems hiding on inner pages.";
export const defaultTimeoutMs = 900_000;

export async function detect(executor) {
  const r = await executor.spawn('unlighthouse', ['--version'], { timeoutMs: 15_000 });
  return r.code === 0;
}

export async function run(url, executor) {
  const outDir = join(process.cwd(), '.unlighthouse-tmp');
  try { rmSync(outDir, { recursive: true, force: true }); } catch { /* ok */ }

  const r = await executor.spawn('unlighthouse-ci', [
    '--site', url,
    '--reporter', 'jsonExpanded',
    '--output-path', outDir,
    '--samples', '5',
  ], { timeoutMs: 600_000 });

  // Read the JSON report from the output directory
  try {
    const reportDir = join(outDir, 'ci-result');
    if (existsSync(reportDir)) {
      const files = readdirSync(reportDir).filter(f => f.endsWith('.json'));
      if (files.length) {
        const json = readFileSync(join(reportDir, files[0]), 'utf8');
        return { code: r.code, stdout: json, stderr: r.stderr, timedOut: r.timedOut };
      }
    }
    // Fallback: try .unlighthouse directory
    const altDir = join(outDir);
    const altFiles = existsSync(altDir) ? readdirSync(altDir).filter(f => f.endsWith('.json')) : [];
    if (altFiles.length) {
      const json = readFileSync(join(altDir, altFiles[0]), 'utf8');
      return { code: r.code, stdout: json, stderr: r.stderr, timedOut: r.timedOut };
    }
  } catch { /* fall through */ }

  return r;
}

export function normalize(raw, durationMs) {
  if (raw.timedOut) {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: 'timed out (full-site crawl may need more time)' };
  }
  if (raw.code !== 0 && !raw.stdout) {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: raw.stderr?.slice(0, 200) || 'unlighthouse failed' };
  }

  let data;
  try { data = JSON.parse(raw.stdout); } catch {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: 'failed to parse unlighthouse JSON' };
  }

  const routes = Array.isArray(data) ? data : (data.routes || data.pages || [data]);
  const findings = [];
  let totalScore = 0;
  let count = 0;

  for (const route of routes) {
    const path = route.path || route.url || route.route || 'unknown';
    const score = typeof route.score === 'number'
      ? Math.round(route.score * (route.score <= 1 ? 100 : 1))
      : null;
    if (score !== null) {
      totalScore += score;
      count++;
      if (score < 50) {
        findings.push({ severity: 'serious', message: `Low score on ${path}: ${score}/100` });
      } else if (score < 75) {
        findings.push({ severity: 'moderate', message: `Below average on ${path}: ${score}/100` });
      }
    }
  }

  const avg = count > 0 ? Math.round(totalScore / count) : null;

  const worstSev = findings.length ? findings.reduce((w, f) => {
    const o = { critical: 0, serious: 1, moderate: 2, info: 3 };
    return (o[f.severity] ?? 3) < (o[w] ?? 3) ? f.severity : w;
  }, 'info') : null;

  const isPass = avg !== null && avg >= 50;
  const passSummary = isPass
    ? `Average score ${avg}/100 across ${count} page${count !== 1 ? 's' : ''}`
    : undefined;

  return {
    checkId, tool, status: isPass ? 'pass' : 'fail',
    score: avg, grade: null, severity: worstSev,
    findings, durationMs,
    ...(passSummary && { passSummary }),
  };
}
