import { recordVerdict } from './verdict-recorder.js';
import { out } from './output.js';

/**
 * Generic auto-check executor. Wraps an async assertion so that:
 *   - duration is recorded
 *   - pass/fail is logged to the verdict ledger with the checkId
 *   - failures throw (cucumber records FAILED + After hook screenshots)
 *
 * Each step's Gherkin shape is `check "{checkId} {description}" ...`.
 * `rawCheckIdAndDesc` is the raw quoted string. We split on the first
 * space — leading non-whitespace is the checkId; the remainder is the
 * description shown in terminal output and recorded with the verdict.
 *
 * Extracted from per-scenario duplicates in scenario-1/scenario-2 once
 * scenario-3 became the third caller. Behavior is identical to the
 * original copies; importers should pass `this` as the first argument
 * even though the helper does not currently consume it (kept in the
 * signature so adding world-aware behavior later doesn't ripple).
 */
export async function autoCheck<W = unknown>(
  _world: W,
  rawCheckIdAndDesc: string,
  assertion: () => Promise<void>,
): Promise<void> {
  const t0 = Date.now();
  const space = rawCheckIdAndDesc.indexOf(' ');
  const checkId = space >= 0 ? rawCheckIdAndDesc.slice(0, space) : rawCheckIdAndDesc;
  const desc = space >= 0 ? rawCheckIdAndDesc.slice(space + 1).trim() : '';
  out.stepStart(checkId, desc);
  try {
    await assertion();
    const durationMs = Date.now() - t0;
    await recordVerdict({
      checkId,
      stepText: desc,
      verdict: 'auto:pass',
      source: 'auto',
      durationMs,
    });
    out.stepPass(durationMs);
  } catch (e) {
    const durationMs = Date.now() - t0;
    const msg = e instanceof Error ? e.message : String(e);
    await recordVerdict({
      checkId,
      stepText: desc,
      verdict: 'auto:fail',
      source: 'auto',
      durationMs,
      notes: msg,
    });
    out.stepFail(durationMs, msg);
    throw e;
  }
}
