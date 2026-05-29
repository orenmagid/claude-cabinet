/**
 * Five universal Cucumber step handlers that every cabinet-verify
 * consumer used to re-implement by hand. Owning them here keeps
 * generated `scenario-N.ts` files free of boilerplate that has to be
 * declared in exactly one file (cucumber-js throws on duplicates).
 *
 *   Given the local dev stack is up
 *   Given I am signed in as the "{role}" role
 *   When  I navigate to {string}
 *   Then  check {string} {}
 *   Then  ask the human {string}
 *
 * Imports of this module are side-effectful: the Given/When/Then
 * calls register globally with cucumber-js. `index.ts` imports this
 * for its side effect so projects only need a single transitive
 * `import { CabinetVerifyWorld } from 'cabinet-verify'` for the
 * baseline steps to register.
 *
 * Two extension points:
 *
 *  - `setSignInHandler(fn)` — projects with real authentication
 *    register their sign-in flow. The baseline `Given I am signed in
 *    as the "{role}" role` step looks up `CABINET_VERIFY_<ROLE>_EMAIL`
 *    and `_PASSWORD`. If both are blank, the harness treats the
 *    project as no-auth and just navigates to `/`. If either is set,
 *    the registered handler is invoked.
 *
 *  - `registerCheck(idAndSlug, fn)` — projects register per-checkId
 *    assertions. The baseline `Then check {string} {}` step calls
 *    autoCheck with the registered function. If none is registered
 *    for a given checkId, the step throws with an actionable message.
 */

import { Given, When, Then } from '@cucumber/cucumber';
import { autoCheck } from './auto-check.js';
import { askHumanVerdict } from './human-verdict.js';
import { CabinetVerifyWorld } from './world.js';

export type SignInHandler = (world: CabinetVerifyWorld, role: string) => Promise<void>;
export type CheckHandler = (world: CabinetVerifyWorld) => Promise<void>;

let signInHandler: SignInHandler | null = null;
const checkRegistry = new Map<string, CheckHandler>();

/**
 * Register the project's sign-in implementation. Called from the
 * generated `support/auth.ts` at module-load time.
 *
 * The baseline `Given I am signed in as the "{role}" role` handler
 * skips this entirely when `CABINET_VERIFY_<ROLE>_EMAIL` and
 * `_PASSWORD` are both blank (no-auth fallback).
 */
export function setSignInHandler(handler: SignInHandler): void {
  signInHandler = handler;
}

/**
 * Register a per-checkId assertion. The first argument is the full
 * `"NN.NN slug"` form used in the feature file. The function receives
 * the World and should throw on failure.
 */
export function registerCheck(idAndSlug: string, handler: CheckHandler): void {
  if (checkRegistry.has(idAndSlug)) {
    throw new Error(
      `registerCheck: '${idAndSlug}' is already registered. checkIds must be unique across the project.`,
    );
  }
  checkRegistry.set(idAndSlug, handler);
}

Given('the local dev stack is up', async function (this: CabinetVerifyWorld) {
  // Preflight (npm run preflight, invoked before cucumber-js) is the
  // gate that verifies stack reachability. Re-checking here would add
  // an HTTP round-trip to every scenario for no additional signal.
});

Given(
  'I am signed in as the {string} role',
  async function (this: CabinetVerifyWorld, role: string) {
    const emailEnv = `CABINET_VERIFY_${role.toUpperCase()}_EMAIL`;
    const passwordEnv = `CABINET_VERIFY_${role.toUpperCase()}_PASSWORD`;
    const email = process.env[emailEnv];
    const password = process.env[passwordEnv];
    const hasCredentials = (email && email.length > 0) || (password && password.length > 0);

    this.role = role;

    if (!hasCredentials) {
      // No-auth project (Flow's local dev has no password, common
      // case). Land on `/` and let the rest of the scenario carry on.
      await this.page.goto(this.baseUrl + '/');
      return;
    }

    if (!signInHandler) {
      throw new Error(
        `signInAs(${role}): ${emailEnv}/${passwordEnv} are set but no sign-in handler was registered. ` +
          `Add \`setSignInHandler(signInAs)\` to support/auth.ts, or clear the env vars for a no-auth run.`,
      );
    }

    await signInHandler(this, role);
  },
);

When('I navigate to {string}', async function (this: CabinetVerifyWorld, route: string) {
  await this.page.goto(this.baseUrl + route);
});

Then(
  'check {string} {}',
  async function (this: CabinetVerifyWorld, idAndSlug: string, _rest: string) {
    await autoCheck(this, idAndSlug, async () => {
      const handler = checkRegistry.get(idAndSlug);
      if (!handler) {
        throw new Error(
          `check ${idAndSlug}: no assertion registered. ` +
            `Add \`registerCheck('${idAndSlug}', async (world) => { /* assertion */ })\` ` +
            `in the matching steps/scenario-N.ts.`,
        );
      }
      await handler(this);
    });
  },
);

Then(
  'ask the human {string}',
  { timeout: -1 },
  async function (this: CabinetVerifyWorld, idAndDescription: string) {
    const space = idAndDescription.indexOf(' ');
    const checkId = space >= 0 ? idAndDescription.slice(0, space) : idAndDescription;
    const description = space >= 0 ? idAndDescription.slice(space + 1) : '';
    await askHumanVerdict(this.page, checkId, description);
  },
);
