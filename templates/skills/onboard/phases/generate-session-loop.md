# Generate Session Loop — Wire Orient and Debrief Phase Files

Create or refine the phase files that make the session loop functional
for this specific project. The session loop is the mandatory minimum —
orient reads state, debrief writes state, and the project gets smarter
with each session.

When this file is absent or empty, the default behavior is: create the
minimal set of phase files that diverge from skeleton defaults, based
on what the interview revealed. To explicitly skip session loop wiring,
write only `skip: true`.

## First-Run Wiring

The skeleton defaults handle many cases. Only create phase files where
this project needs something different from the default.

### Always Create

**`orient/phases/context.md`** — Point at the briefing files generated in
the previous phase. At minimum:
- Read `_briefing.md` for project identity and configuration
- Read `system-status.md` for current state
- Read `CLAUDE.md` if it has project-specific instructions beyond what
  Claude Code auto-loads

### Create If Interview Revealed

**`orient/phases/data-sync.md`** — If the project has a remote canonical
data store (database on a server, shared file storage, external API that
needs fresh pulls). Include the specific sync commands.

**`orient/phases/work-scan.md`** — If the project uses a specific work
tracking system that differs from pib-db defaults (e.g., GitHub Issues,
Linear, a custom backlog file). If they're using pib-db, the default
work-scan behavior already handles it — don't create a redundant file.

**`orient/phases/health-checks.md`** — If the interview surfaced specific
failure modes worth detecting at session start (stale deploys, broken
connections, configuration drift).

**`debrief/phases/close-work.md`** — If work items need to be closed in
a specific system (API calls, issue tracker commands). If using pib-db,
the default handles it.

**`debrief/phases/update-state.md`** — If state lives somewhere specific
that the default (check system-status.md) wouldn't find.

### Never Create Redundantly

Don't create a phase file that restates the skeleton's default behavior.
If the default is correct, leave the file absent. Phase files exist to
customize, not to document that the default is fine.

Compare what the skeleton says it does by default (in the orient and
debrief SKILL.md files) with what this project needs. Only write a phase
file where they diverge.

## Re-Run Refinements

In re-run mode, the session loop is already wired. Examine existing
phase files in the context of what the interview revealed:

- **Missing coverage:** User said "orient never mentions X" — does a
  phase file need to be created or updated to scan for X?
- **Noisy phases:** User said "the health check for Y fires every session
  but it's never a real problem" — should that check be removed or have
  its threshold adjusted?
- **Stale wiring:** Phase files reference paths or commands that have
  changed since initial onboard. Update them.
- **Default promotion:** A project that's been using the default work-scan
  may have outgrown it. If the interview suggests the default isn't enough,
  create a custom phase file.

Present proposed changes as diffs against current content. Let the user
approve before modifying existing phase files.

## Structural Principles

- **Minimal divergence.** The fewer custom phase files, the less
  maintenance burden. Defaults exist for a reason.
- **Specific commands.** Phase files should contain the exact commands,
  queries, or file paths — not descriptions of what to do. "Run
  `sqlite3 app.db 'SELECT ...'`" not "Check the database for stale items."
- **Fail gracefully.** Every phase file should handle the case where its
  target doesn't exist yet (DB not initialized, file not created, service
  not running). Surface the gap, don't crash.
