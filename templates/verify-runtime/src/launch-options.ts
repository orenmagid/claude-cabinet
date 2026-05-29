export interface LaunchOptions {
  headless: boolean;
  slowMo: number;
  args: string[];
}

export function isDemoMode(env: Record<string, string | undefined>): boolean {
  return env.CABINET_VERIFY_DEMO === '1';
}

export function resolveLaunchOptions(env: Record<string, string | undefined>): LaunchOptions {
  const demo = isDemoMode(env);
  const headless = demo ? false : env.HEADLESS === '1';

  let slowMo = 0;
  if (env.SLOW_MO != null && env.SLOW_MO !== '') {
    const parsed = Number.parseInt(env.SLOW_MO, 10);
    slowMo = Number.isFinite(parsed) ? parsed : 0;
  } else if (demo) {
    slowMo = 1000;
  }

  return {
    headless,
    slowMo,
    args: ['--window-size=1500,1000'],
  };
}
