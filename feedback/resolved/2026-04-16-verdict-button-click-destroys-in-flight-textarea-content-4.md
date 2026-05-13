---
type: field-feedback
source: sic
date: 2026-04-16
component: scripts/review-ui.html
---

## Verdict button click destroys in-flight textarea content

**Friction:** Clicking a verdict button (Ship / Revise / Cut / Defer / ?)
while the user is typing into a feedback field caused the typed text to
disappear. Root cause: the verdict-btn handler called `captureInputs()`
then `render()`, which rebuilt the entire DOM via `innerHTML` — replacing
every textarea element. Although `captureInputs` reads `.value` into
`verdicts[id].feedback` first, users still lost notes in practice (likely
causes: IME composition state not flushed before captureInputs; race
between input and click events; or focus/cursor loss making it look like
data was deleted). High-friction in long-form review sessions where each
item's note is multi-sentence.

**Suggestion:** Stop destroying the textarea on every button click. Patch
applied to `templates/scripts/review-ui.html`: added an
`applyVerdictInPlace(id, v)` helper that toggles the `sel-*` class on
sibling verdict-btns and updates the textarea's class + placeholder
*without touching the textarea element itself*. Both the `verdict-btn`
and `bulk-btn` click handlers now call `applyVerdictInPlace` +
`updateProgress` + `updateStats` instead of `render()`. Net effect:
textarea (and any focus / cursor / typed-but-not-yet-blurred content) is
preserved across button clicks. Patched directly in the CC source repo
(`/Users/orenmagid/claude-cabinet/templates/scripts/review-ui.html`)
because the running review server reads from there; project copy at
`/Users/orenmagid/article-rewriter/scripts/review-ui.html` was patched
in parallel and will drift back on `cc-upgrade` until upstream lands
the change.

**Session context:** Iterating on landing-page copy (About + Our Method)
via the review server. User typed a multi-sentence note in a textarea,
clicked a verdict button, and watched the note vanish.
