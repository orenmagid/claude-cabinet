# Plan: Deferred-Trigger Tracking for pib-db

## Problem

Actions and projects marked `status = 'deferred'` or `'someday'` in
pib-db have no structured way to express the **condition** under which
they should be re-surfaced. Trigger conditions live in free-form
`notes` ("Trigger: when Claude API spend > $20/mo") with no
validation, no queryability, and no re-evaluation — so deferred items
silently rot. The existing Flow Ollama action (`act:9fb95b0f`) is a
real-world example: its trigger sits in notes, and nothing checks it
each session.

Three field-feedback items from 2026-04-17 want this capability
structurally:

- **AI infrastructure proposal** (Flow): triggers when 3+ projects
  call Claude API, or spend exceeds threshold, or Cloudflare Pro
  considered.
- **Auth/sessions template** (de[sic]ify): triggers when a second
  CC project starts building user accounts.
- **Postgres-default scaffolding** (de[sic]ify): triggers next time
  a new webapp project is scaffolded.

Without structural support: these proposals either live in `feedback/`
(ages out of attention), live in someone's head (lost on session
turnover), or are filed as open actions (noise in the current work
backlog).

## Design decisions

**Trigger condition is free-text (semantic), but its presence is
structural.** We do NOT try to give triggers a formal grammar —
conditions are inherently semantic ("when 3+ projects use AI
routing"). What we encode is: *this item is waiting for a specific
condition, here's what it is in natural language, last checked on
date X*. The orient phase queries deterministically
(`WHERE trigger_condition IS NOT NULL`), then the model evaluates
predicates against current session context.

**`trigger_condition` supplements status, does not replace it.**
`status = 'deferred'` / `'someday'` still exists. The presence of
`trigger_condition` distinguishes *"waiting for a specific condition"*
from *"maybe someday, unspecified"*.

**Applies to both actions AND projects.** Big-swing proposals are
project-scale (multi-phase work). Small deferrals are action-scale.
The column goes on both tables for symmetry.

**Migration runs on every MCP startup, not just on new DBs.** The
existing `init()` migration block only runs on fresh DBs (the
MCP server's `handleToolCall` only calls `init` when the `projects`
table doesn't exist). We'll extract migrations into a separate
`migrate()` function that runs unconditionally on MCP startup and
CLI invocation, so existing consumer DBs gain the new column on the
next session.

**Trigger evaluation is an orient phase, not a hook.** The
`phases/deferred-check.md` file surfaces items during orient's
briefing. Model evaluates predicates; user decides. No silent
auto-reopen.

**Naming: "trigger" not "condition" alone.** A trigger_condition
field is self-describing. Using just "condition" would collide with
semantic models of validation or status.

## Implementation

### Phase 0: Schema convention

**Action A0 — Define trigger schema convention**

Before writing code: document the schema + API + orient-surfacing
convention in one authoritative doc, so consumers and future sessions
don't drift.

Write `.claude/cabinet/pib-db-triggers.md` (goes upstream to
`templates/cabinet/` via Action A7). Document:

- Column shape: `trigger_condition TEXT`, `trigger_last_checked TEXT`
- Convention: trigger is natural-language predicate text; presence of
  the column value = "waiting"; NULL = "not trigger-gated"
- API: `pib_defer_with_trigger(fid, trigger_condition)`,
  `pib_list_triggered(all?)`, `pib_mark_trigger_checked(fid, result)`
- Orient surfacing: briefing includes "N deferred items with
  triggers; model evaluates each against current session context"
- CLI equivalents: `node scripts/pib-db.mjs defer-with-trigger`,
  `list-triggered`, `mark-trigger-checked`

### Phase 1: Schema migration in pib-db-lib

**Action A1 — Extract migrations into `migrate()`; add trigger columns**

Modify `templates/scripts/pib-db-lib.mjs`:

1. Extract the migrations block (lines 32–42) from `init()` into a
   new exported `migrate(db)` function.
2. Extend the migrations list with:
   ```js
   { table: 'actions', column: 'trigger_condition',
     sql: "ALTER TABLE actions ADD COLUMN trigger_condition TEXT" },
   { table: 'actions', column: 'trigger_last_checked',
     sql: "ALTER TABLE actions ADD COLUMN trigger_last_checked TEXT" },
   { table: 'projects', column: 'trigger_condition',
     sql: "ALTER TABLE projects ADD COLUMN trigger_condition TEXT" },
   { table: 'projects', column: 'trigger_last_checked',
     sql: "ALTER TABLE projects ADD COLUMN trigger_last_checked TEXT" },
   ```
3. `init()` calls `migrate()` as its last step (existing behavior
   preserved for new DBs).
4. Update schema file `templates/scripts/pib-db-schema.sql` to include
   the new columns in the canonical table definitions (so new DBs get
   them via `CREATE TABLE` without needing the migration path).

Propagate identical changes to `scripts/pib-db-lib.mjs` and
`scripts/pib-db-schema.sql` (dogfood copy — this repo IS a consumer).

**Action A2 — Call `migrate()` on every MCP startup and CLI invocation**

Modify `templates/scripts/pib-db-mcp-server.mjs` and
`scripts/pib-db-mcp-server.mjs`: in `getDb()`, after creating the db
handle, call `lib.migrate(db)` unconditionally. Remove the
auto-init-on-table-missing pattern from `handleToolCall` (replace with
`migrate(db)` which is safe to run on any DB state).

Modify `templates/scripts/pib-db.mjs` and `scripts/pib-db.mjs`
similarly: the CLI's db-open path runs `migrate()` once before
dispatching any subcommand.

### Phase 2: Library API for trigger operations

**Action A3 — Add `deferWithTrigger`, `listTriggered`, `markTriggerChecked` to pib-db-lib**

Modify `templates/scripts/pib-db-lib.mjs` (and mirror to
`scripts/pib-db-lib.mjs`). Add three exported functions:

```js
export function deferWithTrigger(db, { fid, triggerCondition }) {
  // Determines table from fid prefix ('act:' or 'prj:')
  // Sets status='deferred' (or 'someday' for projects — configurable)
  // Sets trigger_condition, clears trigger_last_checked
  // Returns { fid, triggerCondition, message }
}

export function listTriggered(db, { includeCompleted = false } = {}) {
  // Queries BOTH actions and projects WHERE trigger_condition IS NOT NULL
  // Excludes deleted and (by default) completed/done
  // Returns { actions: [...], projects: [...] }
  // Each row includes fid, text/name, trigger_condition,
  // trigger_last_checked, days_since_checked
}

export function markTriggerChecked(db, { fid, result }) {
  // Sets trigger_last_checked = today()
  // result is optional string ("still waiting", "triggered",
  // "condition-obsolete") stored as a comment in notes
  // Returns { fid, trigger_last_checked, result }
}
```

All three take `(db, params)` and return result objects per lib
convention. No console.log. Fid-prefix detection via
`fid.startsWith('prj:')` → projects table, else actions.

### Phase 3: MCP tool surface

**Action A4 — Add 3 MCP tools for trigger operations**

Modify `templates/scripts/pib-db-mcp-server.mjs` (and
`scripts/pib-db-mcp-server.mjs`): add three entries to the `TOOLS`
array and three dispatch cases in `handleToolCall`.

Tools:

- `pib_defer_with_trigger` — required: `fid`, `triggerCondition`
- `pib_list_triggered` — optional: `includeCompleted` (default false)
- `pib_mark_trigger_checked` — required: `fid`; optional: `result`

Descriptions must make it clear these are for deferred-trigger
tracking (not generic deferral — that stays `pib_update_action` with
`status='deferred'`).

### Phase 4: Orient phase for trigger evaluation

**Action A5 — Add `deferred-check.md` to orient skeleton**

Create `templates/skills/orient/phases/deferred-check.md` (and
mirror to `.claude/skills/orient/phases/deferred-check.md` for this
project's own orient).

Content: position after work-scan, before auto-maintenance.

Instructions:

1. Run `pib_list_triggered` (MCP) or `node scripts/pib-db.mjs
   list-triggered` (CLI fallback). Returns actions and projects with
   their trigger_condition and trigger_last_checked values.
2. If zero triggered items, skip silently.
3. For each item, present in briefing:
   ```
   ### Deferred (N items with triggers)
   - act:abc12345 — "Build AI infrastructure layer"
     **Trigger:** 3+ projects call Claude API OR spend > $20/mo
     **Last checked:** 2026-04-17 (0d ago)
   ```
4. Ask the model to evaluate each trigger against current session
   context (does anything in the current project state suggest the
   trigger has fired?). The model reports: "triggered — [reason]",
   "still waiting", or "needs-info".
5. For each item the model evaluated, call
   `pib_mark_trigger_checked` with the result string so `trigger_
   last_checked` updates. This prevents endless re-asking without
   at least logging that we asked.
6. If the model reports "triggered", flag in the briefing's
   **Attention Items** section: "Deferred item may be ready — review."
   User decides whether to reopen (manual — no auto-reopen).

**Action A6 — Update orient SKILL.md Phase Summary table**

Modify `templates/skills/orient/SKILL.md`: add a row to the phase
summary table for `deferred-check.md` with `Default: skip silently
if no triggered items`. Mirror to `.claude/skills/orient/SKILL.md`
through `cc-upgrade` propagation (not touched directly — upstream
change + cc-upgrade re-copies).

### Phase 5: Documentation propagation

**Action A7 — Propagate convention doc and briefing to templates**

1. Copy `.claude/cabinet/pib-db-triggers.md` (from A0) to
   `templates/cabinet/pib-db-triggers.md` so new installs get it.
2. Update `templates/cabinet/pib-db-access.md` — add a short section
   ("Deferred triggers") pointing to `pib-db-triggers.md`.
3. Update `templates/briefing/_briefing-work-tracking.md` if present;
   add paragraph about the trigger column and when to use
   `pib_defer_with_trigger` vs plain `status='deferred'`.

### Phase 6: Work-tracker UI

**Action A8 — Render trigger_condition in work-tracker UI**

Modify `scripts/work-tracker-ui.html` (and mirror to
`templates/scripts/work-tracker-ui.html`):

1. Action detail view (around line 716): render `trigger_condition`
   and `trigger_last_checked` beneath the status badge, in a boxed
   "Waiting for" block. If null, render nothing.
2. Project detail view (around line 526): same treatment for project
   rows with trigger_condition.
3. New filter chip in the filter bar: "Waiting (triggered)" — filters
   to `trigger_condition IS NOT NULL`.
4. Action detail — add "Mark trigger checked" button that POSTs to a
   new API endpoint.

**Action A9 — Add work-tracker server endpoints**

Modify `scripts/work-tracker-server.mjs` (and
`templates/scripts/work-tracker-server.mjs`):

1. `GET /api/triggered` — returns `listTriggered(db, {})` result.
2. `POST /api/action/:fid/trigger-checked` — body `{result?}`, calls
   `markTriggerChecked`.
3. Extend existing `GET /api/actions` and `GET /api/projects` responses
   to include `trigger_condition` and `trigger_last_checked` fields.

### Phase 7: CLI convenience commands

**Action A10 — Add CLI subcommands**

Modify `templates/scripts/pib-db.mjs` (and `scripts/pib-db.mjs`):

```
node scripts/pib-db.mjs defer-with-trigger <fid> --trigger "<text>"
node scripts/pib-db.mjs list-triggered [--include-completed]
node scripts/pib-db.mjs mark-trigger-checked <fid> [--result "<text>"]
```

Each maps 1:1 to the lib function of the same camelCase name.

### Phase 8: File the three big-swing feedback items

**Action A11 — File AI infrastructure proposal as `someday` project with trigger**

Using the new tooling (`pib_defer_with_trigger` after project creation):

1. Create project via `pib_create_project`: name="CC: AI/LLM
   infrastructure layer (parallel to pib-db)", notes = full body
   from `feedback/2026-04-17-proposal-cc-should-own-cross-project-
   ai-llm-infrastructure-p-16.md` + `## Surface Area` block listing
   all files the proposal touches.
2. `pib_defer_with_trigger` with project fid and trigger text:
   `"3+ CC projects routing LLM calls to Claude (Workers AI
   threshold); OR total Claude API spend across projects exceeds
   $20/mo; OR Cloudflare Pro account becomes active"`.

**Action A12 — File auth/sessions template as `someday` project with trigger**

1. Create project via `pib_create_project`: name="CC: user accounts
   + sessions template (opt-in)", notes = body from
   `feedback/2026-04-17-consider-packaging-a-user-accounts-sessions-
   template-opt-in-5.md` + `## Surface Area`.
2. `pib_defer_with_trigger` with trigger text:
   `"Second CC project begins building user accounts / auth. Explicit
   trigger signal: /onboard or /plan invoked in a new CC project
   where scope mentions auth, login, sessions, or user accounts."`.

**Action A13 — File Postgres-default scaffolding as action with trigger**

This is action-scale (a convention change to `/onboard` when
scaffolding).

1. Create action via `pib_create_action`: text="CC onboard: default
   new webapp scaffolds to Postgres, not SQLite", notes = body from
   `feedback/2026-04-17-default-project-scaffolding-should-start-with-
   postgres-not-s-18.md` + `## Surface Area`.
2. `pib_defer_with_trigger` with trigger text:
   `"Next /onboard invocation scaffolds a new webapp project (signal:
   user mentions FastAPI, Django, Flask, Next.js, Express, or similar
   web-framework scaffolding during onboard)."`.

## Surface Area

- files: scripts/pib-db-lib.mjs
- files: scripts/pib-db-schema.sql
- files: scripts/pib-db-mcp-server.mjs
- files: scripts/pib-db.mjs
- files: scripts/work-tracker-server.mjs
- files: scripts/work-tracker-ui.html
- files: templates/scripts/pib-db-lib.mjs
- files: templates/scripts/pib-db-schema.sql
- files: templates/scripts/pib-db-mcp-server.mjs
- files: templates/scripts/pib-db.mjs
- files: templates/scripts/work-tracker-server.mjs
- files: templates/scripts/work-tracker-ui.html
- files: templates/skills/orient/SKILL.md
- files: templates/skills/orient/phases/deferred-check.md (new)
- files: .claude/skills/orient/phases/deferred-check.md (new)
- files: .claude/cabinet/pib-db-triggers.md (new)
- files: templates/cabinet/pib-db-triggers.md (new)
- files: templates/cabinet/pib-db-access.md
- files: templates/briefing/_briefing-work-tracking.md

## Acceptance Criteria

### Schema and migration
- [auto] `sqlite3 pib.db "PRAGMA table_info(actions)"` shows columns
  `trigger_condition` and `trigger_last_checked` after running
  `node scripts/pib-db.mjs list-projects` once (migration side-effect).
- [auto] Same for `projects` table.
- [auto] Fresh-DB path: remove pib.db, run `node scripts/pib-db.mjs
  init` — both columns present on first inspection.
- [auto] Migration is idempotent: running pib-db operations twice
  doesn't error on "column already exists".
- [auto] Existing consumer DBs (Flow, article-rewriter) gain the
  columns on their next MCP startup. Verification:
  `ls ~/article-rewriter/pib.db` → open → check `PRAGMA table_info`.

### Library API
- [auto] `lib.deferWithTrigger(db, {fid: 'act:abc', triggerCondition: 'x'})`
  sets status='deferred' AND trigger_condition='x' AND
  trigger_last_checked=NULL. Verify via SELECT.
- [auto] `lib.listTriggered(db)` returns both actions and projects
  with non-null trigger_condition, excluding completed/deleted.
- [auto] `lib.markTriggerChecked(db, {fid, result: 'still waiting'})`
  sets trigger_last_checked to today's date.
- [auto] Fid-prefix dispatch: `prj:*` hits projects table, `act:*`
  hits actions table.

### MCP tools
- [auto] `mcp__pib-db__pib_list_triggered` appears in `tools/list`
  response. Test by running the MCP server and sending tools/list
  JSON-RPC.
- [manual] Each new MCP tool is callable end-to-end: create an
  action, defer-with-trigger, list-triggered (shows it),
  mark-trigger-checked (updates last_checked).
- [auto] `pib_defer_with_trigger` without trigger_condition returns
  an error result (not a silent no-op). Same for `fid` missing.

### Orient phase
- [manual] Run `/orient` in this repo (after filing the 3 big-swing
  items in Phase 8) — briefing includes "Deferred (3 items with
  triggers)" section listing each.
- [manual] Orient prompts model to evaluate each trigger against
  session context; model reports for each.
- [auto] After orient, `trigger_last_checked` on all 3 filed items
  shows today's date.
- [manual] If trigger condition clearly doesn't apply (e.g.,
  "3+ projects calling Claude API" — we only have 4 CC consumers,
  none routing LLM calls centrally), model reports "still waiting".

### UI
- [manual] Work-tracker UI shows a "Waiting for: <trigger>" block
  under the status badge for items with trigger_condition set.
- [manual] Filter chip "Waiting (triggered)" filters to those items.
- [manual] "Mark trigger checked" button updates trigger_last_checked
  and re-renders.

### Propagation to consumers
- [deferred] After CC publishes this version, running `cc-upgrade`
  in a consumer (Flow, article-rewriter, theater-cheater) copies the
  updated pib-db-lib.mjs + schema + MCP server + orient phase files.
  The consumer's next MCP startup runs the migration. Verify by
  checking a consumer's `PRAGMA table_info` after upgrade.
- [deferred] Flow's existing Ollama action (`act:9fb95b0f`) — its
  prose trigger in notes should be re-filed using
  `pib_defer_with_trigger` so it participates in the new mechanism.
  Not part of this plan (Flow-side work); documented as follow-up
  in the convention doc.

### Deviation safeguard (per feedback-12)
- [manual] If any action's implementation deviates from this plan
  (e.g., different column name chosen, different API shape),
  ALL downstream actions in this plan are reviewed and updated to
  reflect the actual state before marking the deviating action
  complete.

### Cabinet check
- [manual] Cabinet critique verdicts from plan phase are either
  all continue, or conditionals are addressed in the plan revision
  before any implementation action (A1+) starts.
