# Move baseline step handlers into cabinet-verify (or support/common-steps.ts); fix signInAs default

Source: flow
Component: verify + cabinet-verify (step-definition ergonomics)
Date: 2026-05-17

## Friction

Three separate ergonomic gaps that compound on first run:

1. **No baseline step definitions provided by cabinet-verify.** Every generated `.feature` file uses the same five steps in Background + body:
   - `Given the local dev stack is up`
   - `Given I am signed in as the "{role}" role`
   - `When I navigate to {string}`
   - `Then check {string} {}`
   - `Then ask the human {string}`

   None of these are implemented in cabinet-verify, despite cabinet-verify owning the `autoCheck` + `askHumanVerdict` primitives that make them trivial. Every project rewrites the same handlers.

2. **`scenario-N.ts` files are asymmetric.** install.sh puts the three baseline handlers into `scenario-01.ts` and writes a "do NOT redeclare these" warning into `scenario-{02..05}.ts`. Cucumber throws on duplicate step patterns, so the contract is real — but the asymmetry is fragile. A new contributor copying `scenario-01.ts` as a template will reintroduce the duplicates.

3. **`support/auth.ts`'s `signInAs` ships as a throw-stub that always fails.** Even single-user / no-auth projects (a common case — Flow's local dev has no password) get blocked at step 1 of every scenario with `signInAs: not implemented`. The default should detect "no credentials configured → navigate to / and bail" so the harness can at least START running.

## Suggestion

- **Move all five baseline handlers into cabinet-verify itself** (exported from `cabinet-verify/world` or auto-registered when the World is imported). Projects keep `support/world.ts` for the World subclass and a `support/auth.ts` for project-specific sign-in, but never reimplement navigate/check/ask-human.
- **OR** generate them into `support/common-steps.ts` instead of `scenario-01.ts`, and remove the asymmetric warning from the other scenario files. Either way, the per-scenario step files become purely scenario-specific.
- **Patch `signInAs`** to fall through to `world.page.goto(world.baseUrl + '/')` when both EMAIL and PASSWORD envs are blank, with a comment that the consumer should implement real auth as soon as they need it.

## Session context

During Flow's `/verify learn` cold-start, the baseline step rewrites + duplicate-handler dance + auth stub failures consumed multiple iterations before any real scenario logic could be exercised. The fixes are mechanical and would save every new consumer roughly the same loop.
