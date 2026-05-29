export const checkId = 'meta-og';
export const tool = 'Meta & Open Graph';

export async function detect() { return true; }

export async function run(url, executor) {
  const resp = await executor.fetch(url, { redirect: 'follow' });
  return await resp.text();
}

const REQUIRED_META = ['title', 'description'];
const OG_TAGS = ['og:title', 'og:description', 'og:image', 'og:url'];
const TWITTER_TAGS = ['twitter:card'];
const TITLE_MAX = 70;
const DESC_MAX = 160;

export function normalize(html, durationMs) {
  if (typeof html !== 'string' || !html.trim()) {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: 'empty or invalid HTML response' };
  }

  const findings = [];

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : null;
  if (!title) findings.push({ severity: 'serious', message: 'Missing <title> tag' });
  else if (title.length > TITLE_MAX) findings.push({ severity: 'info', message: `Title too long (${title.length} chars, recommended ≤${TITLE_MAX})` });

  const descMeta = extractMeta(html, 'description');
  if (!descMeta) findings.push({ severity: 'serious', message: 'Missing meta description' });
  else if (descMeta.length > DESC_MAX) findings.push({ severity: 'info', message: `Meta description too long (${descMeta.length} chars, recommended ≤${DESC_MAX})` });

  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  if (!canonical) findings.push({ severity: 'moderate', message: 'Missing canonical link' });

  for (const tag of OG_TAGS) {
    if (!extractMeta(html, tag, 'property')) {
      findings.push({ severity: 'moderate', message: `Missing ${tag}` });
    }
  }

  for (const tag of TWITTER_TAGS) {
    if (!extractMeta(html, tag)) {
      findings.push({ severity: 'info', message: `Missing ${tag}` });
    }
  }

  const total = REQUIRED_META.length + OG_TAGS.length + TWITTER_TAGS.length + 1;
  const missing = findings.filter(f => f.message.startsWith('Missing')).length;
  const score = Math.round(((total - missing) / total) * 100);

  const worstSev = findings.length ? findings.reduce((w, f) => {
    const o = { critical: 0, serious: 1, moderate: 2, info: 3 };
    return (o[f.severity] ?? 3) < (o[w] ?? 3) ? f.severity : w;
  }, 'info') : null;

  const isPass = !findings.some(f => f.severity === 'serious');
  const present = total - missing;
  const passSummary = isPass
    ? `${present}/${total} meta tags present (score: ${score})`
    : undefined;

  return {
    checkId, tool, status: isPass ? 'pass' : 'fail',
    score, grade: null, severity: worstSev, findings, durationMs,
    ...(passSummary && { passSummary }),
  };
}

function extractMeta(html, name, attr = 'name') {
  const re = new RegExp(`<meta[^>]+(?:${attr}=["']${name}["'][^>]+content=["']([^"']*)["']|content=["']([^"']*)["'][^>]+${attr}=["']${name}["'])`, 'i');
  const m = html.match(re);
  return m ? (m[1] || m[2] || '').trim() || null : null;
}
