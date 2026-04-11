# Platform Feature Adoption — Leverage Claude Code's Native Capabilities

## Problem

Claude Cabinet uses ~40% of available Claude Code platform features. Six
workstreams would make CC more reliable, more resilient to context loss,
and easier to maintain — without requiring the full plugin conversion
(which remains a separate project in `prj:plugin-format`).

Current pain points:
- **No argument passing**: `/audit security` doesn't work. Users must wait
  for the committee selection menu, then pick. Same for `/plan` — critics
  default from convening criteria rather than explicit selection.
- **Context loss on compaction**: When context compacts mid-session, Claude
  loses what it was doing. No recovery mechanism exists. The empty
  SessionStart/PostCompact hooks in settings.json are unused.
- **Audit members share context**: All cabinet member agents run in the
  parent context. A member that reads 50 files pollutes the context for
  subsequent members. No isolation.
- **pib-db accessed via CLI shelling**: Every pib-db operation spawns
  `node scripts/pib-db.mjs` via Bash. This is the process backbone —
  audit findings, triage, work tracking, plan filing all flow through it.
  Structured MCP tools would be more reliable than CLI stdout parsing.
- **No presentation layer**: All output is raw markdown. Claude Code
  supports output styles that could give CC a consistent voice.

## Cabinet Critique Summary

Five critics reviewed the initial draft. All returned **CONDITIONAL**.
Key revisions incorporated:

1. **Shared argument resolution** (architecture, process-therapist,
   workflow-cop): Created `scripts/resolve-arguments.cjs` so
   member/committee matching logic is defined once, not copy-pasted
   across 7 skill files.
2. **Generic PreCompact convention** (architecture BLOCK, process-therapist):
   Removed skill-name enumeration from the hook prompt. Uses generic
   `<workflow>-partial.md` convention instead.
3. **context:fork verification gate** (anthropic-insider): Added
   verification step — if `context: fork` isn't a real directive, the
   existing Agent tool already isolates. WS4 proceeds only after
   confirming platform support.
4. **pib-db MCP stays** (overruled goal-alignment): pib-db is process
   infrastructure (audit, triage, planning, work tracking), not developer
   convenience. MCP server proceeds as WS5.
5. **Confirmation on ambiguous resolution** (workflow-cop): When argument
   parsing falls through to topic scope (no member/committee match),
   confirm with user before launching. Direct matches proceed without
   confirmation.
6. **Settings.json merge** (workflow-cop): Explicitly relies on existing
   merge-by-event-type logic in lib/cli.js installer.

## Implementation

### Workstream 1: $ARGUMENTS on Key Skills + Shared Resolution Script

Add `argument-hint` frontmatter and `$ARGUMENTS` support to 7 skills.
Extract the member/committee resolution logic into a shared script.

**1.0 — Create shared resolution script**

File: `scripts/resolve-arguments.cjs`

Takes raw argument string + committees.yaml path, returns structured
resolution:

```javascript
// Usage: node scripts/resolve-arguments.cjs "security, architecture"
// Input: comma-separated tokens
// Output: JSON { members: [...], topics: [...], source: "arguments" }
//
// Resolution order per token:
//   1. Match cabinet member name (strip cabinet- prefix) → add to members
//   2. Match committee key in committees.yaml → expand to members
//   3. No match → add to topics
//
// Also outputs a human-readable summary for confirmation echo.
```

This script is analogous to the existing `resolve-committees.cjs`. Skills
call it instead of implementing matching logic inline.

**1.1 — audit/SKILL.md**

Add to frontmatter:
```yaml
argument-hint: "member, committee, or topic — e.g., 'security', 'health', 'hooks'"
```

Add parsing section after Purpose:
```markdown
## Argument Parsing

If `$ARGUMENTS` is provided, resolve scope:

1. Run `node scripts/resolve-arguments.cjs "$ARGUMENTS"` to get the
   resolved member list and any topic scopes.
2. **If resolution is all direct matches** (members and/or committees):
   Echo "Audit scope: [resolved list]" and proceed.
3. **If resolution fell through to topic scope** (no member/committee
   matched a token): **Confirm with user** before launching:
   "No member or committee named '<token>'. Run full audit scoped to
   topic '<token>'? (y/n)"
   This catches typos and misremembered member names.
4. If resolution returned members → run only those members.
   If resolution returned topics → run all members, topic-scoped.
   If resolution returned both → run named members, scoped to topic.

If `$ARGUMENTS` is empty, use default behavior (full cabinet or
committee selection per member-selection phase).

Cross-portfolio members (anti-confirmation, qa, debugger, organized-mind)
always run UNLESS $ARGUMENTS explicitly names specific members — in that
case, ONLY the named members run (the user chose precisely).
```

Examples:
- `/audit security` → "Audit scope: security" → solo + cross-portfolio
- `/audit health` → "Audit scope: health committee (security, data-integrity, speed-freak)" → committee + cross-portfolio
- `/audit security, architecture` → "Audit scope: security, architecture" → those two + cross-portfolio
- `/audit hooks` → "Audit scope: all members, topic: hooks" → full cabinet, topic-scoped
- `/audit health, architecture` → "Audit scope: health committee + architecture" → committee + member + cross-portfolio

**1.2 — plan/SKILL.md**

Add to frontmatter:
```yaml
argument-hint: "what to plan — e.g., 'refactor the hook system --critics architecture, process'"
```

Add parsing section:
```markdown
## Argument Parsing

`$ARGUMENTS` is the planning topic, with an optional `--critics` flag.

1. Split on `--critics` (if present):
   - Everything before → **planning topic**
   - Everything after → **critic list**
2. If `--critics` present, run `node scripts/resolve-arguments.cjs`
   on the critic list to resolve members/committees.
   **Echo:** "Planning: <topic> | Critics: <resolved list>"
3. If `--critics` absent, full `$ARGUMENTS` is the topic. Critics
   come from default behavior (convening criteria match).

If `$ARGUMENTS` is empty, ask the user what to plan (current behavior).
```

Examples:
- `/plan refactor the hook system` → default critics
- `/plan refactor hooks --critics architecture, process` → architecture + process committee
- `/plan --critics code` → asks what to plan, Code Quality committee critiques

**1.3 — cabinet/SKILL.md**

Add to frontmatter:
```yaml
argument-hint: "member name — e.g., 'architect', 'security'"
```

If `$ARGUMENTS` matches a cabinet member name, invoke directly (skip
roster). Already works informally — this makes it official with hint text.

**1.4 — investigate/SKILL.md**

Add to frontmatter:
```yaml
argument-hint: "what to investigate — e.g., 'why orient fails on fresh installs'"
```

`$ARGUMENTS` becomes the investigation question. If empty, ask.

**1.5 — execute/SKILL.md**

Add to frontmatter:
```yaml
argument-hint: "plan reference — e.g., 'act:abc123' or plan title"
```

`$ARGUMENTS` identifies which plan to execute. Match against pib-db
action fids or text. If empty, ask.

**1.6 — orient/SKILL.md**

Add to frontmatter:
```yaml
argument-hint: "mode — e.g., 'quick'"
```

`$ARGUMENTS` replaces keyword detection. `quick` triggers quick mode.
Empty triggers full orient (current behavior preserved).

**1.7 — debrief/SKILL.md**

Add to frontmatter:
```yaml
argument-hint: "mode — e.g., 'quick'"
```

Same as orient.

**Files created:**
- scripts/resolve-arguments.cjs (new)

**Files modified:**
- templates/skills/audit/SKILL.md
- templates/skills/plan/SKILL.md
- templates/skills/cabinet/SKILL.md
- templates/skills/investigate/SKILL.md
- templates/skills/execute/SKILL.md
- templates/skills/orient/SKILL.md
- templates/skills/debrief/SKILL.md
- lib/cli.js — `generateSkillIndex()` parses `argument-hint` for _index.json

---

### Workstream 2: PreCompact Prompt Hook

New prompt hook on PreCompact. Claude writes a handoff note before
context compaction destroys conversation history.

**2.1 — Create hook template**

File: `templates/hooks/compaction-save.md`

Content (the prompt text):
```
Context is about to be compacted. Persist your current working state
so you can resume after compaction without re-orienting.

1. ALWAYS write `.claude/compaction-state.md` with these sections:

   ## Current Task
   What you're working on and what step you're on.

   ## Decisions
   Key decisions made but not yet implemented.

   ## Next
   What the user expects next.

   ## References
   File paths, action fids, member names, and specifics.

2. IF you have intermediate work products that would be lost, persist
   them to `.claude/<current-workflow>-partial.md` — for example, if
   you're mid-audit, write to `.claude/audit-partial.md`. Include
   enough detail to avoid re-doing completed work (findings so far,
   which members finished, what remains).

3. Be concrete. These files are for yourself after compaction.
   Overwrite previous versions. Keep total output under 200 lines.
```

**2.2 — Add to settings.json merge**

Uses existing merge-by-event-type logic in lib/cli.js installer:
```json
{
  "PreCompact": [
    {
      "hooks": [
        {
          "type": "prompt",
          "prompt": "<contents of compaction-save.md, inlined>"
        }
      ]
    }
  ]
}
```

Prompt hooks inline the text (they don't reference files). The template
file is the source of truth; the installer reads it and inlines into
settings.json during install/upgrade.

**Files created:**
- templates/hooks/compaction-save.md

**Files modified:**
- lib/cli.js — hooks module template list + settings.json merge

---

### Workstream 3: SessionStart Command Hook (compact matcher)

Shell script that reads back what PreCompact wrote, re-injecting
context when the session resumes after compaction.

**3.1 — Create hook script**

File: `templates/hooks/compaction-recover.sh`

```bash
#!/usr/bin/env bash
# Reads compaction state written by PreCompact prompt hook.
# Stdout is injected as additionalContext by SessionStart.
set -euo pipefail

found=0

# Core handoff note
if [ -f .claude/compaction-state.md ]; then
  echo "## Recovery: Session State"
  cat .claude/compaction-state.md
  echo ""
  found=1
fi

# Any workflow partial files (generic glob — no skill names hardcoded)
for f in .claude/*-partial.md; do
  [ -f "$f" ] || continue
  name=$(basename "$f" .md | sed 's/-partial$//')
  echo "## Recovery: ${name} (in progress)"
  cat "$f"
  echo ""
  found=1
done

if [ "$found" -eq 0 ]; then
  echo "No compaction state found. If you were mid-task, ask the user."
fi
```

**3.2 — Add to settings.json merge**

```json
{
  "SessionStart": [
    {
      "matcher": "compact",
      "hooks": [
        {
          "type": "command",
          "command": ".claude/hooks/compaction-recover.sh"
        }
      ]
    }
  ]
}
```

**Verification needed:** Confirm that `"matcher": "compact"` is the
correct syntax for SessionStart to fire only after compaction. This
was found in hooks-guide docs with an explicit example, but should be
tested before shipping to downstream projects.

**Files created:**
- templates/hooks/compaction-recover.sh

**Files modified:**
- lib/cli.js — hooks module template list + settings.json merge

---

### Workstream 4: context:fork for Audit Member Execution

**GATED:** This workstream executes only after verifying that
`context: fork` is a real Claude Code skill/agent directive. If it's
not, the existing Agent tool already provides context isolation (each
subagent gets its own context window), and this workstream becomes a
documentation clarification rather than a code change.

**Verification step:** Fetch Claude Code docs on subagents and skills.
Search for `context: fork` or `context:fork`. If found → proceed. If
not → document that Agent tool isolation is sufficient and close WS4.

**If verified:**

**4.1 — Update audit/SKILL.md member execution default**

In the skeleton's default member-execution behavior, change from
"spawn as an agent" to "spawn with context: fork":

```markdown
When spawning cabinet member agents, use `context: fork` to give each
member an isolated copy of the current context. This prevents one
member's heavy codebase reading from consuming context space needed
by other members.

Each forked agent receives:
1. The cabinet member's SKILL.md
2. Briefing files per the briefing loading protocol
3. The output contract
4. The suppression list
5. Instructions to write findings as structured JSON to stdout

The parent context collects each forked agent's output without
inheriting their file-reading context.
```

**4.2 — Update member-execution.md phase template**

```markdown
# Member Execution — context:fork default

Cabinet members execute in forked contexts (context: fork) for
isolation. Override this phase if you need:
- Sequential execution (constrained infrastructure)
- Shared context between members (rare — usually a design smell)
- Custom timeout/retry logic per member
```

**Depends on:** WS1 ($ARGUMENTS filtering must work before members are
forked — the filtered member list feeds into the fork loop).

**Files modified (if verified):**
- templates/skills/audit/SKILL.md
- templates/skills/audit/phases/member-execution.md

---

### Workstream 5: MCP Server for pib-db

Build a proper MCP server wrapping pib-db. This is **process
infrastructure** — audit findings, triage, work tracking, and plan
filing all flow through pib-db. An MCP server means Claude interacts
with it as structured tools instead of shelling out to CLI and parsing
stdout.

**Design requirement** (per architecture critique): MCP server and CLI
must share a library. Extract the core operations from `pib-db.mjs`
into a shared module (`scripts/pib-db-lib.mjs`) that both consumers
import. Schema changes update one place.

**5.1 — Extract shared library**

File: `scripts/pib-db-lib.mjs`

Moves all database operations out of the CLI into importable functions:
- `createProject(db, {name, area, notes, due})` → project fid
- `listProjects(db, {status})` → project list
- `createAction(db, {text, projectFid, area, due, notes})` → action fid
- `listActions(db, {status, project, limit})` → action list
- `updateAction(db, fid, fields)` → updated action
- `completeAction(db, fid)` → completed action
- `ingestFindings(db, runDir)` → ingested count
- `triage(db, findingId, status, notes)` → triaged finding
- `triageHistory(db)` → suppression list JSON
- `query(db, sql)` → results (SELECT only)

**5.2 — Refactor CLI to use shared library**

`scripts/pib-db.mjs` becomes a thin CLI wrapper over `pib-db-lib.mjs`.
Same commands, same output — zero behavior change.

**5.3 — Create MCP server**

File: `scripts/pib-db-mcp-server.mjs`

Imports `pib-db-lib.mjs`. Exposes tools:
- `pib_create_project`, `pib_list_projects`
- `pib_create_action`, `pib_list_actions`, `pib_update_action`, `pib_complete_action`
- `pib_ingest_findings`, `pib_triage`, `pib_triage_history`
- `pib_query`

Uses stdio transport. Same `better-sqlite3` database, WAL mode.

**5.4 — MCP server configuration**

File: `templates/mcp/pib-db.json`

```json
{
  "mcpServers": {
    "pib-db": {
      "command": "node",
      "args": ["scripts/pib-db-mcp-server.mjs"],
      "env": {
        "PIB_DB_PATH": "./pib.db"
      }
    }
  }
}
```

**5.5 — Update skills to prefer MCP tools**

Define the preference ONCE in a protocol document
(`cabinet/pib-db-access.md`) that skills reference:

```markdown
When accessing pib-db:
1. If `pib_*` MCP tools are available → use them directly
2. Otherwise → fall back to `node scripts/pib-db.mjs <command>`
```

Skills that currently shell out (audit, plan, execute, orient, debrief)
add a reference to this protocol doc instead of each embedding the
fallback logic.

**5.6 — Update installer**

Work-tracking module adds MCP server config via `.mcp.json` merge.
CLI tool remains for non-Claude usage (scripts, CI, manual queries).

**Files created:**
- scripts/pib-db-lib.mjs (new)
- scripts/pib-db-mcp-server.mjs (new)
- templates/mcp/pib-db.json (new)
- templates/cabinet/pib-db-access.md (new)

**Files modified:**
- scripts/pib-db.mjs (refactored to use shared lib)
- lib/cli.js — work-tracking module template list + .mcp.json merge
- templates/skills/audit/SKILL.md (add pib-db-access.md reference)
- templates/skills/plan/SKILL.md (add reference)
- templates/skills/execute/SKILL.md (add reference)
- templates/skills/orient/SKILL.md (add reference)
- templates/skills/debrief/SKILL.md (add reference)

---

### Workstream 6: Output Styles (Investigation)

Investigate whether output styles improve CC's presentation layer.
Spike only — no commitment.

**6.1 — Research output styles spec**

Fetch docs on `.claude/output-styles/*.md` format, frontmatter fields
(`keep-coding-instructions`), and interaction with skills.

**6.2 — Prototype one style**

Create a single output style (e.g., `cabinet-briefing.md`) that gives
audit and orient output a consistent format. Test whether it improves
or constrains.

**6.3 — Decide: adopt, defer, or drop**

**Files created (if adopted):**
- templates/output-styles/cabinet-briefing.md

**Files modified (if adopted):**
- lib/cli.js — output-styles in module template list

---

## Surface Area

### Created (new)
- files: scripts/resolve-arguments.cjs (new)
- files: templates/hooks/compaction-save.md (new)
- files: templates/hooks/compaction-recover.sh (new)
- files: scripts/pib-db-lib.mjs (new)
- files: scripts/pib-db-mcp-server.mjs (new)
- files: templates/mcp/pib-db.json (new)
- files: templates/cabinet/pib-db-access.md (new)

### Modified
- files: templates/skills/audit/SKILL.md
- files: templates/skills/plan/SKILL.md
- files: templates/skills/cabinet/SKILL.md
- files: templates/skills/investigate/SKILL.md
- files: templates/skills/execute/SKILL.md
- files: templates/skills/orient/SKILL.md
- files: templates/skills/debrief/SKILL.md
- files: templates/skills/audit/phases/member-execution.md (if WS4 verified)
- files: scripts/pib-db.mjs (refactored to use shared lib)
- files: lib/cli.js

## Execution Order

**Sequential, not parallel** (per workflow-cop critique — shared
lib/cli.js modifications would conflict):

1. **WS1: $ARGUMENTS + resolve-arguments.cjs** — highest user-facing
   value, lowest risk. No behavior change when arguments are empty.
2. **WS2+3: Compaction hooks** — implement together. Graceful failure
   (no state file = no injection).
3. **WS4: context:fork** — GATED on verification. Depends on WS1
   (filtered member list feeds fork loop).
4. **WS5: pib-db MCP** — extract shared lib, build server, update
   installer. CLI fallback = zero functionality loss during transition.
5. **WS6: Output styles** — investigation only, zero risk, no urgency.

## Relationship to Existing Work

**Adjacent to `prj:plugin-format`** (Plugin Format Exploration):
- That project converts CC into a distributable plugin
- This project adopts platform features within the current architecture
- No conflict — these changes make eventual plugin conversion easier
- `act:plugin-spike` may absorb some work, but these are independently valuable

## Acceptance Criteria

### WS1: $ARGUMENTS
- [auto] `node -c lib/cli.js` passes after all changes
- [auto] `node scripts/resolve-arguments.cjs "security"` returns `{ members: ["security"], topics: [] }`
- [auto] `node scripts/resolve-arguments.cjs "health"` expands to health committee members
- [auto] `node scripts/resolve-arguments.cjs "security, architecture"` returns both members
- [auto] `node scripts/resolve-arguments.cjs "hooks"` returns `{ members: [], topics: ["hooks"] }`
- [manual] `/audit security` invokes only security + cross-portfolio, echoes "Audit scope: security"
- [manual] `/plan refactor hooks --critics architecture, process` resolves mixed member+committee
- [manual] All existing behavior preserved when no arguments given

### WS2+3: Compaction Hooks
- [auto] compaction-recover.sh reads state files and outputs to stdout
- [auto] compaction-recover.sh outputs "No compaction state found" when no files exist
- [auto] SessionStart compact matcher configured in settings.json after install
- [auto] PreCompact hook configured in settings.json after install
- [manual] PreCompact writes .claude/compaction-state.md before compaction
- [manual] Mid-workflow partial files survive compaction and get re-injected

### WS4: context:fork (if verified)
- [manual] Audit members execute in isolated contexts
- [manual] Parent context doesn't grow with member file reads
- [manual] Phase file override still works (sequential mode)

### WS5: pib-db MCP Server
- [auto] `node -c scripts/pib-db-lib.mjs` passes (shared lib syntax check)
- [auto] `node scripts/pib-db.mjs list-projects` still works after refactor
- [auto] pib-db MCP server starts without error
- [auto] `pib_list_projects` MCP tool returns same data as CLI equivalent
- [auto] `.mcp.json` includes pib-db server config after install
- [manual] Skills use MCP tools when available, fall back to CLI

### WS6: Output Styles
- [manual] Prototype style tested; adopt/defer/drop decision made
