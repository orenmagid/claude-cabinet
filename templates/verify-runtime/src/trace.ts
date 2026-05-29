import { isDemoMode } from './launch-options.js';

export function traceEnabled(env: Record<string, string | undefined>): boolean {
  return env.CABINET_VERIFY_TRACE === '1' || isDemoMode(env);
}

/**
 * Build the trace artifact path for a scenario. Sanitizes the scenario
 * name to a filesystem-safe slug and appends a timestamp so repeated
 * runs of the same scenario don't clobber each other.
 */
export function traceFilePath(scenarioName: string, nowMs: number): string {
  const safeName = scenarioName.replace(/[^\w.-]/g, '_').slice(0, 60);
  return `traces/${safeName}-${nowMs}.zip`;
}
