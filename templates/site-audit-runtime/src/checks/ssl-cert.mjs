export const checkId = 'ssl-cert';
export const tool = 'SSL Certificate';
export const whyItMatters = "An expired or misconfigured certificate shows scary browser warnings that immediately drive visitors away.";

export async function detect(executor) {
  const r = await executor.spawn('openssl', ['version'], { timeoutMs: 5_000 });
  return r.code === 0;
}

export async function run(url, executor) {
  const hostname = new URL(url).hostname;
  return executor.spawn('openssl', [
    's_client', '-connect', `${hostname}:443`, '-servername', hostname,
  ], { timeoutMs: 15_000, input: '' });
}

export function normalize(raw, durationMs) {
  if (raw.code !== 0 && !raw.stdout) {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: raw.stderr || 'openssl failed' };
  }

  const out = (raw.stdout || '') + (raw.stderr || '');
  const findings = [];

  const notAfter = out.match(/notAfter=(.+)/);
  if (notAfter) {
    const expiry = new Date(notAfter[1]);
    const daysLeft = Math.floor((expiry - Date.now()) / 86_400_000);
    if (daysLeft < 0) {
      findings.push({ severity: 'critical', message: `Certificate expired ${Math.abs(daysLeft)} days ago` });
    } else if (daysLeft < 14) {
      findings.push({ severity: 'serious', message: `Certificate expires in ${daysLeft} days` });
    } else if (daysLeft < 30) {
      findings.push({ severity: 'moderate', message: `Certificate expires in ${daysLeft} days` });
    }
  } else {
    findings.push({ severity: 'serious', message: 'Could not determine certificate expiry' });
  }

  if (out.includes('verify error')) {
    const errMatch = out.match(/verify error:num=\d+:(.+)/);
    findings.push({ severity: 'critical', message: `Certificate verification failed: ${errMatch?.[1] || 'unknown error'}` });
  }

  if (out.includes('self-signed certificate')) {
    findings.push({ severity: 'serious', message: 'Self-signed certificate detected' });
  }

  const worstSev = findings.length ? findings.reduce((w, f) => {
    const o = { critical: 0, serious: 1, moderate: 2, info: 3 };
    return (o[f.severity] ?? 3) < (o[w] ?? 3) ? f.severity : w;
  }, 'info') : null;

  const isPass = !findings.some(f => f.severity === 'critical' || f.severity === 'serious');
  let passSummary;
  if (isPass) {
    const notAfterMatch = (raw.stdout || '').match(/notAfter=(.+)/);
    if (notAfterMatch) {
      const expiry = new Date(notAfterMatch[1]);
      const daysLeft = Math.floor((expiry - Date.now()) / 86_400_000);
      passSummary = `Certificate valid, ${daysLeft} days until expiry`;
    } else {
      passSummary = 'Certificate valid, no critical issues';
    }
  }

  return {
    checkId, tool, status: isPass ? 'pass' : 'fail',
    score: null, grade: null, severity: worstSev, findings, durationMs,
    ...(passSummary && { passSummary }),
  };
}
