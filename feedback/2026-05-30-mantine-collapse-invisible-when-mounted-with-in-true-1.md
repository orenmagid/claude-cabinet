---
type: field-feedback
source: claudeconsult-maginnis
date: 2026-05-30
component: cabinet-mantine-quality
---

## Mantine Collapse invisible when mounted with in={true}

**Friction:** Mantine's `Collapse` component doesn't render its children when it mounts with `in={true}` (starts open). The children exist in the DOM but have height 0 and are invisible. This caused a real bug: a legal theory edit form's "Default Content" section auto-expanded when data existed, but all form fields were hidden. The section header said "Collapse" (confirming `in` was true) but the fields below were empty. Took Playwright DOM inspection to diagnose.

**Suggestion:** The `cabinet-mantine-quality` (or `cabinet-framework-quality`) audit member should flag any `<Collapse in={expr}>` where `expr` can be truthy on initial render. The fix is simple — replace `<Collapse in={opened}>...</Collapse>` with `{opened && <>...</>}` — but the bug is invisible until a user hits the start-open path.

**Session context:** Maginnis Howard platform — discovered during verify run when default_content data existed on a legal theory but the admin edit form showed the section as empty.
