export const checkId = 'structured-data';
export const tool = 'Structured Data (JSON-LD)';

export async function detect() { return true; }

export async function run(url, executor) {
  const resp = await executor.fetch(url, { redirect: 'follow' });
  return await resp.text();
}

const COMMON_TYPES = new Set([
  'Article', 'BlogPosting', 'Product', 'Organization', 'Person',
  'WebSite', 'WebPage', 'BreadcrumbList', 'FAQPage', 'HowTo',
  'LocalBusiness', 'Event', 'Recipe', 'Review', 'JobPosting',
]);

export function normalize(html, durationMs) {
  if (typeof html !== 'string' || !html.trim()) {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: 'empty HTML' };
  }

  const findings = [];
  const scripts = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1]);
      scripts.push(parsed);
    } catch (e) {
      findings.push({ severity: 'serious', message: `Malformed JSON-LD: ${e.message}` });
    }
  }

  if (scripts.length === 0 && findings.length === 0) {
    findings.push({ severity: 'moderate', message: 'No JSON-LD structured data found' });
    return { checkId, tool, status: 'fail', score: 0, grade: null, severity: 'moderate', findings, durationMs };
  }

  for (const obj of scripts.flat()) {
    if (!obj) continue;
    const items = Array.isArray(obj['@graph']) ? obj['@graph'] : [obj];
    for (const item of items) {
      if (!item['@type']) {
        findings.push({ severity: 'moderate', message: 'JSON-LD object missing @type' });
      }
      if (!item['@context'] && !obj['@context']) {
        findings.push({ severity: 'moderate', message: `JSON-LD ${item['@type'] || 'object'} missing @context` });
      }
    }
  }

  const types = scripts.flat().flatMap(obj => {
    if (!obj) return [];
    const items = Array.isArray(obj['@graph']) ? obj['@graph'] : [obj];
    return items.map(i => i['@type']).filter(Boolean);
  });

  const score = scripts.length > 0 && findings.filter(f => f.severity !== 'info').length === 0
    ? Math.min(100, 50 + types.length * 10)
    : Math.max(0, 50 - findings.length * 10);

  const worstSev = findings.length ? findings.reduce((w, f) => {
    const o = { critical: 0, serious: 1, moderate: 2, info: 3 };
    return (o[f.severity] ?? 3) < (o[w] ?? 3) ? f.severity : w;
  }, 'info') : null;

  const isPass = !findings.some(f => f.severity === 'serious');
  const passSummary = isPass
    ? `${scripts.length} JSON-LD block${scripts.length !== 1 ? 's' : ''} found with ${types.length} type${types.length !== 1 ? 's' : ''}: ${types.join(', ') || 'none'}`
    : undefined;

  return {
    checkId, tool, status: isPass ? 'pass' : 'fail',
    score, grade: null, severity: worstSev, findings, durationMs,
    ...(passSummary && { passSummary }),
  };
}
