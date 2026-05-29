// Website Carbon estimates CO2 per pageview from total bytes transferred.
// Uses the Sustainable Web Design methodology — no external API needed.
// https://sustainablewebdesign.org/calculating-digital-emissions/

export const checkId = 'website-carbon';
export const tool = 'Website Carbon';

const KWH_PER_GB = 0.81;
const CARBON_FACTOR_GRAMS_PER_KWH = 442;
const RETURNING_VISITOR_RATIO = 0.25;
const CACHE_RATIO = 0.02;

export async function detect() { return true; }

export async function run(url, executor) {
  const resp = await executor.fetch(url, { redirect: 'follow' });
  const buffer = await resp.arrayBuffer();
  return { bytes: buffer.byteLength };
}

export function normalize(raw, durationMs) {
  if (!raw || typeof raw.bytes !== 'number') {
    return { checkId, tool, status: 'error', score: null, grade: null, severity: null, findings: [], durationMs, reason: 'could not determine page size' };
  }

  const bytes = raw.bytes;
  const gb = bytes / (1024 * 1024 * 1024);

  const energyFirst = gb * KWH_PER_GB;
  const energyReturn = gb * KWH_PER_GB * CACHE_RATIO;
  const avgEnergy = energyFirst * (1 - RETURNING_VISITOR_RATIO) + energyReturn * RETURNING_VISITOR_RATIO;
  const gCO2 = avgEnergy * CARBON_FACTOR_GRAMS_PER_KWH;

  const findings = [];
  const kbSize = Math.round(bytes / 1024);

  if (gCO2 > 1.0) {
    findings.push({ severity: 'serious', message: `${gCO2.toFixed(2)}g CO2/view — heavier than 80% of sites (${kbSize} KB)` });
  } else if (gCO2 > 0.5) {
    findings.push({ severity: 'moderate', message: `${gCO2.toFixed(2)}g CO2/view — above average (${kbSize} KB)` });
  } else {
    findings.push({ severity: 'info', message: `${gCO2.toFixed(2)}g CO2/view — cleaner than average (${kbSize} KB)` });
  }

  const maxBytes = 5 * 1024 * 1024;
  const score = Math.max(0, Math.min(100, Math.round((1 - bytes / maxBytes) * 100)));

  const isPass = gCO2 <= 1.0;
  const passSummary = isPass
    ? `${gCO2.toFixed(2)}g CO2/view — ${kbSize} KB page (score: ${score})`
    : undefined;

  return {
    checkId, tool, status: isPass ? 'pass' : 'fail',
    score, grade: null,
    severity: findings[0]?.severity || null,
    findings, durationMs,
    ...(passSummary && { passSummary }),
  };
}
