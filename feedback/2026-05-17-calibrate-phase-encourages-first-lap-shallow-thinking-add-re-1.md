# Calibrate phase encourages 'first lap = shallow' thinking; add recipes for common testability gotchas

Source: flow
Component: verify (calibrate phase + skill prose)
Date: 2026-05-17

## Friction

Two related issues with how `/verify learn` shapes scenario depth:

1. **The 'first lap' framing encourages no-op stubs as a default sequencing strategy.** The generated `scenario-N.ts` files include comments like:
   ```ts
   When('I toggle a forecast filter', async function () {
     // Smoke no-op: actual filter UX deepened later.
   });
   ```
   And the skill's prose around the first-lap pattern leans into this. In practice it led to a green-but-empty harness — scenarios that 'passed' without actually exercising the page. The user explicitly pushed back: 'Seems like laziness. And the fact that something has never been exercised is a PERFECT reason to exercise it with this.' The framing fights what walkthrough verification is FOR.

2. **Common testability gotchas aren't documented.** Three real blockers surfaced during deepening, each costing significant time:
   - **dnd-kit reorder is not driveable from Playwright via any path I tried** (page.mouse, CDP `Input.dispatchMouseEvent` with pointerType, keyboard sensor via focus+arrows). dnd-kit's PointerSensor doesn't activate. I ended up using an API surrogate while filing a Flow Dev finding (Flow's `act:e7486f67`).
   - **`document.createElement('input')` + `.click()` defeats Playwright's filechooser API silently.** The chooser opens, `setFiles` is accepted, the React `onChange` even fires — but no bytes reach the upload. Common React pattern; testability dead end.
   - **Hash routing vs path routing isn't probed by the discovery subagent.** Feature files came out using `/forecast`, `/people` while the app actually serves `#forecast`, `#people`. Caught only via test failure.

## Suggestion

1. **Rewrite the 'first lap' section of `/verify learn`'s SKILL.md** to make explicit that scenario depth comes first, not later. No-op stubs in the generated `scenario-N.ts` files are an anti-pattern, not a sequencing strategy. The skill should encourage filing Flow Dev (consumer-project) findings for un-driveable interactions rather than silently stubbing them.

2. **Add a `phases/recipes.md` (or equivalent)** with at least three entries:
   - **dnd-kit / pointer-sensor drag in Playwright** — current state: not testable through standard APIs. Workaround: API surrogate + file a finding requesting a test seam. Real fix: drop activation distance in test builds OR expose a programmatic reorder hook.
   - **Dynamic file inputs** — `createElement('input').click()` defeats filechooser. Recommend persistent hidden `<input ref={...}>` pattern. Detection: any consumer using this pattern needs a finding filed.
   - **Hash routing detection** — discovery subagent should probe `App.tsx` for `useHashTab` / `parseHash` / `window.location.hash` patterns and emit the correct route format in generated `.feature` files.

3. **Praise to keep: `cabinet-qa`'s ≤5 scenario cap in the draft phase worked well** — kept the initial set tight enough to calibrate without paralysis. Worth preserving across future skill revisions; don't loosen it.

## Session context

Flow's `/verify learn` cold-start → deepening pass. After the user called out the shallowness, deepening surfaced the three testability gotchas above plus a fourth (the auto-detected hash routing). Each took 30-60 min of iteration to either work around or document. With recipes pre-written, the same loops would have collapsed to minutes.
