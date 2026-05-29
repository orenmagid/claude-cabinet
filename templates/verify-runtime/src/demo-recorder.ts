import { isDemoMode } from './launch-options.js';

interface DemoState {
  active: boolean;
  screenshots: string[];
  stepsNarrated: number;
  failuresPaused: number;
}

let state: DemoState = {
  active: false,
  screenshots: [],
  stepsNarrated: 0,
  failuresPaused: 0,
};

export function initDemo(env: Record<string, string | undefined>): void {
  state = {
    active: isDemoMode(env),
    screenshots: [],
    stepsNarrated: 0,
    failuresPaused: 0,
  };
}

export function demoActive(): boolean {
  return state.active;
}

export function recordScreenshot(path: string): void {
  state.screenshots.push(path);
}

export function recordNarration(): void {
  state.stepsNarrated++;
}

export function recordFailurePause(): void {
  state.failuresPaused++;
}

export function drainDemo(): DemoState {
  const result = { ...state };
  state = { active: false, screenshots: [], stepsNarrated: 0, failuresPaused: 0 };
  return result;
}
