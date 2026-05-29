// Comparison diff: takes two SiteReports and produces a DeltaReport.
// No mode-branching inside checks — this is the only place comparison
// logic lives (architecture critique requirement).

/**
 * @typedef {Object} CheckDelta
 * @property {string} checkId
 * @property {string} tool
 * @property {'both'|'site-a-only'|'site-b-only'|'neither'} availability
 * @property {import('./schema.mjs').CheckResult|null} a
 * @property {import('./schema.mjs').CheckResult|null} b
 * @property {number|null} deltaScore   null when either side is skip/null
 */

/**
 * @typedef {Object} DeltaReport
 * @property {string} urlA
 * @property {string} urlB
 * @property {string} auditedAt
 * @property {CheckDelta[]} deltas
 * @property {{ availableBoth: number, aOnly: number, bOnly: number, neither: number }} summary
 */

/**
 * @param {import('./orchestrator.mjs').SiteReport} reportA
 * @param {import('./orchestrator.mjs').SiteReport} reportB
 * @returns {DeltaReport}
 */
export function diff(reportA, reportB) {
  const mapA = new Map(reportA.results.map(r => [r.checkId, r]));
  const mapB = new Map(reportB.results.map(r => [r.checkId, r]));

  const allIds = new Set([...mapA.keys(), ...mapB.keys()]);
  const deltas = [];
  let availableBoth = 0, aOnly = 0, bOnly = 0, neither = 0;

  for (const id of allIds) {
    const a = mapA.get(id) || null;
    const b = mapB.get(id) || null;

    const aRan = a && a.status !== 'skip';
    const bRan = b && b.status !== 'skip';

    let availability;
    if (aRan && bRan) { availability = 'both'; availableBoth++; }
    else if (aRan) { availability = 'site-a-only'; aOnly++; }
    else if (bRan) { availability = 'site-b-only'; bOnly++; }
    else { availability = 'neither'; neither++; }

    const aScore = a?.score ?? null;
    const bScore = b?.score ?? null;
    const deltaScore = (availability === 'both' && aScore !== null && bScore !== null)
      ? bScore - aScore
      : null;

    deltas.push({
      checkId: id,
      tool: a?.tool || b?.tool || id,
      availability,
      a, b,
      deltaScore,
    });
  }

  return {
    urlA: reportA.url,
    urlB: reportB.url,
    auditedAt: new Date().toISOString(),
    deltas,
    summary: { availableBoth, aOnly, bOnly, neither },
  };
}
