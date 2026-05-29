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

export { out, narrateStep } from './output.js';

export {
  resolveLaunchOptions,
  isDemoMode,
  type LaunchOptions,
} from './launch-options.js';

export {
  initDemo,
  demoActive,
  drainDemo,
} from './demo-recorder.js';

export {
  traceEnabled,
  traceFilePath,
} from './trace.js';

export {
  initProgress,
  emitProgress,
} from './progress.js';

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

export { pauseOnFailure } from './pause-on-failure.js';

// Side-effect import: registers the five baseline Cucumber steps
// (Given dev-stack-up, Given signed-in-as-role, When navigate, Then
// check, Then ask-the-human). Projects don't redeclare these — they
// register per-checkId assertions and an optional sign-in handler via
// the API re-exported below.
import './baseline-steps.js';

export {
  setSignInHandler,
  registerCheck,
  type SignInHandler,
  type CheckHandler,
} from './baseline-steps.js';
