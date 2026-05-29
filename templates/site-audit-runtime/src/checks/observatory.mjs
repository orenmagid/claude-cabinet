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

const TEST_LABELS = {
  'content-security-policy': 'Content Security Policy',
  'cookies': 'Cookies',
  'cross-origin-resource-sharing': 'CORS',
  'redirection': 'HTTP Redirection',
  'referrer-policy': 'Referrer Policy',
  'strict-transport-security': 'Strict Transport Security',
  'subresource-integrity': 'Subresource Integrity',
  'x-content-type-options': 'X-Content-Type-Options',
  'x-frame-options': 'X-Frame-Options',
  'cross-origin-resource-policy': 'Cross-Origin Resource Policy',
};

export function normalize(raw, durationMs) {
  if (raw.code !== 0 && !raw.stdout) {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: raw.stderr?.slice(0, 200) || 'observatory failed' };
  }

  const text = (raw.stdout || '').trim();

  // Try JSON parse first (mdn-http-observatory outputs JSON)
  const jsonStart = text.indexOf('{');
  if (jsonStart >= 0) {
    try {
      const data = JSON.parse(text.slice(jsonStart));
      const scan = data.scan || {};
      const tests = data.tests || {};
      const grade = scan.grade || null;
      const score = typeof scan.score === 'number' ? Math.min(100, scan.score) : (grade ? (GRADE_SCORES[grade] ?? null) : null);

      const findings = [];
      for (const [testId, test] of Object.entries(tests)) {
        if (!test.pass) {
          const label = TEST_LABELS[testId] || testId;
          const severity = (test.scoreModifier != null && test.scoreModifier <= -20) ? 'serious' : 'moderate';
          findings.push({
            severity,
            message: `${label}: ${test.result || 'failed'}`,
            context: test.scoreModifier != null ? `Score impact: ${test.scoreModifier}` : undefined,
          });
        }
      }

      const isPass = grade && /^[A-B]/.test(grade);
      const passed = Object.values(tests).filter(t => t.pass).length;
      const total = Object.keys(tests).length;
      const passSummary = isPass
        ? `Observatory grade ${grade} (score: ${score}/100, ${passed}/${total} tests passed)`
        : undefined;

      return {
        checkId, tool, status: isPass ? 'pass' : 'fail',
        score, grade, severity: findings.length ? findings[0].severity : null,
        findings, durationMs,
        ...(passSummary && { passSummary }),
      };
    } catch { /* fall through to text parsing */ }
  }

  // Fallback: text parsing
  const gradeMatch = text.match(/Grade:\s*([A-F][+-]?)/i);
  const scoreMatch = text.match(/Score:\s*(\d+)/i);
  const grade = gradeMatch ? gradeMatch[1] : null;
  const score = scoreMatch ? Math.min(100, Number(scoreMatch[1])) : (grade ? (GRADE_SCORES[grade] ?? null) : null);
  const isPass = grade && /^[A-B]/.test(grade);

  return {
    checkId, tool, status: isPass ? 'pass' : 'fail',
    score, grade, severity: null, findings: [], durationMs,
  };
}
