export const checkId = 'dns';
export const tool = 'DNS & Protocol';

export async function detect(executor) {
  const r = await executor.spawn('dig', ['-v'], { timeoutMs: 5_000 });
  return r.code === 0 || r.stderr.includes('DiG');
}

export async function run(url, executor) {
  const hostname = new URL(url).hostname;
  const [dnssec, spf, dmarc, http2] = await Promise.all([
    executor.spawn('dig', ['+dnssec', '+short', hostname], { timeoutMs: 10_000 }),
    executor.spawn('dig', ['TXT', '+short', hostname], { timeoutMs: 10_000 }),
    executor.spawn('dig', ['TXT', '+short', `_dmarc.${hostname}`], { timeoutMs: 10_000 }),
    executor.spawn('curl', ['-sI', '--http2', '-o', '/dev/null', '-w', '%{http_version}', url], { timeoutMs: 10_000 }),
  ]);
  return { hostname, dnssec, spf, dmarc, http2 };
}

export function normalize(raw, durationMs) {
  const findings = [];

  if (raw.dnssec && raw.dnssec.code === 0) {
    const out = raw.dnssec.stdout || '';
    if (!out.includes('RRSIG')) {
      findings.push({ severity: 'moderate', message: 'DNSSEC not enabled' });
    }
  }

  if (raw.spf && raw.spf.code === 0) {
    const out = raw.spf.stdout || '';
    if (!out.includes('v=spf1')) {
      findings.push({ severity: 'moderate', message: 'No SPF record found' });
    }
  }

  if (raw.dmarc && raw.dmarc.code === 0) {
    const out = raw.dmarc.stdout || '';
    if (!out.includes('v=DMARC1')) {
      findings.push({ severity: 'moderate', message: 'No DMARC record found' });
    }
  }

  let httpVersion = null;
  if (raw.http2 && raw.http2.code === 0) {
    httpVersion = raw.http2.stdout.trim();
    if (!httpVersion.startsWith('2') && !httpVersion.startsWith('3')) {
      findings.push({ severity: 'info', message: `HTTP version ${httpVersion} (HTTP/2+ recommended)` });
    }
  }

  const total = 4;
  const passing = total - findings.filter(f => f.severity !== 'info').length;
  const score = Math.round((passing / total) * 100);

  const isPass = !findings.some(f => f.severity !== 'info');
  const passed = [];
  if (!findings.some(f => f.message.includes('DNSSEC'))) passed.push('DNSSEC');
  if (!findings.some(f => f.message.includes('SPF'))) passed.push('SPF');
  if (!findings.some(f => f.message.includes('DMARC'))) passed.push('DMARC');
  if (httpVersion && (httpVersion.startsWith('2') || httpVersion.startsWith('3'))) passed.push(`HTTP/${httpVersion}`);
  const passSummary = isPass
    ? `${passed.join(', ')} verified`
    : undefined;

  return {
    checkId, tool, status: isPass ? 'pass' : 'fail',
    score, grade: null,
    severity: findings.length ? findings.reduce((w, f) => {
      const o = { critical: 0, serious: 1, moderate: 2, info: 3 };
      return (o[f.severity] ?? 3) < (o[w] ?? 3) ? f.severity : w;
    }, 'info') : null,
    findings, durationMs,
    ...(passSummary && { passSummary }),
  };
}
