export const checkId = 'linkinator';
export const tool = 'Linkinator (broken links)';

export async function detect(executor) {
  const r = await executor.spawn('npx', ['linkinator', '--version'], { timeoutMs: 15_000 });
  return r.code === 0;
}

export async function run(url, executor) {
  return executor.spawn('npx', ['linkinator', url, '--format', 'json', '--timeout', '10000'], { timeoutMs: 60_000 });
}

export function normalize(raw, durationMs) {
  if (raw.code !== 0 && !raw.stdout) {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: raw.stderr || 'linkinator failed' };
  }

  let data;
  try { data = JSON.parse(raw.stdout); } catch {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: 'failed to parse linkinator JSON' };
  }

  const links = data.links || [];
  const findings = [];

  for (const link of links) {
    if (link.state === 'BROKEN') {
      findings.push({
        severity: 'serious',
        message: `Broken link: ${link.url} (${link.status || 'no response'})`,
        url: link.url,
        context: link.parent || undefined,
      });
    } else if (link.state === 'SKIPPED') {
      findings.push({
        severity: 'info',
        message: `Skipped: ${link.url}`,
        url: link.url,
      });
    }
  }

  const broken = findings.filter(f => f.severity !== 'info').length;
  const total = links.filter(l => l.state !== 'SKIPPED').length;

  const passSummary = broken === 0
    ? `All ${total} link${total !== 1 ? 's' : ''} valid`
    : undefined;

  return {
    checkId, tool, status: broken === 0 ? 'pass' : 'fail',
    score: null, grade: null,
    severity: broken > 0 ? 'serious' : null,
    findings: findings.filter(f => f.severity !== 'info'),
    durationMs,
    ...(passSummary && { passSummary }),
  };
}
