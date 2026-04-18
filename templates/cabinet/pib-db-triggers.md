# pib-db Deferred Triggers

How to defer work items with structured return conditions and how
orient re-evaluates them each session.

## Purpose

Big ideas tend to rot. Someone raises an infrastructure proposal, a
platform-auth gap, or a stack-choice pivot — the idea is real, but it
cannot be acted on today. Without structure, it lands in `feedback/`
or a `status='deferred'` row and sits there forever. Nobody re-reads
`feedback/`. Nobody scans deferred items.

Deferred triggers turn those items into structurally-encoded work:
each one carries a natural-language condition describing what would
have to change to reactivate it. Orient surfaces them every session
and evaluates the condition against the current session's context.
The item sits in the queue, not on a reminder list.

## Schema

- `actions.trigger_condition TEXT` — natural-language predicate.
  `NULL` means the action is not trigger-gated. Non-null means the
  action is waiting on a specific condition.
- `projects.trigger_condition TEXT` — same semantics for projects.
- `trigger_checks` table — append-only history of evaluations.
  Fields: `id`, `target_table`, `target_fid`, `checked_at`, `result`,
  `notes`. No foreign key back to `actions`/`projects`, so history
  is preserved even if the item is deleted.

## API

Three operations. Prefer MCP tools; fall back to CLI.

### `pib_defer_with_trigger(fid, triggerCondition, cascade?)`

Use when deferring with a specific return condition. Prefer over
`pib_update_action` with `status='deferred'` when the deferral is
conditional on something identifiable.

- Action: sets `status='deferred'` and writes `trigger_condition`.
- Project: sets `status='someday'` and writes `trigger_condition`.
- If a project has open child actions, `cascade: true` is required.
  See [Cascade semantics](#cascade-semantics-for-projects).

CLI:
```bash
node scripts/pib-db.mjs defer-with-trigger <fid> --trigger "<text>" [--cascade]
```

### `pib_list_triggered({includeDone?})`

Returns items with `trigger_condition` set. By default excludes
completed items; pass `includeDone: true` to include them.

CLI:
```bash
node scripts/pib-db.mjs list-triggered [--include-done]
```

### `pib_mark_trigger_checked(fid, result, notes?)`

Records an evaluation outcome into `trigger_checks`. Does not change
the item's `status` or `trigger_condition` — reactivation is a
separate explicit action taken by the user or orient.

CLI:
```bash
node scripts/pib-db.mjs mark-trigger-checked <fid> --result <value> [--notes "<text>"]
```

## Result vocabulary

Four values. The CHECK constraint on `trigger_checks.result` rejects
anything else.

- `triggered` — the condition is now met; the item is ready to
  reactivate. Surface in Attention Items. Do not auto-reopen —
  leave the decision to the user.
- `still-waiting` — condition checked, not yet met. Normal idle state.
- `needs-info` — cannot evaluate from current session context. Flag
  for the user; do not guess `triggered`. When in doubt, pick this.
- `condition-obsolete` — the condition no longer makes sense. Example:
  "when we add Postgres support" but Postgres was dropped from the
  roadmap. Triggers a review of whether to drop the item entirely or
  rewrite the trigger.

## When to use vs plain deferred

| Situation | Mechanism |
|---|---|
| Blocked by something else on your plate right now | `status='deferred'` (no trigger) |
| Waiting for a specific external condition, needs monitoring | `trigger_condition` |
| Vague future intent, no specific signal | project `status='someday'` (no trigger) |
| "Someday, specifically when X happens" | project `trigger_condition` |

Rule of thumb: if you can write one sentence describing what would
have to be true for the item to matter again, that sentence is the
trigger. If you can't, it's plain deferred/someday.

## Cascade semantics for projects

Deferring a project with open child actions requires `cascade: true`.
The cascade:

1. Sets each open child action to `status='deferred'`.
2. Appends an inheritance line to each child's notes:
   `_Deferred alongside parent prj:abc (trigger: <text>)_`
3. Does NOT write `trigger_condition` to children. The parent's
   trigger is the single source of truth.

When the parent reopens (user flips status back to `active`, or
orient surfaces it as `triggered` and the user accepts):

- Children remain `deferred`.
- The user decides which children to reopen. Reopening everything
  automatically often resurrects stale subgoals that the deferral
  period should have retired.

## Orient integration

The `deferred-check.md` phase fires after `work-scan.md`, before
`auto-maintenance.md`. Every session:

1. Orient calls `pib_list_triggered` (or CLI fallback).
2. For each item, evaluates the trigger text against the current
   session's context (new dependencies installed? a referenced file
   now exists? a stack decision was finalized?).
3. Records each evaluation via `pib_mark_trigger_checked`. Prefer
   `needs-info` over guessing `triggered`.
4. Items that evaluate to `triggered` appear in the briefing's
   **Attention Items** section. Orient does not auto-reopen — the
   user decides.

Cost control: cap the phase at 30 seconds. If more than 10 items are
triggered, evaluate only the 5 least-recently-checked.

## Migration guarantees

- **Additive-only.** New columns and new tables are allowed through
  the `migrate()` path. Destructive changes (dropping columns,
  changing types, removing constraints) require a new versioned
  migration with explicit approval — they do not belong in the
  default path.
- **Gated on every startup.** Migrations run on every MCP startup
  and every CLI invocation, gated by `PRAGMA user_version`. Only
  pending migrations apply; the path is idempotent.
- **Per-worktree.** Each worktree's local `pib.db` migrates
  independently. Migrations run against whichever DB the process
  opens. This is normal SQLite worktree behavior.
- **Schema parity invariant.** Any new `trigger_*` column added to
  `actions` MUST also be added to `projects` in the same migration.
  The two tables mirror each other for trigger semantics.

## Index placement rule

If any future index references a column added through the `migrate()`
path, the index must also be created via `migrate()`, NOT in the
`SCHEMA` block's `CREATE INDEX IF NOT EXISTS` stanza.

Reason: the `SCHEMA` block runs before ALTER TABLE migrations.
Indexing a yet-to-exist column errors on existing databases. The
rule is mechanical — add the column in migrate(), add the index in
migrate(), in that order.

## CLI equivalents

```bash
node scripts/pib-db.mjs defer-with-trigger <fid> --trigger "<text>" [--cascade]
node scripts/pib-db.mjs list-triggered [--include-done]
node scripts/pib-db.mjs mark-trigger-checked <fid> --result <value> [--notes "<text>"]
```

All three map 1:1 to the library functions in `pib-db-lib.mjs`. Use
MCP tools when available; the CLI is the fallback for non-MCP
contexts.

## Known limitations

- **Trigger evaluation is LLM-semantic, not deterministic.** Two
  sessions may evaluate the same trigger differently. The
  `trigger_checks` history is the audit trail — read it to see how
  past sessions interpreted the same condition.
- **No forcing function between sessions.** If a trigger sits
  unchecked across many sessions (no orient runs), nothing forces
  evaluation. Worst case: a `triggered` item sits unnoticed for a
  week. Acceptable soft limit; the alternative (scheduled jobs) adds
  infrastructure we don't want.
- **Concurrent migration race, theoretical.** SQLite handles locking,
  but a race on `PRAGMA user_version` is theoretically possible if
  two MCP processes open the DB at the same instant. In practice,
  MCP servers are per-session and the window is microseconds.
