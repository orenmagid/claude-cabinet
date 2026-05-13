---
type: field-feedback
source: claude-cabinet (dogfood)
date: 2026-04-18
component: pib-db-lib.mjs / validateSurfaceArea
severity: moderate
---

## `## Surface Area` validation regex is too strict

**Skill/phase:** `pib_create_action` / `validateSurfaceArea()` in
`templates/scripts/pib-db-lib.mjs`

## Friction

Filing an action via `pib_create_action` with a header like
`## Surface Area (when triggered)` errors with `empty_surface_area`
even though the section has valid `- files:` entries underneath.

The root cause: `validateSurfaceArea` uses two different regexes that
disagree.

1. **Section presence check** (`hasSection`) uses `/^## Surface Area/m`
   — matches any line *starting* with `## Surface Area`. Passes for
   `## Surface Area (when triggered)`.
2. **Body extraction** uses
   `/^## Surface Area\s*\n([\s\S]*?)(?=\n## |\n*$)/m` — requires the
   header to be *exactly* `## Surface Area` followed by whitespace
   then a newline. Fails for any qualifier after the header text.

Result: presence check passes, body extraction returns nothing, the
`hasEntry` test on the empty body fails, and the caller sees
`empty_surface_area` — which is misleading. The section IS there and
IS populated; the error message points in the wrong direction.

## How I hit it

Filing a deferred-with-trigger hardening action (act:71e4fb81) where
I wanted to label the Surface Area section as "(when triggered)" to
distinguish it from active-today work:

```markdown
## Surface Area (when triggered)

- files: templates/scripts/pib-db-lib.mjs
- files: templates/scripts/pib-db-schema.sql
...
```

The filing failed. I stripped the parenthetical and it went through.
Lost maybe 30 seconds + one retry, but the error message sent me
looking at my file list for a formatting issue rather than at the
header.

## Suggestion

Two options, in order of my preference:

**Option A: Relax the header regex.** Accept common qualifiers:

```js
const sectionMatch = notes.match(
  /^## Surface Area\b[^\n]*\n([\s\S]*?)(?=\n## |\n*$)/m
);
```

This allows `## Surface Area`, `## Surface Area (when triggered)`,
`## Surface Area — Phase 1`, etc. `\b` prevents matching
`## Surface Area-Note` as a false positive.

**Option B: Return a clearer error on header mismatch.** If
`hasSection` passes but body extraction produces nothing, detect that
state specifically and return a dedicated error:

```js
error: 'surface_area_header_format',
message: 'Surface Area section header must be exactly "## Surface Area" (no trailing content on the same line)',
```

This keeps the strict check but at least directs the caller to the
right fix.

Option A is cheaper and better UX. Option B is a defensive fallback
if the regex relaxation ever needs to be tightened back.

## Session context

Surfaced during /execute of prj:383f5388 (deferred-trigger tracking
in pib-db) — specifically while filing trigger-gated follow-up
actions for speculative hardening items that cabinet sweep flagged
but weren't landing in the main commit. The irony: I was filing
deferred-trigger actions using the deferred-trigger mechanism I had
just built, and the pib-db filing layer I depend on rejected them
on a formatting technicality.

## Related observation (not part of this feedback item)

The `~/.claude/cc-feedback-outbox.json` currently has 24 items, most
marked pending. The orient outbox-flush phase should have processed
these on recent /orient runs in consumer projects. The fact that
they're still there suggests either (a) the flush isn't running
when it should, or (b) the consumer-side delivery to CC's feedback/
directory isn't working. Worth a separate look.
