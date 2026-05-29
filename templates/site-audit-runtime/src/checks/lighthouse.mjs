export const checkId = 'lighthouse';
export const tool = 'Lighthouse';
export const whyItMatters = "Google's own audit tool — scores four dimensions separately: Performance (page speed), Accessibility (usability for all), Best Practices (security and code quality), and SEO (search visibility). The overall score averages all four.";
export const defaultTimeoutMs = 120_000;

export async function detect(executor) {
  const r = await executor.spawn('lighthouse', ['--version'], { timeoutMs: 15_000 });
  return r.code === 0;
}

export async function run(url, executor) {
  const r = await executor.spawn('lighthouse', [
    url,
    '--output=json',
    '--chrome-flags=--headless=new --no-sandbox',
    '--only-categories=performance,accessibility,best-practices,seo',
  ], { timeoutMs: 120_000 });
  return r;
}

export function normalize(raw, durationMs) {
  if (raw.code !== 0 && !raw.stdout) {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: raw.stderr || 'lighthouse failed' };
  }
  let data;
  try { data = JSON.parse(raw.stdout); } catch {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: 'failed to parse lighthouse JSON' };
  }

  const cats = data.categories || {};
  const scores = {};
  for (const [key, cat] of Object.entries(cats)) {
    scores[key] = Math.round((cat.score ?? 0) * 100);
  }
  const avg = Object.values(scores).length
    ? Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length)
    : null;

  const findings = [];
  const audits = data.audits || {};
  for (const [id, audit] of Object.entries(audits)) {
    if (audit.score !== null && audit.score < 0.5 && audit.title) {
      const f = {
        severity: audit.score === 0 ? 'serious' : 'moderate',
        message: audit.title,
        context: audit.displayValue || undefined,
      };
      if (audit.details?.items?.length) {
        f.url = audit.details.items.slice(0, 5).map(
          item => item.url || item.source?.url || item.node?.selector || ''
        ).filter(Boolean).join(', ') || undefined;
      }
      findings.push(f);
    }
  }

  const worstSev = findings.length ? findings.reduce((w, f) => {
    const order = { critical: 0, serious: 1, moderate: 2, info: 3 };
    return (order[f.severity] ?? 3) < (order[w] ?? 3) ? f.severity : w;
  }, 'info') : null;

  const details = { categories: scores };
  const passSummary = Object.entries(scores)
    .map(([k, v]) => `${k.replace(/-/g, ' ')}: ${v}`)
    .join(', ');

  return {
    checkId, tool, status: avg !== null && avg >= 50 ? 'pass' : 'fail',
    score: avg, grade: scoreToGrade(avg), severity: worstSev, findings,
    details, passSummary, durationMs,
  };
}

function scoreToGrade(s) {
  if (s == null) return null;
  if (s >= 95) return 'A+';
  if (s >= 90) return 'A';
  if (s >= 85) return 'B+';
  if (s >= 80) return 'B';
  if (s >= 75) return 'C+';
  if (s >= 70) return 'C';
  if (s >= 60) return 'D';
  return 'F';
}
