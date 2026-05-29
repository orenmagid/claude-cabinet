export const checkId = 'axe-core';
export const tool = 'axe-core (WCAG AA)';
export const whyItMatters = "Checks whether people with disabilities can use your site — screen readers, keyboard navigation, color contrast. Legal liability if not met.";

export async function detect(executor) {
  const r = await executor.spawn('axe', ['--version'], { timeoutMs: 15_000 });
  return r.code === 0;
}

export async function run(url, executor) {
  return executor.spawn('axe', [url, '--stdout'], { timeoutMs: 60_000 });
}

const IMPACT_TO_SEVERITY = { critical: 'critical', serious: 'serious', moderate: 'moderate', minor: 'info' };

export function normalize(raw, durationMs) {
  if (raw.code !== 0 && !raw.stdout) {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: raw.stderr || 'axe-core failed' };
  }
  let data;
  try { data = JSON.parse(raw.stdout); } catch {
    // @axe-core/cli may output non-JSON prefix lines before the JSON array;
    // strip lines until we find the opening bracket.
    const lines = (raw.stdout || '').split('\n');
    const jsonStart = lines.findIndex(l => l.trimStart().startsWith('[') || l.trimStart().startsWith('{'));
    if (jsonStart >= 0) {
      try { data = JSON.parse(lines.slice(jsonStart).join('\n')); } catch {
        return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: 'failed to parse axe-core JSON' };
      }
    } else {
      return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: 'failed to parse axe-core JSON' };
    }
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

  const pages = Array.isArray(data) ? data.length : 1;
  const passSummary = findings.length === 0
    ? `No WCAG AA violations across ${pages} page${pages !== 1 ? 's' : ''}`
    : undefined;

  return {
    checkId, tool, status: findings.length === 0 ? 'pass' : 'fail',
    score: null, grade: null, severity: worstSev, findings, durationMs,
    ...(passSummary && { passSummary }),
  };
}
