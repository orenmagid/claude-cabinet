import * as fs from 'node:fs';
import * as readline from 'node:readline';
import type { Page } from '@playwright/test';
import { out } from './output.js';
import { isDemoMode } from './launch-options.js';
import { recordFailurePause } from './demo-recorder.js';

export async function pauseOnFailure(
  page: Page | undefined,
  result: { status: string; message?: string },
  env: Record<string, string | undefined>,
  isTTY: boolean,
): Promise<void> {
  if (result.status !== 'FAILED') return;
  const shouldPause =
    env.CABINET_VERIFY_PAUSE_ON_FAIL === '1' || isDemoMode(env);
  if (!shouldPause) return;

  recordFailurePause();

  if (page) {
    try {
      fs.mkdirSync('screenshots', { recursive: true });
      await page.screenshot({
        path: `screenshots/pause-${Date.now()}.png`,
        fullPage: true,
      });
    } catch { /* page may be closed */ }
  }

  out.writeln();
  out.writeln(`  ${out.c.bold(out.c.red('STEP FAILED'))}  ${out.c.dim(result.message ?? '')}`);

  if (!isTTY) {
    out.writeln(`  ${out.c.dim('[demo] failure pause skipped (non-TTY)')}`);
    return;
  }

  out.writeln(`  ${out.c.yellow('[C]ontinue')}  ${out.c.dim('|')}  ${out.c.red('[A]bort')}`);
  out.write(`  ${out.c.bold(out.c.yellow('> '))}`);

  const answer = await new Promise<string>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    rl.question('', (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase());
    });
  });

  if (answer.startsWith('a')) {
    throw new Error('Aborted by user during demo pause-on-failure');
  }
}
