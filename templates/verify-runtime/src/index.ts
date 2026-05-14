/**
 * cabinet-verify — public API surface.
 *
 * Walkthrough verification harness for Claude Cabinet. Cucumber +
 * Playwright scenarios with human-in-the-loop verdict pause. See
 * CONVENTIONS.md for the frozen contracts (verdict ledger schema,
 * verdict chars, pathHash spec, env-var prefix).
 */

export {
  startRun,
  endRun,
  recordVerdict,
  setScenarioContext,
  getCurrentScenarioFile,
  getCurrentRunId,
  getCurrentRows,
  type VerdictRow,
  type RunSummary,
  type RecordInput,
} from './verdict-recorder.js';

export { autoCheck } from './auto-check.js';

export {
  loadFixture,
  fixtureAbsolutePath,
  recommendedRewriteTimeoutSec,
  type Fixture,
  type FixtureSize,
} from './fixture-loader.js';

export { out } from './output.js';

export {
  computePathHash,
  computePathHashSafe,
  extractCheckIdFromStep,
} from './path-hash.js';

export {
  isFreshPass,
  getFreshPass,
  type FreshPassRow,
} from './fresh-pass-cache.js';

export {
  askHumanVerdict,
  type HumanVerdictChar,
  type HumanVerdictResult,
} from './human-verdict.js';

export {
  walkManualChecklist,
  parseManualChecklist,
  type ManualChecklistItem,
  type ManualVerdictChar,
} from './manual-runner.js';

export {
  preflight,
  runPreflightCli,
  type PreflightOptions,
} from './preflight.js';

export { CabinetVerifyWorld, type IWorldOptions } from './world.js';
