/**
 * Generic Cucumber + Playwright lifecycle for cabinet-verify.
 *
 * Ships:
 *  - BeforeAll: launch chromium with HEADLESS / SLOW_MO env vars,
 *    call startRun() to begin the verdict ledger.
 *  - AfterAll: endRun() + print summary + close browser.
 *  - Before: new context with acceptDownloads, new page, capture
 *    scenario context (file/title/role) into the verdict recorder.
 *  - After: on FAILED scenario, capture a failure screenshot.
 *
 * Project-specific extensions:
 *  Projects subclass CabinetVerifyWorld in their own e2e/support/world.ts:
 *
 *    import { CabinetVerifyWorld } from 'cabinet-verify';
 *    import { setWorldConstructor } from '@cucumber/cucumber';
 *
 *    export class MyWorld extends CabinetVerifyWorld {
 *      myCustomState: SomeType = ...;
 *    }
 *
 *    setWorldConstructor(MyWorld);
 *
 *  The base class exposes `context`, `page`, `role`, and `baseUrl`
 *  (resolved from CABINET_VERIFY_DEV_URL or a constructor option).
 *  Anything else is project-owned.
 *
 * Imports of this module are side-effectful (BeforeAll/AfterAll/Before/
 * After register globally with cucumber-js). Import once from your
 * project's cucumber-js requireModule chain.
 */

import {
  Before,
  After,
  AfterStep,
  BeforeAll,
  AfterAll,
  World,
  setDefaultTimeout,
  type IWorldOptions,
} from '@cucumber/cucumber';
import { chromium, type Browser, type BrowserContext, type Page, type Locator } from '@playwright/test';
import * as fs from 'node:fs';
import {
  startRun,
  endRun,
  setScenarioContext,
} from './verdict-recorder.js';
import { out, narrateStep } from './output.js';
import { resolveLaunchOptions, isDemoMode } from './launch-options.js';
import { initDemo, drainDemo } from './demo-recorder.js';
import { pauseOnFailure } from './pause-on-failure.js';

// Default 240s — catches real hangs without killing legit long steps.
// Steps that legitimately take longer (rewrites, manual think-time)
// override per-step.
setDefaultTimeout(240_000);

let browser: Browser | undefined;

BeforeAll(async () => {
  const opts = resolveLaunchOptions(process.env);
  initDemo(process.env);
  if (isDemoMode(process.env) && opts.slowMo > 0) {
    out.writeln(`  ${out.c.dim('[demo] slowMo: ' + opts.slowMo + 'ms')}`);
  }
  browser = await chromium.launch({
    headless: opts.headless,
    slowMo: opts.slowMo,
    args: opts.args,
  });
  await startRun();

  // Graceful exit on Ctrl-C: AfterAll won't fire on SIGINT, so endRun
  // wouldn't write the summary and the browser would leak. Best-effort
  // cleanup — swallow errors, the process is dying.
  const onSignal = async (sig: NodeJS.Signals): Promise<void> => {
    try {
      await endRun();
    } catch {
      /* tolerate */
    }
    try {
      await browser?.close();
    } catch {
      /* tolerate */
    }
    process.exit(sig === 'SIGINT' ? 130 : 143);
  };
  process.once('SIGINT', () => void onSignal('SIGINT'));
  process.once('SIGTERM', () => void onSignal('SIGTERM'));
});

AfterAll(async () => {
  drainDemo();
  const summary = await endRun();
  out.runSummary({
    runId: summary.runId,
    total: summary.total,
    passed: summary.passed,
    failed: summary.failed,
    humanVerdicts: summary.humanVerdicts,
    summaryPath: summary.reportPath,
  });
  await browser?.close();
});

/**
 * Role tag → role string mapping. Projects whose scenarios use the
 * conventional `@as-user` / `@as-admin` / `@as-fresh` tags get their
 * role recorded in the verdict ledger automatically.
 */
const ROLE_TAG_PREFIX = '@as-';

function extractRoleFromTags(tags: ReadonlyArray<{ name: string }>): string {
  for (const tag of tags) {
    if (tag.name.startsWith(ROLE_TAG_PREFIX)) {
      return tag.name.slice(ROLE_TAG_PREFIX.length);
    }
  }
  return 'unknown';
}

/**
 * Base World class. Projects extend with custom state.
 */
export class CabinetVerifyWorld extends World {
  context!: BrowserContext;
  page!: Page;
  role: string = 'unknown';
  baseUrl: string;

  constructor(options: IWorldOptions) {
    super(options);
    this.baseUrl = process.env.CABINET_VERIFY_DEV_URL || 'http://localhost:5173';
  }

  async spotlight(locator: Locator): Promise<void> {
    if (!isDemoMode(process.env)) return;
    await locator.highlight();
  }
}

Before(async function (this: CabinetVerifyWorld, scenario) {
  if (!browser) throw new Error('Browser not initialised — BeforeAll did not run');
  // viewport: null binds CSS layout to the actual browser window's
  // inner area (same as a real user). Forced virtual viewports cause
  // `position: fixed` elements to render below the visible area.
  this.context = await browser.newContext({
    viewport: null,
    acceptDownloads: true,
  });
  this.page = await this.context.newPage();

  this.role = extractRoleFromTags(scenario.pickle.tags);

  // Forward browser console errors to stderr alongside scenario progress.
  // Opt out via CABINET_VERIFY_FORWARD_CONSOLE=0 (some projects route
  // logs elsewhere or have dev-only console noise that drowns signal).
  if (process.env.CABINET_VERIFY_FORWARD_CONSOLE !== '0') {
    this.page.on('pageerror', (err) => {
      process.stderr.write(`  ${out.c.dim('[browser pageerror]')} ${out.c.dim(err.message)}\n`);
    });
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        process.stderr.write(`  ${out.c.dim('[browser console.error]')} ${out.c.dim(msg.text())}\n`);
      }
    });
  }

  out.scenarioStart(scenario.pickle.name, scenario.gherkinDocument.uri || 'unknown');
  setScenarioContext(scenario.gherkinDocument.uri || 'unknown', scenario.pickle.name, this.role);
});

After(async function (this: CabinetVerifyWorld, scenario) {
  if (scenario.result?.status === 'FAILED') {
    const safeName = scenario.pickle.name.replace(/[^\w.-]/g, '_').slice(0, 60);
    try {
      fs.mkdirSync('screenshots', { recursive: true });
      await this.page?.screenshot({
        path: `screenshots/failure-${safeName}-${Date.now()}.png`,
        fullPage: true,
      });
    } catch {
      // Page may already be closed; ignore.
    }
  }
  await this.context?.close();
});

AfterStep(async function (this: CabinetVerifyWorld, { result, pickleStep }) {
  const env = process.env;
  const shouldNarrate = env.CABINET_VERIFY_NARRATE === '1' || isDemoMode(env);
  if (shouldNarrate && pickleStep?.text) {
    const narrated = narrateStep(pickleStep.text);
    if (narrated) {
      out.writeln(`  ${out.c.bold(out.c.blue('▸'))} ${out.c.bold(narrated)}`);
    }
  }

  if (result) {
    await pauseOnFailure(
      this.page,
      { status: result.status.toString(), message: (result as { message?: string }).message },
      env,
      process.stdin.isTTY ?? false,
    );
  }
});

export type { IWorldOptions };
