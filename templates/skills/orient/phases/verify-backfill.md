# Verify-Plan Backfill

**Contract: v0.x soft — may change before v1.0.** This phase is part
of the `/verify` integration with `/orient`. Customization phase
(opt-in), copied into your project only when the `verify` module is
selected during `npx create-claude-cabinet`.

**Runs:** after work-scan, before briefing. Pairs with
[verify-coverage on /debrief] — verify-coverage catches drift on
acts that already shipped; this phase catches the same gap on the
*front* end, at planning time, on acts still pending.

## What this phase does

Surfaces pending plans in pib-db whose surface area touches UI but
whose notes lack a `## Verify Plan` section. Advisory only — never
auto-modifies an action. The operator decides whether to re-plan the
act (adding the section) or accept the drift.

## No-op guards

This phase exits silently in two cases — checked in order:

1. **The project has no `e2e/features/` directory.** Without the
   runtime installed, there are no feature files to be out of sync
   with. Skip.
2. **No pending actions match the UI heuristic.** No Attention Items
   entry, no warning.

Detection for guard 1:

```bash
test -d e2e/features
```

If either guard trips, skip the phase entirely. No briefing line.

## Detection algorithm

1. **Query pib-db for pending UI-touching actions without a Verify
   Plan section.** The default heuristic matches the surface-area path
   patterns used by `verify-coverage.md`:

   ```sql
   SELECT fid, text, notes FROM actions
   WHERE completed = 0
     AND deleted_at IS NULL
     AND (
       notes LIKE '%webapp/frontend/%'
       OR notes LIKE '%components/%'
       OR notes LIKE '%pages/%'
       OR notes LIKE '%app/%'
     )
     AND notes NOT LIKE '%## Verify Plan%'
   ORDER BY created ASC;
   ```

   Run via `node scripts/pib-db.mjs query "<sql>"` or, if the project
   has a `phases/ui-paths.md` override, substitute those paths.

2. **Per match, judge whether it really is UI-touching.** The path
   heuristic over-matches (e.g., an action that merely mentions
   `webapp/frontend/` in a passing comment). Read the action's
   `## Surface Area` section if present and confirm the listed files
   include a UI path. If not, drop the match silently.

3. **Cap at 5 entries.** If more than 5 match, list the 5
   oldest-created and append a "(+N more — run /pulse for full list)"
   note. Don't dump 20 entries into the orient briefing.

## Output

For each remaining match, emit one Attention Items entry:

> **`<fid>`** — `<action text>`
>   Pending plan touches UI but lacks a `## Verify Plan` section.
>   Suggest: `/plan <fid>` to backfill the section, or accept drift —
>   `/debrief` will flag this act on completion if it ships uncovered.

The entries go in the briefing's **Attention Items** section,
alongside any items surfaced by deferred-check, health-checks, etc.

## What this phase does NOT do

- It does not modify action notes. The operator runs `/plan <fid>`
  to backfill, or chooses to accept the drift.
- It does not file new actions or projects.
- It does not block orient. Even with 5 backfill candidates, orient
  completes; the Attention Items accumulate.
- It does not look at *completed* acts — that's verify-coverage's job
  on `/debrief`.

## Tuning to reduce false positives

Two common refinements:

1. **Path override.** A project's `phases/ui-paths.md` (if defined)
   replaces the default path list. See `verify-coverage.md` for the
   same pattern.
2. **Per-act opt-out.** An action can declare in its notes that it's
   intentionally backend-only:
   ```
   ## Verify Coverage
   Skip: this change is internal — no UI behavior changed.
   ```
   This phase reads that line and skips the act, same as
   verify-coverage does.
