export const checkId = 'pa11y';
export const tool = 'Pa11y (WCAG AAA)';
export const whyItMatters = "Stricter accessibility testing (WCAG AAA) — catches issues that basic checks miss, like low contrast text and missing form labels.";

export async function detect(executor) {
  const r = await executor.spawn('pa11y', ['--version'], { timeoutMs: 15_000 });
  return r.code === 0;
}

export async function run(url, executor) {
  return executor.spawn('pa11y', [url, '--reporter', 'json', '--standard', 'WCAG2AAA'], { timeoutMs: 60_000 });
}

const TYPE_TO_SEVERITY = { error: 'serious', warning: 'moderate', notice: 'info' };

export function normalize(raw, durationMs) {
  if (raw.code !== 0 && !raw.stdout) {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: raw.stderr || 'pa11y failed' };
  }

  let issues;
  try { issues = JSON.parse(raw.stdout); } catch {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: 'failed to parse pa11y JSON' };
  }

  if (!Array.isArray(issues)) issues = [];

  const findings = issues.map(i => ({
    severity: TYPE_TO_SEVERITY[i.type] || 'info',
    message: i.message || i.code || 'unknown',
    context: i.context?.slice(0, 200) || undefined,
    url: i.selector || undefined,
  }));

  const errors = findings.filter(f => f.severity === 'serious' || f.severity === 'critical').length;
  const worstSev = findings.length ? findings.reduce((w, f) => {
    const o = { critical: 0, serious: 1, moderate: 2, info: 3 };
    return (o[f.severity] ?? 3) < (o[w] ?? 3) ? f.severity : w;
  }, 'info') : null;

  const passSummary = errors === 0
    ? (findings.length === 0
      ? 'No WCAG AAA issues found'
      : `No errors — ${findings.length} notice${findings.length !== 1 ? 's' : ''}/warning${findings.length !== 1 ? 's' : ''} only`)
    : undefined;

  return {
    checkId, tool, status: errors === 0 ? 'pass' : 'fail',
    score: null, grade: null, severity: worstSev, findings, durationMs,
    ...(passSummary && { passSummary }),
  };
}
