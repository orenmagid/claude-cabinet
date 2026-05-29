export const checkId = 'observatory';
export const tool = 'MDN HTTP Observatory';
export const whyItMatters = "Mozilla's security scorecard — grades your site's defenses against common web attacks like clickjacking and data injection.";

export async function detect(executor) {
  const r = await executor.spawn('mdn-http-observatory-scan', ['--help'], { timeoutMs: 15_000 });
  return r.code === 0;
}

export async function run(url, executor) {
  const hostname = new URL(url).hostname;
  return executor.spawn('mdn-http-observatory-scan', [hostname], { timeoutMs: 60_000 });
}

const GRADE_SCORES = { 'A+': 100, 'A': 95, 'A-': 90, 'B+': 85, 'B': 80, 'B-': 75, 'C+': 70, 'C': 65, 'C-': 60, 'D+': 55, 'D': 50, 'D-': 45, 'F': 20 };

export function normalize(raw, durationMs) {
  if (raw.code !== 0 && !raw.stdout) {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: raw.stderr || 'observatory failed' };
  }

  const text = raw.stdout || '';
  const gradeMatch = text.match(/Grade:\s*([A-F][+-]?)/i);
  const scoreMatch = text.match(/Score:\s*(\d+)/i);
  const grade = gradeMatch ? gradeMatch[1] : null;
  const score = scoreMatch ? Math.min(100, Number(scoreMatch[1])) : (grade ? (GRADE_SCORES[grade] ?? null) : null);

  const findings = [];
  const failLines = text.split('\n').filter(l => /fail|warn|not implemented/i.test(l));
  for (const line of failLines.slice(0, 20)) {
    findings.push({ severity: 'moderate', message: line.trim() });
  }

  const isPass = grade && /^[A-B]/.test(grade);
  const passSummary = isPass
    ? `Observatory grade ${grade}${score != null ? ` (score: ${score}/100)` : ''}`
    : undefined;

  return {
    checkId, tool, status: isPass ? 'pass' : 'fail',
    score, grade, severity: findings.length ? 'moderate' : null, findings, durationMs,
    ...(passSummary && { passSummary }),
  };
}
