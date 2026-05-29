// Unlighthouse crawls every page and runs Lighthouse on each, producing
// aggregated scores. Heavier than single-page Lighthouse — use for
// multi-page audit coverage.

export const checkId = 'unlighthouse';
export const tool = 'Unlighthouse (full-site crawl)';
export const defaultTimeoutMs = 600_000;

export async function detect(executor) {
  const r = await executor.spawn('unlighthouse', ['--version'], { timeoutMs: 15_000 });
  return r.code === 0;
}

export async function run(url, executor) {
  return executor.spawn('unlighthouse', [
    '--site', url, '--ci', '--reporter', 'json',
  ], { timeoutMs: 300_000 });
}

export function normalize(raw, durationMs) {
  if (raw.code !== 0 && !raw.stdout) {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: raw.stderr || 'unlighthouse failed' };
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
