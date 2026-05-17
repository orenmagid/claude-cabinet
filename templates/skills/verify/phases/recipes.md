# /verify — Testability recipes

Catalogue of patterns that surface during real `/verify learn` work
where the obvious test approach turns out to be a dead end. Each
entry documents the problem, why standard test tooling fails, the
workaround that lets the scenario proceed, the real fix that should
land in the consuming project, and the detection signal so the
discover phase can flag it early.

Recipes are upstream-owned. Projects extend with their own
`phases/recipes-project.md` for patterns specific to their stack.

---

## Recipe 1: dnd-kit drag-and-drop is not driveable from Playwright

**Problem.** Scenarios that reorder list items via dnd-kit's
`PointerSensor` can't be driven from any standard Playwright path:
`page.mouse.down/move/up`, CDP-level pointer events, or the keyboard
sensor (which dnd-kit ships but rarely activates by default).

**Why it's hard.** dnd-kit's PointerSensor uses an activation
constraint (delay or distance) that gates dragstart. Playwright's
synthetic pointer events fire too fast for the delay constraint, and
the `movementX/Y` values don't satisfy the distance constraint
because Playwright moves to absolute coordinates, not deltas.
Headless Chromium's input event semantics differ subtly from a
real browser, and dnd-kit's measurement of "is the pointer outside
the activation radius" comes back negative.

**Workaround for the scenario.** Use an API surrogate. If the reorder
ultimately persists via a mutation (PATCH /api/items/order), call the
API directly from the step body. Assert the resulting order via the
UI in the next step.

**Real fix in the consuming project.** Add a programmatic reorder
hook to the component, gated on `NODE_ENV === 'test'` or a
`__test__` data attribute. Expose `window.__test__.reorder(from, to)`
in the test build. The scenario then drives reordering through that
hook instead of through dnd-kit's sensor.

**Detection signal.** Discovery phase reports any import of
`@dnd-kit/core` or `@dnd-kit/sortable`. The first scenario that
needs to verify a reorder filed a finding against the consuming
project with title "dnd-kit test seam needed".

---

## Recipe 2: Dynamic `<input>` for file upload silently defeats filechooser

**Problem.** The React pattern `document.createElement('input')`,
attach handler, `.click()` (used to trigger a file picker without a
permanent visible input) defeats Playwright's
`page.waitForEvent('filechooser')`. The chooser opens, `setFiles` is
accepted, the input's `change` event fires — but no bytes reach the
upload handler downstream because the input element is GC'd before
the upload code reads it.

**Why it's hard.** Playwright's filechooser API assumes a persistent
`<input type="file">`. With a transient one, the filechooser event
references an input that no longer exists by the time the upload
handler runs. There's no console warning; the upload "succeeds" with
zero bytes.

**Workaround for the scenario.** Skip this step in the harness and
file a finding. Trying to drive transient inputs costs more time
than the verification gains.

**Real fix in the consuming project.** Use a persistent hidden
`<input ref={...}>` that the component triggers via `ref.click()`.
Filechooser semantics work as documented.

**Detection signal.** Discovery phase greps for the pattern
`document.createElement('input')` followed by `.click()` within ~5
lines. Any hit triggers a finding "transient file input — test
seam required" against the consuming project.

---

## Recipe 3: Hash routing vs path routing mismatch

**Problem.** Generated feature files use `When I navigate to "/forecast"`
against an app that serves routes at `#forecast`. Every scenario fails
at the navigate step because the dev URL `http://localhost:5173/forecast`
404s while `http://localhost:5173/#forecast` works.

**Why it's hard.** The mismatch is silent at generation time. Cold-
start operators see "step failed" and assume a selector issue rather
than a routing-shape issue. The fix is one character per scenario but
finding the pattern takes a half-hour.

**Workaround for the scenario.** Hand-edit `When I navigate to "..."`
lines to use `#route` form.

**Real fix in the consuming project.** None — hash routing is a
legitimate choice. The fix lives in `/verify learn`'s discover phase:
detect routing shape and emit the correct form in generated
`.feature` files. See `phases/discover.md` "Routing shape (path vs
hash)" section.

**Detection signal.** Discovery's routing-shape probe surfaces this
before generation. If a project switches routing shape after `learn`
ran, `/verify update` should catch the mismatch on the next scenario
run.

---

## Adding new recipes

When a `/verify learn` cold-start hits a 30-min+ testability gotcha,
add it here as a fourth recipe with the same five fields. The pattern
catches itself: future operators reading recipes.md before starting
avoid the same time sink.
