---
name: spring-clean
description: |
  Work-tracker backlog hygiene. Diagnoses cruft (stale projects, duplicates,
  orphaned actions, mega-projects, naming issues), runs organized-mind
  assessment for cognitive load, then walks you through interactive triage
  with immediate pib-db mutations. Use when: backlog feels unwieldy,
  "spring clean", "/spring-clean", or orient heuristic suggests it.
related:
  - type: file
    path: .claude/skills/spring-clean/phases/analysis-scope.md
    role: "Project-specific heuristics for what to analyze and what to skip"
  - type: file
    path: .claude/skills/spring-clean/phases/verification-rules.md
    role: "How to verify items against codebase state"
  - type: file
    path: .claude/skills/spring-clean/phases/triage-presentation.md
    role: "How to present recommendations (inline default, UI optional)"
  - type: file
    path: .claude/skills/spring-clean/phases/execute-decisions.md
    role: "How to apply approved mutations to pib-db"
  - type: file
    path: cabinet/_briefing.md
    role: "Project identity and configuration"
argument-hint: "focus — e.g., 'stale', 'reorg', 'all'"
user-invocable: true
---

# /spring-clean — Work-Tracker Backlog Hygiene

## Arguments

If `$ARGUMENTS` is provided:
- **Empty** or **'all'**: Full analysis — stale, duplicates, orphans,
  mega-projects, naming, cognitive load.
- **'stale'**: Focus on stale projects and completion candidates only.
- **'reorg'**: Focus on structural issues — mega-projects, reparenting,
  missing functional groups, cognitive load.

## Purpose

Work-tracking backlogs accumulate cruft that orient detects symptomatically
("N projects stale") but can't resolve. Resolving it today requires an
improvised 30-minute session. This skill encodes the pattern: autonomous
diagnosis, then interactive cure.

**Boundary:** orient surfaces signals. Pulse checks descriptions.
Spring-clean resolves structural problems in the work tracker itself.

| Skill | Question it asks |
|-------|-----------------|
| Orient | What needs attention today? |
| Pulse | Do the descriptions match reality? |
| Spring-clean | Is the backlog itself well-structured? |

This is a **skeleton skill** using the `phases/` directory pattern.

### Phase File Protocol

Phase files have three states:

| State | Meaning |
|-------|---------|
| Absent or empty | Use this skeleton's **default behavior** for the phase |
| Contains only `skip: true` | **Explicitly opted out** — skip this phase entirely |
| Contains content | **Custom behavior** — use the file's content instead |

## Preflight

Verify `pib.db` exists (check for `scripts/pib-db.mjs` or pib_* MCP
tools). If not: "No work tracker found — /spring-clean requires pib-db."

## Workflow

### 1. Inventory & Analysis (autonomous)

Spawn a single agent to pull the full pib-db picture and analyze it.
The agent uses pib_query (MCP) or `node scripts/pib-db.mjs query` to
run the following queries:

**Active projects with open/completed counts and last activity:**
```sql
SELECT p.fid, p.name, p.status, p.created,
  (SELECT COUNT(*) FROM actions a WHERE a.project_fid = p.fid AND a.completed = 0 AND a.deleted_at IS NULL) as open_count,
  (SELECT COUNT(*) FROM actions a WHERE a.project_fid = p.fid AND a.completed = 1) as done_count,
  (SELECT MAX(a.completed_at) FROM actions a WHERE a.project_fid = p.fid AND a.completed = 1) as last_completion,
  (SELECT MAX(a.created) FROM actions a WHERE a.project_fid = p.fid AND a.deleted_at IS NULL) as last_action_created
FROM projects p
WHERE p.deleted_at IS NULL
ORDER BY p.status, open_count DESC
```

**All open actions with project context:**
```sql
SELECT a.fid, a.text, a.status, a.created, a.project_fid, a.trigger_condition,
  p.name as project_name, p.status as project_status
FROM actions a
LEFT JOIN projects p ON a.project_fid = p.fid
WHERE a.completed = 0 AND a.deleted_at IS NULL
ORDER BY p.name, a.sort_order
```

From this data, the agent produces structured analysis:

```json
{
  "stale": [{"fid": "...", "name": "...", "daysSinceActivity": 0, "openCount": 0}],
  "duplicates": [{"fid1": "...", "fid2": "...", "matchReason": "..."}],
  "orphans": [{"fid": "...", "text": "...", "parentStatus": "..."}],
  "completionCandidates": [{"fid": "...", "name": "..."}],
  "megaProjects": [{"fid": "...", "name": "...", "openCount": 0}],
  "dataInconsistencies": [{"fid": "...", "issue": "..."}],
  "namingIssues": [{"fid": "...", "currentName": "...", "concern": "..."}],
  "statusDistribution": {"active": 0, "someday": 0, "dropped": 0},
  "totalOpen": 0,
  "totalProjects": 0
}
```

Heuristics:
- **Stale:** active project with no completion in 14+ days and open actions
- **Completion candidate:** active project with 0 open actions
- **Orphan:** action whose project is dropped/completed/deleted
- **Mega-project:** 10+ open actions
- **Duplicate:** two actions in the same project with >70% text overlap
  (Levenshtein or shared significant words)
- **Data inconsistency:** project marked active but all actions completed;
  action marked open but project is dropped
- **Naming issue:** project name references a version that's now shipped,
  or name is ambiguous/too generic

Read `phases/analysis-scope.md` for project-specific heuristic overrides.

Read `phases/verification-rules.md` for how to verify items against
codebase state (e.g., check if a planned feature was actually built).

### 2. Organized-Mind Assessment (autonomous, sequential after step 1)

Spawn the organized-mind cabinet member with the structured output from
step 1. The organized-mind agent evaluates:

- **Cognitive load:** How many active projects vs the ~4-item working
  memory limit? Is the operator context-switching between too many
  concurrent efforts?
- **Mixed-mode projects:** Any project that mixes "build this now"
  actions with "research this someday" items? Candidates for split.
- **Functional grouping:** Are related actions scattered across
  projects that should be consolidated? Are there implicit categories
  that deserve their own project?
- **Categorization quality:** Do project names map to cognitive modes
  (what brain you're in), or are they organized by type/urgency?

Returns structured recommendations alongside the inventory analysis.

### 3. Synthesis

Merge inventory analysis + organized-mind assessment into categorized
recommendations. Seven categories (locked — no ad-hoc categories):

| Category | Meaning | Typical action |
|----------|---------|---------------|
| **close** | Verified done or data inconsistency | `pib_complete_action` or update project status |
| **archive** | Not done but abandoned/superseded | Move to `someday` or `dropped` |
| **merge** | Two items covering same ground | Delete one, update the other's notes |
| **split** | Mega-project mixing cognitive modes | Create new project, reparent actions |
| **reparent** | Action belongs in a different project | Update action's `project_fid` |
| **create-project** | Missing functional group identified | `pib_create_project`, then reparent |
| **flag** | Worth attention but no immediate action | Surface in briefing, no mutation |

**Rename** is a sub-recommendation on other categories (e.g., "close
project X — also rename to reflect shipped version"), not a standalone
category.

Each recommendation includes: fid(s), category, rationale, proposed
mutation (the exact MCP call or CLI command).

### 4. Interactive Triage

Present recommendations in **decision-cost ascending** order:

1. **Structural summary** — total counts, high-level picture. No
   decisions required. Just orientation.
2. **No-brainers** — closes, archives. Low decision cost, quick wins.
   Batch by category.
3. **Structural moves** — merges, splits, reparents, create-project.
   Higher cost, may need follow-up. Present individually.
4. **Flags** — advisory. No action unless the user wants to act.

For each recommendation, present:
- What it is and why
- The proposed mutation
- Three options: **approve** (apply now), **defer** (persist for next
  spring-clean), **reject** (dismiss permanently)

**Defer affordance:** Deferred items are NOT lost. Append a note to
the action/project: `[spring-clean deferred: <rationale>]`. The next
spring-clean run surfaces them again with the prior rationale.

Apply approved changes immediately via pib_* MCP tools (or CLI
fallback). Read `phases/execute-decisions.md` for project-specific
mutation rules.

Read `phases/triage-presentation.md` for presentation customization
(inline conversation is the default; review UI is optional).

### 5. Summary

After all recommendations are triaged, report:
- Changes made (N closed, N archived, N merged, N reparented, ...)
- Deferred items (N items deferred for next run)
- Updated landscape (active project count, total open actions)

## Phase Summary

| Phase | Absent = | What it customizes |
|-------|----------|-------------------|
| `analysis-scope.md` | Default: standard heuristics | Project-specific thresholds and exclusions |
| `verification-rules.md` | Default: skip codebase verification | How to verify items against code |
| `triage-presentation.md` | Default: inline conversation | Presentation format (inline vs review UI) |
| `execute-decisions.md` | Default: direct pib_* MCP calls | Mutation rules and safeguards |

## Principles

- **Autonomous diagnosis, interactive cure.** The analysis is fully
  automated. The triage is fully human-driven. No auto-mutations.
- **Decision-cost ordering.** Easy wins first. The user builds momentum
  on no-brainer closes before facing structural reorganization.
- **Defer is not dismiss.** Ambiguous items persist. Spring-clean is
  re-runnable — deferred items surface again with prior context.
- **Seven locked categories.** No ad-hoc categories. If something
  doesn't fit, it's a flag. This prevents category sprawl across runs.
- **Organized-mind always runs.** Even on a small backlog, the
  cognitive-load assessment is valuable — it catches structural issues
  that raw staleness detection misses.

## Calibration

**Core failure this targets:** Backlogs that grow monotonically because
nothing resolves structural cruft. Orient says "N stale projects" every
session. The user mentally notes it and moves on. After 3 months, the
backlog is 40% cruft and the signal-to-noise ratio makes work-scanning
useless.

### Without Skill (Bad)

Orient reports 3 stale projects and 2 completion candidates. The user
says "I should clean that up sometime." They don't. Next session, orient
reports 4 stale and 2 candidates. The backlog grows. After 8 weeks,
there are 15 active projects, half of which are actually done, abandoned,
or duplicative. The work tracker is noise.

### With Skill (Good)

Orient fires the heuristic: "Backlog may benefit from /spring-clean (3
stale, 12+ open actions in 2 projects)." The user runs it. In 10
minutes: 2 projects closed (verified done), 1 archived (superseded by
a newer approach), 3 actions reparented to the right project, 1
mega-project split into two focused tracks. Organized-mind notes that
active project count dropped from 8 to 5 — within working memory.
Deferred: 1 ambiguous item that'll surface next run with context.
