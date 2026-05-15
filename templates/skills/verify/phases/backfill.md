# Backfill — add a Verify Plan section to a pending action

Default behavior for `/verify backfill <fid>`. The mode adds a
`## Verify Plan` section to a pending pib-db action's notes so
`/execute`'s `verify-emit` phase can read it later. Does NOT touch
feature files — that's `/execute`'s job at action ship time.

## Inputs

- A pib-db action fid (`act:abc12345`). Passed as `$ARGUMENTS` to
  `/verify backfill`. If missing or malformed, ask the user for
  it; don't guess from context.

## Preconditions

1. The action exists. If `pib_get_action <fid>` returns nothing,
   exit with "no action found for <fid>".
2. The action is pending (`completed = 0`). If already shipped,
   tell the user: "act:<fid> already shipped on <date>. To sync
   feature files retroactively, use `/verify update <fid>` instead."
3. The action's notes don't already have a `## Verify Plan` section.
   If they do, ask: "act:<fid> already has a Verify Plan section.
   Replace it or skip?"
4. `e2e/features/` exists. If not, recommend `/verify learn` first.

## Workflow

### 1. Load and summarize

Print:

```
Backfilling Verify Plan for act:abc12345 — <action text>

Current Surface Area (from notes):
  - files: webapp/frontend/src/components/Foo.tsx
  - files: webapp/frontend/src/hooks/useFoo.ts
```

If no Surface Area section is found, say so and proceed to step 2 —
the user may want to add one inline.

### 2. Show available feature files

```
e2e/features/:
  01-desktop-rewrite.feature      (@api-small, @as-user)
  02-browse-history.feature       (@free, @as-user)
  04-admin-spot-check.feature     (@free, @as-admin)
  ...
```

Read the first two lines of each `.feature` file to surface its
tags. Skip features tagged `@manual` from suggestions unless the
action explicitly mentions iOS/mobile.

### 3. Interview, one question at a time

Per CLAUDE.md global convention — never batch. Each answer shapes
the next question. Typical sequence:

**Q1 — surface area mapping.**

> "act:abc12345 touches webapp/frontend/src/components/Foo.tsx.
> Which feature file(s) exercise that component or the route it
> renders on?"

Wait for answer. If unclear, propose candidates based on:
- The action's notes mentioning a route (`/admin`, `/history`)
- The scenario names in `e2e/features/`
- Cabinet-qa subagent if multiple plausible matches

**Q2 — edit verb.**

For each chosen feature file, ask:

> "For features/04-admin-spot-check.feature, what kind of edit?
>   - ADD step after an existing anchor
>   - MODIFY an existing step's assertion
>   - NEW scenario in a new file
>   - REMOVE a step (for deprecations)"

Wait for answer.

**Q3 — specifics.**

Depending on the verb, follow up:
- **ADD step after <anchor>**: "What's the anchor checkId, and what
  should the new step assert?"
- **MODIFY step <checkId>**: "Which step? What should the new
  assertion text say?"
- **NEW scenario**: "Scenario name? Tags (cost + role)? Brief
  description of the journey?"
- **REMOVE step <checkId>**: "Which checkId? Confirm — removed
  steps invalidate prior verdicts."

Wait for answer.

**Repeat Q1–Q3** for each additional feature file the action
touches. After the user signals "that's all," proceed.

### 4. Draft the section

Format matches `verify-plan.md`'s output spec exactly so
`verify-emit` parses it identically to plan-time output:

```markdown
## Verify Plan

- features/04-admin-spot-check.feature: ADD step after the existing
  "admin-history-list-loads" check — verify the new "balance owed"
  column renders for users with outstanding refunds (4.12b
  admin-balance-owed-column).
- features/14-downloaded-files.feature: (deferred) NEW scenario for
  the bulk-download flow — requires Phase B framework migration to
  ship first.
```

Edit verbs: `ADD step after <anchor>`, `MODIFY step <checkId>`,
`NEW scenario`, `REMOVE step <checkId>`. Use `(deferred)` prefix
for entries that depend on other work.

### 5. Show the diff

Display:

```
Existing notes:
─────────────
<truncated existing notes — last 20 lines>

Proposed appended section:
──────────────────────────
## Verify Plan

<the drafted section from step 4>
```

### 6. Confirm and write

> "Append this Verify Plan section to act:abc12345's notes? (y/n)"

If yes:
- Call `pib_update_action <fid> --notes "<existing_notes>\n\n<new_section>"`
- Confirm: "Updated act:abc12345 with Verify Plan (N entries)."

If no:
- Exit without changes.

## Out of scope

- Modifying feature files. That's `/execute`'s `verify-emit` phase
  when the action runs.
- Re-running the full /plan flow (acceptance criteria, surface area,
  cabinet review). Backfill is narrow — Verify Plan section only.
- Creating new actions. The action already exists by definition.

## When to escalate to a full /plan

If the interview reveals the action is mis-scoped — e.g., the user
realizes the surface area listed in the notes is wrong — recommend
re-planning the whole action via `/plan` instead. Backfill is only
useful when the action's scope and surface area are correct and
just the Verify Plan layer is missing.
