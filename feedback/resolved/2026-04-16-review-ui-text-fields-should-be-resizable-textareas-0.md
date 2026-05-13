---
type: field-feedback
source: sic
date: 2026-04-16
component: scripts/review-ui.html
---

## Review UI text fields should be resizable textareas

**Friction:** The per-item feedback input and per-group notes input in
`scripts/review-ui.html` are single-line `<input>` elements. For
long-form copy review (e.g., reviewing prose drafts where the response
per item is multi-sentence), the single-line input cuts off the
response and is hard to read back when scrolling.

**Suggestion:** Swap both `<input>` elements to `<textarea rows="2">`
and add `resize: vertical; min-height: 28px; font-family: inherit` to
the `.feedback-input` and `.group-input` CSS classes. The existing
event handlers (`input` event listener + `.value` collection on
submit) work unchanged because both elements expose `.value`. Patched
locally in this project as a temporary workaround; will drift back on
`cc-upgrade` until upstream lands the change.

**Session context:** Using the review server to iterate on landing-page
copy (About + Our Method) — needed multi-sentence feedback per item to
suggest revisions, which the single-line inputs made awkward.
