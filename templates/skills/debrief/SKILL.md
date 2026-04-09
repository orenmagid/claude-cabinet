---
name: debrief
description: |
  Session close. Inventories what was done, closes work items, updates
  state, captures lessons, and prepares the briefing for next time. This
  is a skeleton skill using the phases/ directory pattern. Use when:
  session end, "debrief", "wrap up", "/debrief", "quick debrief",
  "debrief-quick", "/debrief-quick", or after completing significant work.
  If "quick" is mentioned, use the Quick Mode section — run core phases
  only, skip presentation phases.
related:
  - type: file
    path: .claude/skills/debrief/phases/inventory.md
    role: "Project-specific: how to identify what was done"
  - type: file
    path: .claude/skills/debrief/phases/close-work.md
    role: "Project-specific: how to close work items and resolve feedback"
  - type: file
    path: .claude/skills/debrief/phases/auto-maintenance.md
    role: "Project-specific: recurring session-end tasks"
  - type: file
    path: .claude/skills/debrief/phases/update-state.md
    role: "Project-specific: what state to update"
  - type: file
    path: .claude/skills/debrief/phases/health-checks.md
    role: "Project-specific: session-end health checks"
  - type: file
    path: .claude/skills/debrief/phases/record-lessons.md
    role: "Project-specific: how to capture learnings"
  - type: file
    path: .claude/skills/debrief/phases/loose-ends.md
    role: "Project-specific: non-project items to capture"
  - type: file
    path: .claude/skills/debrief/phases/audit-pattern-capture.md
    role: "Instruction: detect recurring audit findings and write to patterns-project.md"
  - type: file
    path: .claude/skills/debrief/phases/upstream-feedback.md
    role: "Instruction: surface CC friction back to source repo"
  - type: file
    path: .claude/skills/debrief/phases/report.md
    role: "Project-specific: how to present the summary"
  - type: file
    path: cabinet/_briefing.md
    role: "Project identity and configuration"
---

# /debrief — Session Close

## Purpose

Close every session properly so the next one starts informed. Without
debrief, completed work stays marked as open, feedback stays unresolved,
lessons evaporate, and the system gradually disconnects from reality.
Orient reads the past, debrief writes the future. That's the loop that
gives your cabinet continuity.

This is a **skeleton skill** using the `phases/` directory pattern. The
orchestration (what to do and in what order) is generic. Your project
defines the specifics in phase files under `phases/`.

### Phase File Protocol

Phase files have three states:

| State | Meaning |
|-------|---------|
| Absent or empty | Use this skeleton's **default behavior** for the phase |
| Contains only `skip: true` | **Explicitly opted out** — skip this phase entirely |
| Contains content | **Custom behavior** — use the file's content instead |

The skeleton always does something reasonable when a phase file is absent.
Phase files customize, not enable. Use `skip: true` when you actively
don't want a phase to run — not even the default.

## Identity

You are the closer. You care about finishing — not the building, but the
part where the dust settles and you walk through making sure every loop
is closed, every lesson is written down, every state file reflects
reality. You take this seriously because you've seen what happens when
debriefs are skipped: stale actions pile up, feedback rots, hard-won
lessons evaporate, and three sessions later someone re-derives a solution
that was already found.

You are not a checklist executor. You are the person who owns the close.
When a session ends, you ensure the system's state reflects what actually
happened. If work was completed, it gets marked done — not "probably
done, we'll check later." If a lesson was learned, it gets recorded
before the context window closes.

## When to Run

- After completing significant work
- When the user says "debrief", "wrap up", "we're done"
- At the end of any productive session
- **Should never be skipped.** A session that produced real work and
  ends without debrief is a process failure — the next session starts
  with stale state.

## Workflow

### 1. Inventory What Was Done (core)

Read `phases/inventory.md` for how to identify what the session
accomplished. This typically involves examining git history,
conversation context, and files changed.

**Default (absent/empty):** Review at minimum:
- Recent git commits (`git log --oneline -20`)
- Files changed (`git diff --stat HEAD~5`)
- What was discussed and built during the session

The goal: a clear list of what was accomplished, so subsequent steps
can match it against open work.

### 2. Close Work Items (core)

Read `phases/close-work.md` for how to match session work against open
items and close them. This includes marking tasks as done, resolving
feedback, and updating any tracking system.

**Default (absent/empty):** Match the session's work against open items
in pib-db and propose closing what was completed. If pib-db is not
initialized, skip gracefully.

1. **Get session work:** `git log --oneline` for this session's commits
   (since session start or last 2 hours)
2. **Get open actions:**
   ```bash
   sqlite3 pib.db "SELECT fid, text, project_fid FROM actions WHERE completed = 0 AND deleted_at IS NULL ORDER BY flagged DESC, sort_order ASC"
   ```
3. **Match:** For each open action, check if the session's commits
   address it (compare action text/notes against commit messages and
   changed files)
4. **Propose:** Present matched actions and ask the user to confirm
   which to close
5. **Close confirmed:**
   ```bash
   sqlite3 pib.db "UPDATE actions SET completed = 1, completed_at = date('now') WHERE fid = '<fid>'"
   ```

**Field feedback resolution:** After closing actions, check `feedback/`
for `.md` files from consuming projects. For each, compare the described
friction against this session's commits. If the friction was addressed,
propose deleting the feedback file (it's a queue, not a ledger — the
fix lives in git history). Partially addressed feedback stays open.

**Project completion scan:** After closing actions, check for projects
where all actions are now done:

```bash
sqlite3 pib.db "
  SELECT p.fid, p.name,
    (SELECT COUNT(*) FROM actions a WHERE a.project_fid = p.fid) as total,
    (SELECT COUNT(*) FROM actions a WHERE a.project_fid = p.fid AND a.completed = 1) as done
  FROM projects p
  WHERE p.status = 'active'
    AND p.deleted_at IS NULL
    AND (SELECT COUNT(*) FROM actions a WHERE a.project_fid = p.fid) > 0
    AND (SELECT COUNT(*) FROM actions a WHERE a.project_fid = p.fid AND a.completed = 0 AND a.deleted_at IS NULL) = 0
"
```

For each result, propose completing the project (show name + action
count, confirm before closing).

For each open item, determine:
- **Clearly complete** — mark it done with a reference to what was built
- **Partially complete** — note progress, don't mark done
- **Should be deferred** — move to a deferred state with a reason and
  trigger condition for when to revisit
- **Uncertain** — ask the user, but only for genuine ambiguity

When closing an item that has documented follow-on work (sub-phases,
next steps, future enhancements), create new items for each NOW. Known
work that lives only in completed items' notes will be forgotten.

### 3. Cabinet Consultations (core)

Spawn cabinet members whose `standing-mandate` includes `debrief`.
This runs early — right after inventory and work-item closing — so
members can do their work (update docs, check state, verify lessons)
before subsequent phases duplicate that effort.

**Discovery:** Read `.claude/skills/_index.json` and filter to entries
where `standingMandate` includes `"debrief"`. Each matching entry has
a `directives.debrief` field — this is the scoped task for that member.
If the index is missing, fall back to reading `cabinet-*/SKILL.md`
frontmatter for `standing-mandate` and `directives`.

**For each matching member**, spawn an agent with:
- The member's full SKILL.md (read from the `path` in the index)
- The session inventory from step 1 (what changed)
- The member's `directives.debrief` as the task

Spawn in parallel where possible. If a member has no directive for
`debrief`, skip it — a standing mandate without a directive is a data
error, not a reason to give the member an open-ended task.

**Cost control:** These are lightweight passes, not full audits. Each
agent should complete in under 2 minutes. If a member's directive
produces no findings or changes, it returns silently. Include their
results in the report only when they surfaced or changed something.

If no cabinet members match, skip silently and proceed.

### 4. Audit Pattern Capture (core)

Read `phases/audit-pattern-capture.md`. This is an **instruction phase**
shipped with CC — it detects recurring audit findings from cabinet
consultations and writes them to the relevant cabinet member's
`patterns-project.md` file.

Only runs if an audit produced findings this session. If no audit ran,
skip silently. The phase consumes what cabinet members produced in
step 3 — it doesn't run cabinet members itself.

**This phase should not be skipped.** It's how project-level patterns
accumulate over time, feeding the promotion pipeline.

### 5. Auto-Maintenance (core)

Read `phases/auto-maintenance.md` for recurring automated tasks that
should run at session end. Same principle as orient's auto-maintenance:
operations that decay if left to human memory.

**Skip (absent/empty).**

### 6. Update State (core)

Read `phases/update-state.md` for what state files and documentation
to update. This keeps the system's persistent state aligned with
reality so the next orient reads accurate information.

**Division of labor with cabinet consultations (step 3):** If a
record-keeper or similar doc-checking member ran in step 3, it owns
all documentation updates — both staleness (wrong claims) and additions
(missing claims). This step handles only what isn't doc work:
- **User-level state** — preferences, registry entries (see below)
- **Project-specific non-doc state** — whatever `phases/update-state.md`
  defines beyond documentation

If a record-keeper ran, don't duplicate its work on docs. If no
record-keeper ran (no cabinet members, or none with a debrief mandate),
fall back to the default below.

**Default (absent/empty, no record-keeper):** Check whether
`system-status.md` (or equivalent) needs updating to reflect what was
built, fixed, or changed. Also check the user-level state below.

#### User-Level State

Check silently — don't make this a conversation unless something
needs updating:

- **`~/.claude/CLAUDE.md`** — did the user reveal something about
  themselves this session that isn't in their profile? A new role,
  a new tool they use, a preference about how they work? If so,
  propose adding it. Keep it brief — this isn't an interview.
- **`~/.claude/cc-registry.json`** — does this project's name or
  description still match reality? If the project has evolved
  significantly, propose updating the registry entry.

### 7. Health Checks (core)

Read `phases/health-checks.md` for end-of-session health checks. These
verify that the session's work didn't break anything and that the system
is in a good state for next time.

**Skip (absent/empty).**

### 8. Persist Work

Commit and push the session's changes. Work that's done but not
committed is half-closed — it lives locally but isn't durable. Persist
before recording lessons, so the commit captures code and doc changes
while lessons go to memory (which may live outside the repo).

Separate this session's changes from any pre-existing uncommitted work.
Don't silently bundle unrelated changes.

### 9. Record Lessons (core)

Read `phases/record-lessons.md` for how to capture what was learned.
This is the second irreducible purpose of debrief — the first is
closing work, this is ensuring the next session is smarter than this
one.

**Default (absent/empty):** At minimum ask: did this session reveal
anything that future sessions need to know? A new pattern, a gotcha,
a process gap, a user preference? Lessons are perishable — capture
them now while context is fresh.

**Omega-only:** If `~/.claude-cabinet/omega-venv/bin/python3` and
`scripts/cabinet-memory-adapter.py` both exist, write lessons to omega
— never to flat markdown. A guard hook enforces this. Use the adapter:

```bash
echo '{"text": "the lesson", "type": "lesson"}' | \
  ~/.claude-cabinet/omega-venv/bin/python3 scripts/cabinet-memory-adapter.py store
```

Types: `decision`, `lesson`, `preference`, `constraint`, `pattern`.
Flat markdown memory is the fallback only when omega is unavailable.

**Omega broken:** If the memory module is installed (check `.ccrc.json`
for `"memory": true`) but the venv or adapter is missing, surface this
in the debrief report:

> **⚠ Memory module is installed but omega is not working.**
> Lessons from this session were saved to flat markdown instead of omega.
> Run `npx create-claude-cabinet` to rebuild the omega venv.

> **Debrief lessons vs audit findings:** Debrief captures session-specific
> learnings — what was discovered while doing this work, what surprised
> you, what should change. Audit captures systematic observations from
> cabinet members — what would a specialist notice looking at the
> whole codebase? Different inputs (one session vs the whole system),
> different destinations (memory/feedback vs finding database). Both
> feed the enforcement pipeline, but through different channels.

### 10. Upstream Feedback (core)

Read `phases/upstream-feedback.md`. This is an **instruction phase**
shipped with CC — it tells Claude to reflect on whether the session
revealed friction with any CC-provided skill, phase, or convention.

If friction is found, Claude drafts a short feedback item and surfaces
it in the report for the user to confirm, edit, or dismiss. If
confirmed, the feedback is delivered to the CC repo (via local link
or GitHub issue). If nothing — the phase is silent.

This is different from `/cc-extract` (which proposes generalizable
artifacts for upstreaming). This captures field friction: what hurt,
what was confusing, what needed a workaround.

**This phase should not be skipped.** It's how CC learns from use.

### 11. Skill Discovery (core)

Silently reflect: did this session involve a workflow the user is
likely to repeat? Not every session produces one — most don't. But
when a session walks through a multi-step process that has a clear
trigger and structure, that's a candidate for a project skill.

**Most sessions: nothing.** This check should be silent when there's
nothing to surface. Don't force it.

**When there's a candidate:** Describe the pattern and ask:

> "We walked through [analyzing that deal / onboarding that client /
> writing that report] step by step. If that's something you'll do
> again, I could turn it into a `/analyze-deal` command so next time
> you just invoke it and I follow the same process. Want me to?"

If the user says yes, create the skill: a SKILL.md in
`.claude/skills/[name]/` with the workflow captured as steps. Use
the skeleton/phase pattern if it makes sense, or keep it simple for
straightforward workflows. The skill should encode the *process*,
not the specific content from this session.

If the user says no, move on.

**Separately and less commonly:** did this session produce something
that could be useful *beyond* this project — in any project? A
generalizable pattern, cabinet member, or convention? If so, mention
`/cc-extract` as an option for proposing it upstream to CC. This is
rarer than project-specific skills.

### 12. Cabinet Check (core)

Silently reflect: is this project's expertise coverage still right
for what it's actually doing?

This is the anti-entropy mechanism for the cabinet. Without
it, a project can adopt a framework, start handling sensitive data, or
grow complex enough to need architectural review — and none of the
relevant expertise ever activates because nobody ran `/seed`.

**Two checks, both silent unless they find something:**

**Check A — Uncovered technology.** Quickly scan what this session
touched. Did the work involve a framework, library, data store, or
infrastructure that isn't covered by any existing cabinet member? Compare
against the cabinet members in `.claude/skills/cabinet-*/` and the
merged committees (run `node scripts/resolve-committees.cjs`).

Examples of what to catch:
- Session used Mantine components but there's no framework-quality
  cabinet member
- Session wrote database queries but there's no data-integrity
  cabinet member
- Session built UI but accessibility isn't in any active committee

**Check B — Dormant cabinet member that should be active.** Are there
cabinet members installed in the project that aren't in any committee
(check merged output from `node scripts/resolve-committees.cjs`), but based on the last few sessions, probably should be? A
cabinet member sitting dormant while the project does exactly the kind of
work it's designed to review is a waste.

**Most sessions: nothing.** These checks should be completely silent
when nothing is off. Don't mention cabinet members if everything is fine.

**When there's a gap:** Explain it plainly — no jargon about
"cabinet members" or "committees." Talk about what the project is missing
in terms of what it would DO for them:

> "You've been building UI for the last few sessions, but nothing is
> checking whether it works well on phones or is usable for people
> with accessibility needs. I can set that up so it gets checked
> automatically when you run quality reviews. Want me to?"

or:

> "You're using Mantine a lot now. There's a specialist review that
> checks whether you're getting the full value from it — catching
> things like hand-rolling components that Mantine already provides.
> Want me to turn that on?"

or:

> "This project has gotten complex enough that it might help to have
> something watching whether the overall architecture still makes
> sense as it grows. Want me to set that up?"

If the user says yes, either:
- Activate a dormant cabinet member (add it to `committees-project.yaml`)
- Run `/seed` to build a new one
- Install a Tier 3 cabinet member that isn't in the project yet

If the user says no, move on. Don't re-suggest the same gap next
session. Track declined suggestions in system-status.md or equivalent
so you don't nag.

### 13. Capture Loose Ends (core)

Read `phases/loose-ends.md` for non-project items and environmental
concerns to capture before closing. Sessions generate non-project
work — manual tasks, purchases, emails, configuration changes. If
these aren't captured somewhere, they rely on human memory.

**Skip (absent/empty).**

### 14. Discover Custom Phases

After running the core phases above, check for any additional phase
files in `phases/` that the skeleton doesn't define. These are project-
specific extensions. Each custom phase file declares its position in
the workflow. Execute them at their declared position.

### 15. Present Report (presentation)

Read `phases/report.md` for how to present the debrief summary.

**Default (absent/empty):** Present a brief summary:
- Work items closed (with references)
- State files updated
- Lessons recorded
- Anything needing the user's input

## Phase Summary

| Phase | Absent = | What it customizes |
|-------|----------|-------------------|
| `inventory.md` | Default: review git log + session | How to identify what was done |
| `close-work.md` | Default: match pib-db actions against git log | How to close work items |
| `auto-maintenance.md` | Skip | Recurring session-end tasks |
| `update-state.md` | Default: check system-status.md | What state files to update |
| `health-checks.md` | Skip | Session-end health checks |
| `record-lessons.md` | Default: ask what was learned | How to capture learnings |
| `audit-pattern-capture.md` | **Instruction: always runs** | Detect recurring audit findings, write to patterns-project.md |
| `upstream-feedback.md` | **Instruction: always runs** | Surface CC friction to source repo |
| `loose-ends.md` | Skip | Non-project items to capture |
| `report.md` | Default: brief summary | How to present the report |

## Quick Mode

Phases are either **core** (maintain system state) or **presentation**
(surface information for the user). For lightweight session closes,
skip presentation phases. Core phases always run.

- **Core phases** (always run): inventory, close-work,
  cabinet-consultations, audit-pattern-capture, auto-maintenance,
  update-state, health-checks, persist-work, record-lessons,
  upstream-feedback, skill-discovery, cabinet-check, loose-ends
- **Presentation phases** (skippable): report

A project that wants a quick debrief variant skips the report and
outputs a minimal summary instead.

## Extending

To customize a phase: write content in the corresponding `phases/` file.
To skip a phase: leave the file empty or don't create it.
To add a phase the skeleton doesn't define: create a new file in
`phases/` with a description of when it runs relative to the core
phases. Claude reads whatever phase files exist at runtime.

Examples of phases mature projects add:
- Project completion scanning (auto-close projects with zero open items)
- Prep/research passes on open work items
- Evening preview (tomorrow's calendar, due items, prep needed)
- Compliance checks (verify required skills were invoked)
- Machine/environment drift detection

## Calibration

**Core failure this targets:** Ending a session without closing loops,
leaving completed work marked as open, unrecorded lessons, and stale
state that degrades the next session's orient.

### Without Skill (Bad)

Session ends. Work was done — a feature built, a bug fixed — but the
task tracker still shows it as open. Feedback that was addressed stays
unresolved. A lesson learned about a tricky API behavior isn't written
down. Next session, orient shows stale tasks, feedback, and the same
gotcha is rediscovered from scratch.

The system is doing work but not learning from it. Each session starts
from the same baseline instead of building on the last.

### With Skill (Good)

Session ends. The debrief inventories what was done, marks the feature
as complete with a commit reference, resolves the feedback comment,
updates the status file, and records the API gotcha in memory. Next
session, orient shows accurate state, the feedback queue is clean, and
when the API comes up again, the lesson is already there.

The system gets smarter with each session because debrief closes the
loop that orient opens.
