// Nuclei is an active vulnerability scanner — it sends real exploit probes.
// Running it against a site you don't own is legally equivalent to unauthorized
// penetration testing (may violate CFAA or equivalent statutes). The run()
// function enforces an authorization gate: it refuses unless the caller
// explicitly passes --i-authorize-active-scan=<hostname>.

export const checkId = 'nuclei';
export const tool = 'Nuclei (CVE scan)';
export const defaultTimeoutMs = 300_000;

export async function detect(executor) {
  const r = await executor.spawn('nuclei', ['-version'], { timeoutMs: 10_000 });
  return r.code === 0 || r.stderr?.includes('nuclei');
}

export async function run(url, executor, opts = {}) {
  const hostname = new URL(url).hostname;
  if (!opts.authorizedDomain || opts.authorizedDomain !== hostname) {
    return { __skipped: true, reason: `active scan not authorized for ${hostname} (pass --i-authorize-active-scan=${hostname})` };
  }

  const r = await executor.spawn('nuclei', [
    '-u', url,
    '-jsonl',
    '-t', 'cves/',
    '-t', 'exposures/',
    '-t', 'misconfiguration/',
    '-silent',
  ], { timeoutMs: 300_000 });
  return r;
}

const NUCLEI_SEVERITY = {
  critical: 'critical',
  high: 'critical',
  medium: 'serious',
  low: 'moderate',
  info: 'info',
};

export function normalize(raw, durationMs) {
  if (raw.__skipped) {
    return {
      checkId, tool, status: 'skip', score: null, grade: null, severity: null,
      findings: [], durationMs, reason: raw.reason,
    };
  }

  if (raw.code !== 0 && !raw.stdout) {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: raw.stderr || 'nuclei failed' };
  }

  const lines = (raw.stdout || '').split('\n').filter(l => l.trim());
  const findings = [];

  for (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    findings.push({
      severity: NUCLEI_SEVERITY[entry.info?.severity] || 'info',
      message: entry.info?.name || entry['template-id'] || 'unknown finding',
      url: entry['matched-at'] || entry.host || undefined,
      context: entry.info?.description?.slice(0, 300) || undefined,
    });
  }

  const worstSev = findings.length ? findings.reduce((w, f) => {
    const o = { critical: 0, serious: 1, moderate: 2, info: 3 };
    return (o[f.severity] ?? 3) < (o[w] ?? 3) ? f.severity : w;
  }, 'info') : null;

  const isPass = !findings.some(f => f.severity === 'critical' || f.severity === 'serious');
  const passSummary = isPass
    ? (findings.length === 0
      ? `No vulnerabilities found across ${lines.length} probe${lines.length !== 1 ? 's' : ''}`
      : `No critical/serious vulnerabilities (${findings.length} info-level item${findings.length !== 1 ? 's' : ''})`)
    : undefined;

  return {
    checkId, tool,
    status: isPass ? 'pass' : 'fail',
    score: null, grade: null, severity: worstSev, findings, durationMs,
    ...(passSummary && { passSummary }),
  };
}
