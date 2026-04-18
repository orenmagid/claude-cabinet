# Deferred-Trigger Evaluation

**Runs:** after work-scan, before auto-maintenance.

**Purpose:** surface items waiting on specific trigger conditions and
evaluate whether any now apply in current session context.

## Steps

1. Call `pib_list_triggered` (MCP) or
   `node scripts/pib-db.mjs list-triggered` (CLI fallback).
2. If zero items returned, skip silently. Do not mention in briefing.
3. Otherwise, surface in briefing under a "Deferred (N items with
   triggers)" heading:

   ```
   ### Deferred (3 items with triggers)

   **prj:abc12345** — AI infrastructure layer
     Trigger: 3+ projects calling Claude API OR spend > $20/mo
     Last checked: 2026-04-17 (0d ago) — still-waiting

   **act:def67890** — Postgres default in onboard
     Trigger: Next new webapp project scaffolded
     Last checked: never
   ```

4. For each item, evaluate the trigger text against current session
   context. Ask:
   - Does anything in this project's state, recent git activity, or the
     user's stated focus suggest the trigger has fired?
   - If unsure, mark `needs-info` rather than guessing `triggered`.

5. For each item, call `pib_mark_trigger_checked` with:
   - `fid`: the item's fid
   - `result`: one of
     `triggered | still-waiting | needs-info | condition-obsolete`
   - `notes`: brief reasoning

6. In the briefing's **Attention Items** section, include any items
   that evaluated to `triggered`:

   ```
   ### Attention Items
   - prj:abc12345 appears TRIGGERED. Reason: [model's reasoning]. Reopen?
   ```

   User decides whether to reopen. Do not auto-reopen.

## Non-goals

- Do not auto-change status. The column update happens only when the
  user explicitly approves reopening.
- Do not spend more than 30 seconds total on this phase. If N > 10
  items, evaluate only the 5 least-recently-checked.
