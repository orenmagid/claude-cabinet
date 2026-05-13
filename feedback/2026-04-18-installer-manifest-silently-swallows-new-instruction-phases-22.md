---
type: field-feedback
source: claude-cabinet (dogfood)
date: 2026-04-18
component: lib/cli.js MODULES manifest + lib/copy.js phases-skip
severity: moderate
status: specific-instance-fixed-in-v0.23.1
---

## Installer manifest silently swallows new instruction phases

**Specific instance fixed in v0.23.1** (commit c432f70 — enumerated
`audit-pattern-capture.md`, `methodology-capture.md`, and
`upstream-feedback.md` explicitly in the session-loop module's
template list). The underlying class-of-bug remains: nothing
structurally prevents the next instruction phase from being silently
missed again.

## Friction

During v0.23.0 work, added `templates/skills/debrief/phases/methodology-capture.md`,
wrote SKILL.md step 10 to reference it, committed, published. Updated
three consumer projects (flow, article-rewriter, theater-cheater)
via `npx create-claude-cabinet@latest --yes`. All three showed
`methodology-capture.md` MISSING from
`.claude/skills/debrief/phases/` — along with
`audit-pattern-capture.md`, which had been silently missing since
whenever it was added too.

## Root cause

`lib/copy.js` line ~34 has a blanket:

```js
if (skipPhases && entry.name === 'phases') continue;
```

This skips ALL phase files by default, unless they're explicitly
named in a module's `templates` array in `lib/cli.js`. The
session-loop module only listed:

```js
'skills/debrief/phases/upstream-feedback.md'
```

So `audit-pattern-capture.md` and `methodology-capture.md` — both
self-documented in their own content as "instruction phases"
that "should not be skipped" — got swallowed by the default.

## Why this matters beyond the one fix

The distinction between **instruction phases** (always ship;
orchestration logic that belongs with the skeleton) and
**customization phases** (skip by default; projects override
when they want to) is real and worth preserving. The current
implementation encodes the distinction in prose (SKILL.md calls
each instruction phase out with "**This phase should not be
skipped.**") but enforcement lives only in whoever adds the file
remembering to also add a lib/cli.js manifest entry.

Any future instruction phase added to any skeleton skill has the
same vulnerability. The evidence that this isn't hypothetical:
`audit-pattern-capture.md` was added at some point and silently
missing until this session's dogfood caught it alongside
`methodology-capture.md`.

## Suggestions (ranked)

1. **Structural encoding via frontmatter** (recommended). Give phase
   files optional YAML frontmatter: `instruction: true`. copy.js
   checks for it and copies regardless of the default skip. Single
   source of truth — the phase file itself declares its shipping
   behavior. No manifest drift possible.

2. **CI lint**. Scan templates/skills/\*/phases/\*.md for the string
   "instruction phase" (or the `This phase should not be skipped`
   marker). For each match, verify the file is in the corresponding
   module's template list in lib/cli.js. Fail CI on mismatch. This
   catches drift at commit time.

3. **CLAUDE.md convention note** (done in this session via
   record-keeper's debrief pass). Lowest-compliance layer; useful
   backup but shouldn't be the only defense.

Option 1 is the cleanest and matches the project's broader pattern
of "structural encoding beats prose compliance." Option 2 is a good
belt-and-suspenders if the frontmatter change is deferred. Option 3
already shipped.

## Session context

Caught during post-v0.23.0 consumer updates in the /cc-publish flow.
Dogfood install revealed the missing phase file before consumer
commits were made with a broken reference to `phases/methodology-capture.md`.
The save was lucky — if the publisher hadn't also been the person
adding the phase, the broken state might have landed in three
consumer repos before anyone noticed. This is exactly the class of
bug the `instruction phase` vs `customization phase` distinction is
supposed to prevent, and it prevents nothing as currently encoded.

## Related feedback

- `2026-04-18-surface-area-validation-regex-too-strict-21.md`
  (same session) — different class of bug (regex too strict in
  validation layer) but same underlying theme: convention lives in
  prose, enforcement lives in code, drift is invisible.

## Fix verification

- commit c432f70 — "fix(installer): ship audit-pattern-capture.md
  and methodology-capture.md as instruction phases"
- v0.23.1 tested via dogfood + three consumer installs
- all three consumers now have both instruction phases present and
  a committed CC-managed-files changeset
