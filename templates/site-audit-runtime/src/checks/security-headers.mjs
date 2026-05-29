export const checkId = 'security-headers';
export const tool = 'Security Headers';

const CHECKS = [
  { header: 'content-security-policy', label: 'Content-Security-Policy', weight: 2 },
  { header: 'strict-transport-security', label: 'Strict-Transport-Security', weight: 2 },
  { header: 'x-frame-options', label: 'X-Frame-Options', weight: 1 },
  { header: 'x-content-type-options', label: 'X-Content-Type-Options', weight: 1 },
  { header: 'referrer-policy', label: 'Referrer-Policy', weight: 1 },
  { header: 'permissions-policy', label: 'Permissions-Policy', weight: 1 },
];

export async function detect() { return true; }

export async function run(url, executor) {
  const resp = await executor.fetch(url, { method: 'HEAD', redirect: 'follow' });
  const headers = {};
  resp.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  return headers;
}

export function normalize(headers, durationMs) {
  const findings = [];
  let earned = 0;
  let total = 0;

  for (const c of CHECKS) {
    total += c.weight;
    if (headers[c.header]) {
      earned += c.weight;
    } else {
      findings.push({ severity: c.weight >= 2 ? 'serious' : 'moderate', message: `Missing ${c.label} header` });
    }
  }

  if (headers['content-security-policy']?.includes("'unsafe-inline'")) {
    findings.push({ severity: 'moderate', message: "CSP contains 'unsafe-inline'" });
  }
  if (headers['content-security-policy']?.includes("'unsafe-eval'")) {
    findings.push({ severity: 'serious', message: "CSP contains 'unsafe-eval'" });
  }

  const score = Math.round((earned / total) * 100);
  const worstSev = findings.length ? findings.reduce((w, f) => {
    const o = { critical: 0, serious: 1, moderate: 2, info: 3 };
    return (o[f.severity] ?? 3) < (o[w] ?? 3) ? f.severity : w;
  }, 'info') : null;

  return {
    checkId, tool, status: findings.length === 0 ? 'pass' : 'fail',
    score, grade: null, severity: worstSev, findings, durationMs,
  };
}
