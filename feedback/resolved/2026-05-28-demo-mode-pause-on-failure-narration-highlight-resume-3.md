---
type: field-feedback
source: claudeconsult-maginnis
date: 2026-05-28
component: verify (runtime + SKILL.md)
---

## Demo mode: pause-on-failure, narration, highlight, and resume

**Friction:** When a check fails during a visible (`HEADLESS=false`)
verify run, Cucumber stops the scenario immediately and closes the
browser. During a demo this is catastrophic — the viewer sees the
browser vanish with no explanation. During iterative development it's
also bad — you can't inspect the page state after a failure.

**Suggestion:** Add a `VERIFY_DEMO_MODE=true` env var (or `npm run
verify:demo`) that enables:

1. **Pause-on-failure** — on check failure, take a screenshot, print
   the error, and wait for human acknowledgement (P=continue anyway,
   N=abort) instead of stopping. Turns failures into discussion points.
2. **Narration** — print a one-line description before each step so
   the viewer knows what's about to happen ("Now filling in the
   qualification form...").
3. **Auto-screenshot every step** — creates a full walkthrough gallery
   without needing explicit human-verdict pauses.
4. **Highlight interacted element** — briefly outline the element
   Playwright is about to click/fill so viewers can follow along.
5. **Resume-from-step** — if a scenario fails mid-way, option to
   restart from the last passing step instead of from scratch.

**Session context:** First /verify learn on Maginnis Howard. During
iterative debugging, every failure killed the browser — had to re-run
from scratch each time. During the upcoming client demo, a failure
would be visible and disruptive with no recovery path.
