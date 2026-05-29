export const checkId = 'testssl';
export const tool = 'TLS/SSL Check';
export const whyItMatters = "Weak encryption lets attackers intercept data between your users and your server — passwords, form submissions, everything.";

export async function detect(executor) {
  try {
    await import('ssl-checker');
    return true;
  } catch {
    return false;
  }
}

export async function run(url, executor) {
  const hostname = new URL(url).hostname;
  const sslChecker = (await import('ssl-checker')).default;
  const result = await sslChecker(hostname);
  return { code: 0, stdout: JSON.stringify(result), stderr: '', timedOut: false };
}

export function normalize(raw, durationMs) {
  if (raw.code !== 0 && !raw.stdout) {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: raw.stderr || 'ssl-checker failed' };
  }

  let data;
  try { data = JSON.parse(raw.stdout); } catch {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: 'failed to parse ssl-checker output' };
  }

  const findings = [];

  if (!data.valid) {
    findings.push({ severity: 'critical', message: 'Certificate is not valid' });
  }

  if (data.daysRemaining != null && data.daysRemaining < 30) {
    findings.push({
      severity: data.daysRemaining < 7 ? 'critical' : 'serious',
      message: `Certificate expires in ${data.daysRemaining} days`,
    });
  }

  const protocol = data.protocol || data.tlsVersion || '';
  if (protocol && !protocol.includes('TLSv1.2') && !protocol.includes('TLSv1.3')) {
    findings.push({ severity: 'serious', message: `Weak TLS protocol: ${protocol}` });
  }

  if (data.cipher) {
    const weak = /RC4|DES|MD5|NULL|EXPORT|anon/i;
    if (weak.test(data.cipher)) {
      findings.push({ severity: 'serious', message: `Weak cipher: ${data.cipher}` });
    }
  }

  const hasCritical = findings.some(f => f.severity === 'critical');
  const hasSerious = findings.some(f => f.severity === 'serious');
  const isPass = !hasCritical && !hasSerious;

  const details = [];
  if (data.valid) details.push('valid certificate');
  if (data.daysRemaining != null) details.push(`${data.daysRemaining} days until expiry`);
  if (protocol) details.push(protocol);
  if (data.cipher) details.push(data.cipher);

  const passSummary = isPass ? details.join(', ') : undefined;

  return {
    checkId, tool, status: isPass ? 'pass' : 'fail',
    score: null, grade: null,
    severity: hasCritical ? 'critical' : hasSerious ? 'serious' : findings.length ? 'moderate' : null,
    findings, durationMs,
    ...(passSummary && { passSummary }),
  };
}
