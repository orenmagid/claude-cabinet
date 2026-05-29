// Blacklight detects runtime tracker behavior: session replay scripts,
// canvas fingerprinting, keyloggers, ad trackers, third-party cookies.
// It loads the page in headless Chromium and observes what the page does.

export const checkId = 'blacklight';
export const tool = 'Blacklight (tracker detection)';
export const defaultTimeoutMs = 120_000;

export async function detect(executor) {
  const r = await executor.spawn('npx', ['@themarkup/blacklight-collector', '--help'], { timeoutMs: 15_000 });
  return r.code === 0 || r.stdout.includes('blacklight');
}

export async function run(url, executor) {
  return executor.spawn('npx', ['@themarkup/blacklight-collector', url, '--json'], { timeoutMs: 120_000 });
}

const TRACKER_SEVERITY = {
  session_recorders: 'moderate',
  canvas_fingerprinters: 'moderate',
  key_logging: 'serious',
  fb_pixel: 'info',
  google_analytics: 'info',
  third_party_trackers: 'info',
};

export function normalize(raw, durationMs) {
  if (raw.code !== 0 && !raw.stdout) {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: raw.stderr || 'blacklight failed' };
  }

  let data;
  try { data = JSON.parse(raw.stdout); } catch {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: 'failed to parse blacklight JSON' };
  }

  const findings = [];

  if (data.session_recorders?.length) {
    for (const r of data.session_recorders) {
      findings.push({ severity: 'moderate', message: `Session replay: ${r.name || r.url || 'unknown'}`, url: r.url });
    }
  }
  if (data.canvas_fingerprinters?.length) {
    for (const f of data.canvas_fingerprinters) {
      findings.push({ severity: 'moderate', message: `Canvas fingerprinting: ${f.name || f.url || 'unknown'}`, url: f.url });
    }
  }
  if (data.key_logging?.length) {
    for (const k of data.key_logging) {
      findings.push({ severity: 'serious', message: `Key logging detected: ${k.name || k.url || 'unknown'}`, url: k.url });
    }
  }
  if (data.fb_pixel_events?.length || data.fb_pixel) {
    findings.push({ severity: 'info', message: `Facebook Pixel active (${(data.fb_pixel_events || []).length} events)` });
  }
  if (data.third_party_trackers?.length) {
    for (const t of data.third_party_trackers.slice(0, 10)) {
      findings.push({ severity: 'info', message: `Third-party tracker: ${t.name || t.url || 'unknown'}`, url: t.url });
    }
    if (data.third_party_trackers.length > 10) {
      findings.push({ severity: 'info', message: `... and ${data.third_party_trackers.length - 10} more trackers` });
    }
  }
  if (data.third_party_cookies?.length) {
    findings.push({ severity: 'info', message: `${data.third_party_cookies.length} third-party cookies set` });
  }

  const worstSev = findings.length ? findings.reduce((w, f) => {
    const o = { critical: 0, serious: 1, moderate: 2, info: 3 };
    return (o[f.severity] ?? 3) < (o[w] ?? 3) ? f.severity : w;
  }, 'info') : null;

  const hasSerious = findings.some(f => f.severity === 'serious' || f.severity === 'critical');
  return {
    checkId, tool, status: hasSerious ? 'fail' : 'pass',
    score: null, grade: null, severity: worstSev, findings, durationMs,
  };
}
