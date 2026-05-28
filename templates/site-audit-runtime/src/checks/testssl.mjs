export const checkId = 'testssl';
export const tool = 'testssl.sh (TLS depth)';
export const defaultTimeoutMs = 180_000;

export async function detect(executor) {
  const r = await executor.spawn('testssl.sh', ['--version'], { timeoutMs: 5_000 });
  return r.code === 0 || r.stdout.includes('testssl');
}

export async function run(url, executor) {
  const hostname = new URL(url).hostname;
  return executor.spawn('testssl.sh', ['--jsonfile-pretty', '/dev/stdout', '--quiet', hostname], { timeoutMs: 180_000 });
}

export function normalize(raw, durationMs) {
  if (raw.code !== 0 && !raw.stdout) {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: raw.stderr || 'testssl.sh failed' };
  }

  let entries;
  try { entries = JSON.parse(raw.stdout); } catch {
    const lines = raw.stdout.split('\n').filter(l => l.trim());
    entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  }
  if (!Array.isArray(entries)) entries = [entries];

  const findings = [];
  for (const e of entries.flat()) {
    if (!e || !e.severity) continue;
    const sev = mapSeverity(e.severity);
    if (sev && e.severity !== 'OK' && e.severity !== 'INFO') {
      findings.push({
        severity: sev,
        message: e.finding || e.id || 'unknown',
        context: e.cve || undefined,
      });
    }
  }

  const worstSev = findings.length ? findings.reduce((w, f) => {
    const o = { critical: 0, serious: 1, moderate: 2, info: 3 };
    return (o[f.severity] ?? 3) < (o[w] ?? 3) ? f.severity : w;
  }, 'info') : null;

  const hasCritical = findings.some(f => f.severity === 'critical');
  const hasSerious = findings.some(f => f.severity === 'serious');

  return {
    checkId, tool, status: hasCritical || hasSerious ? 'fail' : 'pass',
    score: null, grade: null, severity: worstSev, findings, durationMs,
  };
}

function mapSeverity(s) {
  const l = String(s).toUpperCase();
  if (l === 'CRITICAL' || l === 'HIGH') return 'critical';
  if (l === 'MEDIUM' || l === 'WARN' || l === 'WARNING') return 'serious';
  if (l === 'LOW' || l === 'NOT OK') return 'moderate';
  if (l === 'INFO' || l === 'OK') return 'info';
  return 'info';
}
