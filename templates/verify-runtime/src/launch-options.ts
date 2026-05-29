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

  const windowSize = env.CABINET_VERIFY_WINDOW_SIZE || (demo ? '1100,750' : '1500,1000');
  const args = [`--window-size=${windowSize}`];
  if (demo) {
    const windowPos = env.CABINET_VERIFY_WINDOW_POSITION || '0,0';
    args.push(`--window-position=${windowPos}`);
  }

  return { headless, slowMo, args };
}
