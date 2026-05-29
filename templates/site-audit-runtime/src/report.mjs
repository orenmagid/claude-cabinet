import { esc, isSafeHref } from './security.mjs';

const STATUS_ICON = { pass: '✅', fail: '❌', skip: '⏭️', error: '⚠️' };
const STATUS_CLASS = { pass: 'pass', fail: 'fail', skip: 'skip', error: 'error' };
const SEV_CLASS = { critical: 'sev-critical', serious: 'sev-serious', moderate: 'sev-moderate', info: 'sev-info' };

function css() {
  return `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f6fa;color:#1a1a2e;line-height:1.5;padding:2rem}
.container{max-width:1100px;margin:0 auto}
h1{font-size:1.75rem;margin-bottom:.25rem}
.subtitle{color:#666;margin-bottom:1.5rem;font-size:.9rem}
.executive-summary{background:#fff;border-radius:10px;padding:1.25rem 1.5rem;margin-bottom:1.5rem;box-shadow:0 1px 4px rgba(0,0,0,.05);font-size:.95rem;line-height:1.6;color:#333}
.score-cards{display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:2rem}
.score-card{background:#fff;border-radius:12px;padding:1.25rem;flex:1;min-width:140px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.score-card .score{font-size:2.5rem;font-weight:700;line-height:1}
.score-card .label{font-size:.75rem;color:#888;margin-top:.25rem;text-transform:uppercase;letter-spacing:.05em}
.score-pass .score{color:#0a7}
.score-fail .score{color:#e44}
.score-skip .score{color:#aaa}
.score-error .score{color:#f80}
.check{background:#fff;border-radius:10px;margin-bottom:1rem;box-shadow:0 1px 4px rgba(0,0,0,.05);overflow:hidden}
.check-header{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;cursor:pointer;user-select:none}
.check-header:hover{background:#fafbfd}
.check-title{font-weight:600;font-size:1rem}
.check-meta{display:flex;gap:1rem;align-items:center;font-size:.85rem;color:#666}
.check-badge{display:inline-block;padding:.15rem .6rem;border-radius:20px;font-size:.75rem;font-weight:600;color:#fff}
.badge-pass{background:#0a7}
.badge-fail{background:#e44}
.badge-skip{background:#bbb}
.badge-error{background:#f80}
.check-body{padding:0 1.25rem 1.25rem;display:none}
.check.open .check-body{display:block}
.finding{padding:.5rem 0;border-bottom:1px solid #f0f0f0;font-size:.9rem}
.finding:last-child{border-bottom:none}
.sev-critical{color:#c00;font-weight:600}
.sev-serious{color:#e44}
.sev-moderate{color:#f80}
.sev-info{color:#888}
.finding-url{font-size:.8rem;color:#06c;word-break:break-all}
.pass-summary{color:#0a7;font-size:.9rem;font-style:italic;padding:.25rem 0}
.compare-row{display:grid;grid-template-columns:1fr 150px 150px 80px;gap:.5rem;align-items:center;padding:.75rem 1.25rem;border-bottom:1px solid #f0f0f0;cursor:pointer;text-decoration:none;color:inherit}
.compare-row:hover{background:#f8f9fc}
.compare-row:first-child{font-weight:700;background:#f8f9fc;cursor:default}
.delta-pos{color:#0a7;font-weight:600}
.delta-neg{color:#e44;font-weight:600}
.delta-na{color:#aaa}
.asymmetric-warning{background:#fff7e6;border:1px solid #ffd666;border-radius:8px;padding:1rem;margin-bottom:1.5rem;font-size:.9rem}
.compare-card{background:#fff;border-radius:10px;margin-bottom:1rem;box-shadow:0 1px 4px rgba(0,0,0,.05);overflow:hidden}
.compare-card-header{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;cursor:pointer;user-select:none;border-bottom:1px solid #f0f0f0}
.compare-card-header:hover{background:#fafbfd}
.compare-card-body{display:none;padding:1rem 1.25rem}
.compare-card.open .compare-card-body{display:block}
.side-by-side{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem}
@media(max-width:768px){.side-by-side{grid-template-columns:1fr}}
.site-column h4{font-size:.85rem;color:#888;margin-bottom:.5rem;text-transform:uppercase;letter-spacing:.05em}
.finding-group-label{font-size:.8rem;font-weight:600;color:#555;margin:.75rem 0 .25rem;text-transform:uppercase;letter-spacing:.03em}
.avail-badge{display:inline-block;padding:.1rem .5rem;border-radius:12px;font-size:.7rem;font-weight:600;margin-left:.5rem}
.avail-both{background:#e8e8e8;color:#555}
.avail-a-only{background:#dbeafe;color:#1d4ed8}
.avail-b-only{background:#fef3c7;color:#b45309}
footer{margin-top:2rem;padding-top:1rem;border-top:1px solid #e0e0e0;font-size:.8rem;color:#999;text-align:center}
`;
}

function js() {
  return `document.querySelectorAll('.check-header,.compare-card-header').forEach(h=>{h.onclick=()=>h.parentElement.classList.toggle('open')});
document.querySelectorAll('.compare-row[href]').forEach(r=>{r.onclick=e=>{e.preventDefault();const t=document.querySelector(r.getAttribute('href'));if(t){t.classList.add('open');t.scrollIntoView({behavior:'smooth',block:'start'})}}})`;
}

function head(title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; script-src 'unsafe-inline'">
<title>${esc(title)}</title>
<style>${css()}</style>
</head>
<body>
<div class="container">`;
}

function foot(auditedAt) {
  return `</div>
<footer>Generated by cc-site-audit &middot; ${esc(auditedAt)}</footer>
<script>${js()}</script>
</body>
</html>`;
}

function scoreCard(label, score, status) {
  const display = score !== null ? String(score) : (status === 'skip' ? '—' : '?');
  return `<div class="score-card score-${STATUS_CLASS[status] || 'skip'}">
  <div class="score">${esc(display)}</div>
  <div class="label">${esc(label)}</div>
</div>`;
}

function renderFindings(findings, result) {
  if (!findings.length) {
    if (result?.passSummary) {
      return `<p class="pass-summary">✓ ${esc(result.passSummary)}</p>`;
    }
    return '<p style="color:#888;font-size:.9rem">No findings.</p>';
  }
  let html = '';
  for (const f of findings) {
    const urlPart = f.url
      ? (isSafeHref(f.url) ? `<div class="finding-url"><a href="${esc(f.url)}">${esc(f.url)}</a></div>` : `<div class="finding-url">${esc(f.url)}</div>`)
      : '';
    html += `<div class="finding ${SEV_CLASS[f.severity] || ''}">
  <span>${esc(f.severity)}</span>: ${esc(f.message)}
  ${f.context ? `<div style="font-size:.8rem;color:#888;margin-top:.2rem">${esc(f.context)}</div>` : ''}
  ${urlPart}
</div>`;
  }
  return html;
}

function renderDetails(result) {
  if (!result?.details) return '';
  let html = '';
  const cats = result.details.categories;
  if (cats && typeof cats === 'object' && !Array.isArray(cats)) {
    const items = Object.entries(cats).map(([k, v]) => {
      const label = k.replace(/-/g, ' ');
      const cls = v >= 90 ? 'score-pass' : v >= 50 ? '' : 'score-fail';
      return `<span class="${cls}" style="display:inline-block;margin-right:1rem"><strong>${esc(label)}</strong> ${v}/100</span>`;
    });
    html += `<div style="margin-bottom:.75rem;font-size:.9rem">${items.join('')}</div>`;
  }
  const metrics = result.details.metrics;
  if (metrics && typeof metrics === 'object') {
    const items = Object.entries(metrics).map(([label, value]) =>
      `<span style="display:inline-block;margin-right:1.2rem"><strong>${esc(label)}</strong> ${esc(String(value))}</span>`
    );
    html += `<div style="margin-bottom:.75rem;font-size:.85rem;color:#555">Core Web Vitals: ${items.join('')}</div>`;
  }
  const types = result.details.types;
  if (Array.isArray(types) && types.length) {
    html += `<div style="margin-bottom:.75rem;font-size:.85rem;color:#555">Schema types: ${types.map(t => `<strong>${esc(String(t))}</strong>`).join(', ')}</div>`;
  }
  return html;
}

/**
 * Generate a 2-3 sentence executive summary for a comparison report.
 * @param {import('./diff.mjs').DeltaReport} delta
 * @returns {string}
 */
export function generateSummary(delta) {
  const scored = delta.deltas.filter(d => d.deltaScore !== null);
  if (!scored.length) return 'No scored checks available for comparison.';

  const bWins = scored.filter(d => d.deltaScore > 0).length;
  const aWins = scored.filter(d => d.deltaScore < 0).length;
  const ties = scored.filter(d => d.deltaScore === 0).length;

  const sorted = [...scored].sort((a, b) => Math.abs(b.deltaScore) - Math.abs(a.deltaScore));
  const biggest = sorted[0];

  let summary = '';
  const sA = hostnameLabel(delta.urlA);
  const sB = hostnameLabel(delta.urlB);
  if (bWins > aWins) {
    summary += `${esc(sB)} outperforms ${esc(sA)} on ${bWins} of ${scored.length} scored dimension${scored.length > 1 ? 's' : ''}`;
  } else if (aWins > bWins) {
    summary += `${esc(sA)} outperforms ${esc(sB)} on ${aWins} of ${scored.length} scored dimension${scored.length > 1 ? 's' : ''}`;
  } else {
    summary += `Sites are evenly matched across ${scored.length} scored dimension${scored.length > 1 ? 's' : ''}`;
  }
  if (ties > 0) summary += ` (${ties} tied)`;
  summary += '. ';

  if (biggest && biggest.deltaScore !== 0) {
    const direction = biggest.deltaScore > 0 ? 'improvement' : 'decline';
    summary += `Largest delta: ${esc(biggest.tool)} (${biggest.deltaScore > 0 ? '+' : ''}${biggest.deltaScore} ${direction}).`;
  }

  return summary;
}

function checkSection(result) {
  const badge = `<span class="check-badge badge-${STATUS_CLASS[result.status]}">${esc(result.status)}${result.grade ? ' ' + esc(result.grade) : ''}${result.score !== null ? ' ' + result.score + '/100' : ''}</span>`;
  const findingsCount = result.findings.length ? `${result.findings.length} finding${result.findings.length > 1 ? 's' : ''}` : '';
  const reason = result.reason ? `<span style="color:#888"> — ${esc(result.reason)}</span>` : '';

  return `<div class="check" data-check-id="${esc(result.checkId)}">
  <div class="check-header">
    <span class="check-title">${STATUS_ICON[result.status] || ''} ${esc(result.tool)}</span>
    <div class="check-meta">
      <span>${findingsCount}</span>
      ${badge}${reason}
    </div>
  </div>
  <div class="check-body">
    ${result.whyItMatters ? `<p style="color:#666;font-size:.85rem;font-style:italic;margin-bottom:.5rem">${esc(result.whyItMatters)}</p>` : ''}
    ${renderDetails(result)}
    ${renderFindings(result.findings, result)}
  </div>
</div>`;
}

/**
 * Render a single-site audit report as a standalone HTML string.
 * @param {import('./orchestrator.mjs').SiteReport} report
 * @returns {string}
 */
export function renderSingle(report) {
  const title = `Site Audit — ${report.url}`;
  const passed = report.results.filter(r => r.status === 'pass').length;
  const total = report.results.filter(r => r.status !== 'skip').length;

  const topScores = report.results
    .filter(r => r.score !== null && r.status !== 'skip')
    .slice(0, 5);

  let html = head(title);
  html += `<h1>${esc(title)}</h1>`;
  html += `<div class="subtitle">${esc(report.auditedAt)} &middot; ${passed}/${total} checks passed &middot; ${(report.totalDurationMs / 1000).toFixed(1)}s</div>`;

  if (topScores.length) {
    html += '<div class="score-cards">';
    for (const r of topScores) {
      html += scoreCard(r.tool, r.score, r.status);
    }
    html += '</div>';
  }

  for (const result of report.results) {
    html += checkSection(result);
  }

  html += foot(report.auditedAt);
  return html;
}

function compareCardFindings(label, findings, result) {
  if (!findings.length && result?.passSummary) {
    return `<p class="pass-summary">✓ ${esc(result.passSummary)}</p>`;
  }
  if (!findings.length) return '';
  return `<div class="finding-group-label">${esc(label)}</div>${renderFindings(findings, result)}`;
}

function classifyFindings(a, b) {
  if (!a && !b) return { shared: [], aOnly: [], bOnly: [] };
  const aFindings = a?.findings || [];
  const bFindings = b?.findings || [];

  const aMessages = new Set(aFindings.map(f => f.message));
  const bMessages = new Set(bFindings.map(f => f.message));

  return {
    shared: aFindings.filter(f => bMessages.has(f.message)),
    aOnly: aFindings.filter(f => !bMessages.has(f.message)),
    bOnly: bFindings.filter(f => !aMessages.has(f.message)),
  };
}

/**
 * Render a comparison report as a standalone HTML string.
 * @param {import('./diff.mjs').DeltaReport} delta
 * @returns {string}
 */
function hostnameLabel(url) {
  try {
    const u = new URL(url);
    const h = u.hostname;
    const platformDomains = ['railway.app', 'herokuapp.com', 'vercel.app', 'netlify.app', 'fly.dev', 'render.com'];
    const isPlat = platformDomains.some(d => h.endsWith(d));
    if (isPlat && u.pathname && u.pathname !== '/') {
      return u.pathname.split('/').filter(Boolean)[0] + ' (staging)';
    }
    if (isPlat) return 'staging';
    if (h.length <= 25) return h;
    return h.slice(0, 22) + '...';
  } catch { return url; }
}

export function renderComparison(delta) {
  const labelA = hostnameLabel(delta.urlA);
  const labelB = hostnameLabel(delta.urlB);
  const title = `Site Comparison — ${delta.urlA} vs ${delta.urlB}`;

  let html = head(title);
  html += `<h1>${esc(title)}</h1>`;
  html += `<div class="subtitle">${esc(delta.auditedAt)}</div>`;

  html += `<div class="executive-summary">${generateSummary(delta)}</div>`;

  const { aOnly, bOnly } = delta.summary;
  if (aOnly > 0 || bOnly > 0) {
    html += `<div class="asymmetric-warning">Asymmetric availability: `;
    if (aOnly > 0) html += `${aOnly} check${aOnly > 1 ? 's' : ''} ran only for ${esc(labelA)}. `;
    if (bOnly > 0) html += `${bOnly} check${bOnly > 1 ? 's' : ''} ran only for ${esc(labelB)}. `;
    html += `Deltas for one-sided checks show N/A.</div>`;
  }

  // ── Comparison grid with drill-down links ──
  html += '<div style="background:#fff;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.05);overflow:hidden;margin-bottom:2rem">';
  html += `<div class="compare-row"><span>Check</span><span>${esc(labelA)}</span><span>${esc(labelB)}</span><span>Delta</span></div>`;

  for (const d of delta.deltas) {
    const aDisplay = d.a && d.a.status !== 'skip'
      ? (d.a.score !== null ? `${d.a.score}` : d.a.status)
      : '—';
    const bDisplay = d.b && d.b.status !== 'skip'
      ? (d.b.score !== null ? `${d.b.score}` : d.b.status)
      : '—';

    let deltaDisplay;
    if (d.deltaScore === null) {
      deltaDisplay = '<span class="delta-na">N/A</span>';
    } else if (d.deltaScore > 0) {
      deltaDisplay = `<span class="delta-pos">+${d.deltaScore}</span>`;
    } else if (d.deltaScore < 0) {
      deltaDisplay = `<span class="delta-neg">${d.deltaScore}</span>`;
    } else {
      deltaDisplay = '<span>0</span>';
    }

    const availBadge = d.availability === 'both' ? ''
      : d.availability === 'site-a-only' ? '<span class="avail-badge avail-a-only">A only</span>'
      : d.availability === 'site-b-only' ? '<span class="avail-badge avail-b-only">B only</span>'
      : '';

    html += `<a class="compare-row" href="#compare-${esc(d.checkId)}">
  <span>${esc(d.tool)}${availBadge}</span>
  <span>${esc(aDisplay)}</span>
  <span>${esc(bDisplay)}</span>
  <span>${deltaDisplay}</span>
</a>`;
  }
  html += '</div>';

  // ── Per-check comparison cards ──
  for (const d of delta.deltas) {
    const aBadge = d.a ? `<span class="check-badge badge-${STATUS_CLASS[d.a.status]}">${esc(d.a.status)}${d.a.score !== null ? ' ' + d.a.score : ''}</span>` : '';
    const bBadge = d.b ? `<span class="check-badge badge-${STATUS_CLASS[d.b.status]}">${esc(d.b.status)}${d.b.score !== null ? ' ' + d.b.score : ''}</span>` : '';
    const deltaLabel = d.deltaScore !== null && d.deltaScore !== 0
      ? `<span class="${d.deltaScore > 0 ? 'delta-pos' : 'delta-neg'}">(${d.deltaScore > 0 ? '+' : ''}${d.deltaScore})</span>`
      : '';

    const why = d.a?.whyItMatters || d.b?.whyItMatters || '';
    html += `<div class="compare-card" id="compare-${esc(d.checkId)}">
  <div class="compare-card-header">
    <span class="check-title">${STATUS_ICON[d.a?.status || d.b?.status || 'skip'] || ''} ${esc(d.tool)} ${deltaLabel}</span>
    <div class="check-meta">${aBadge} ${bBadge}</div>
  </div>
  <div class="compare-card-body">
  ${why ? `<p style="color:#666;font-size:.85rem;font-style:italic;margin-bottom:.75rem">${esc(why)}</p>` : ''}`;

    if (d.availability === 'both') {
      const { shared, aOnly: aOnlyF, bOnly: bOnlyF } = classifyFindings(d.a, d.b);
      html += '<div class="side-by-side">';
      html += `<div class="site-column"><h4>${esc(labelA)}</h4>${renderDetails(d.a)}${compareCardFindings(esc(labelA) + ' only', aOnlyF, d.a)}</div>`;
      html += `<div class="site-column"><h4>${esc(labelB)}</h4>${renderDetails(d.b)}${compareCardFindings(esc(labelB) + ' only', bOnlyF, d.b)}</div>`;
      html += '</div>';
      if (shared.length) {
        html += `<div class="finding-group-label" style="margin-top:1rem">Shared issues (both sites)</div>${renderFindings(shared)}`;
      }
    } else if (d.availability === 'site-a-only') {
      html += renderFindings(d.a?.findings || [], d.a);
    } else if (d.availability === 'site-b-only') {
      html += renderFindings(d.b?.findings || [], d.b);
    }

    html += `</div></div>`;
  }

  html += foot(delta.auditedAt);
  return html;
}
