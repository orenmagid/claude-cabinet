export const checkId = 'axe-core';
export const tool = 'axe-core (WCAG AA)';

export async function detect(executor) {
  const r = await executor.spawn('npx', ['@axe-core/cli', '--version'], { timeoutMs: 15_000 });
  return r.code === 0;
}

export async function run(url, executor) {
  return executor.spawn('npx', ['@axe-core/cli', url, '--exit'], { timeoutMs: 60_000 });
}

const IMPACT_TO_SEVERITY = { critical: 'critical', serious: 'serious', moderate: 'moderate', minor: 'info' };

export function normalize(raw, durationMs) {
  if (raw.code !== 0 && !raw.stdout) {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: raw.stderr || 'axe-core failed' };
  }
  let data;
  try { data = JSON.parse(raw.stdout); } catch {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: 'failed to parse axe-core JSON' };
  }

  const violations = Array.isArray(data) ? data.flatMap(p => p.violations || []) : (data.violations || []);
  const findings = violations.map(v => ({
    severity: IMPACT_TO_SEVERITY[v.impact] || 'info',
    message: v.description || v.id,
    url: v.helpUrl || undefined,
    context: v.nodes?.[0]?.html?.slice(0, 200) || undefined,
  }));

  const worstSev = findings.length ? findings.reduce((w, f) => {
    const o = { critical: 0, serious: 1, moderate: 2, info: 3 };
    return (o[f.severity] ?? 3) < (o[w] ?? 3) ? f.severity : w;
  }, 'info') : null;

  return {
    checkId, tool, status: findings.length === 0 ? 'pass' : 'fail',
    score: null, grade: null, severity: worstSev, findings, durationMs,
  };
}
