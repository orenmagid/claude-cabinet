# Feedback Remediation v3 — Revised After Human Review

## Problem

17 field feedback items from 4 consuming projects reveal systemic gaps in
CC's core skill pipeline. v2 plan diagnosed structural problems but
prescribed compliance-layer fixes. This revision promotes the highest-impact
items to structural enforcement (hooks, tools, scripts) and keeps
compliance-layer text only where judgment is genuinely required.

**Guiding principle from enforcement pipeline:** structural encoding >
hooks (~100%) > rules files (~80%) > SKILL.md text (~60-80%). Every action
below names its enforcement layer and justifies why it's at that layer.

## Review Record

Plan v2 was reviewed via the review UI on 2026-04-13.
- 21 approved, 3 questions (answered), 1 pending (approved verbally)
- Full verdicts: see review server session data
- Full critique: `.claude/plans/feedback-remediation-v2-critique.md`
- Key user directives: "fix as much as possible now," "Flow needs its own
  version," "bash SQL bypass pattern should be customizable per consumer"

---

## Action 1: Add `pib_get_action` MCP Tool

**Enforcement layer:** Structural — makes full spec available as a
one-tool-call operation. Currently impossible to read action notes through
standard MCP tools.

**Why:** `pib_list_actions` SQL query (pib-db-lib.mjs line 144) selects
`fid, text, area, due, flagged, status, tags, project` — no `notes` column.
Execute literally cannot read specs. This is the #1 root cause of
"execute builds from titles."

**Files to change:**
- `scripts/pib-db-lib.mjs` — add `getAction(db, { fid })` function
- `scripts/pib-db-mcp-server.mjs` — add tool definition + dispatch case

**Implementation:**

In `pib-db-lib.mjs`, add a new exported function:

```javascript
export function getAction(db, { fid }) {
  if (!fid) return { error: 'fid is required' };
  const row = db.prepare(`
    SELECT a.*, p.name as project_name
    FROM actions a
    LEFT JOIN projects p ON a.project_fid = p.fid
    WHERE a.fid = ? AND a.deleted_at IS NULL
  `).get(fid);
  if (!row) return { error: `No action found with fid: ${fid}` };
  return row;
}
```

In `pib-db-mcp-server.mjs`, add to TOOLS array:

```javascript
{
  name: 'pib_get_action',
  description: 'Get full details of a single action by fid, including complete notes.',
  inputSchema: {
    type: 'object',
    properties: {
      fid: { type: 'string', description: 'Action fid' }
    },
    required: ['fid']
  }
}
```

Add dispatch case in handleToolCall:

```javascript
case 'pib_get_action':
  return getAction(db, args);
```

**AC:**
- [auto] `pib_get_action` tool exists in MCP server tool list
- [auto] Calling `pib_get_action` with a valid fid returns full record including `notes`
- [auto] Calling with invalid fid returns error object, not crash

---

## Action 2: PreToolUse Hook — Block Raw SQL Against Actions Table

**Enforcement layer:** Hook (~100%) — prevents bypassing MCP tools for
action CRUD operations via raw SQL in the Bash tool.

**Why:** All the quality gates we add to MCP tools (Actions 3, 4) are
meaningless if you can bypass them with `sqlite3 pib.db "INSERT INTO
actions..."`. This pattern is generalizable — consuming projects (including
Flow) need to customize which tables/patterns are guarded.

**Files to create:**
- `templates/hooks/work-tracker-guard.sh` — the hook script

**Files to modify:**
- `lib/cli.js` — add hook to the `hooks` module's settings.json injection

**Implementation:**

`templates/hooks/work-tracker-guard.sh`:

```bash
#!/bin/bash
# PreToolUse hook on Bash tool
# Blocks raw SQL operations against work tracker tables.
# Consuming projects can customize GUARDED_PATTERNS in phases/work-tracker-guard.md
#
# Default patterns guard pib-db actions table.
# Flow override example: guard flow.db actions table instead.

INPUT="$CLAUDE_TOOL_INPUT"
COMMAND=$(echo "$INPUT" | jq -r '.command // empty')

if [ -z "$COMMAND" ]; then
  echo '{"decision":"allow"}'
  exit 0
fi

# Default guarded patterns — consuming projects override via phase file
PHASE_FILE=".claude/skills/hooks/phases/work-tracker-guard.md"
if [ -f "$PHASE_FILE" ]; then
  # Phase file can define custom patterns (one per line, no comments)
  SKIP_CHECK=$(head -1 "$PHASE_FILE")
  if [ "$SKIP_CHECK" = "skip: true" ]; then
    echo '{"decision":"allow"}'
    exit 0
  fi
fi

# Check for SQL operations against actions table
# Catches: sqlite3 commands, SQL in heredocs, pib_query with raw SQL
BLOCKED=false
REASON=""

# Pattern: direct sqlite3 commands targeting actions table
if echo "$COMMAND" | grep -qiE '(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+actions'; then
  BLOCKED=true
  REASON="Raw SQL against actions table detected. Use MCP tools instead: pib_create_action, pib_update_action, pib_complete_action. These tools enforce quality gates (notes validation, spec verification). To override, add --force-raw-sql to your command."
fi

# Override escape hatch: --force-raw-sql flag
if echo "$COMMAND" | grep -q '\-\-force-raw-sql'; then
  echo '{"decision":"allow","reason":"Raw SQL override acknowledged. Quality gates bypassed."}'
  exit 0
fi

if [ "$BLOCKED" = "true" ]; then
  echo "{\"decision\":\"block\",\"reason\":\"$REASON\"}"
else
  echo '{"decision":"allow"}'
fi
```

**Customization for consuming projects:**

Consuming projects create `.claude/skills/hooks/phases/work-tracker-guard.md`
to customize. Examples:

Flow would create a phase file that guards its own tables:
```
# Flow work tracker guard — overrides default pib-db patterns
# Guard flow.db actions table instead of pib.db
GUARDED_TABLE=actions
GUARDED_DB=flow.db
```

A project that doesn't use any work tracker puts `skip: true` in the phase file.

**Hook registration in settings.json** (added by installer):

```json
{
  "type": "command",
  "event": "PreToolUse",
  "matcher": "Bash",
  "command": "bash .claude/hooks/work-tracker-guard.sh"
}
```

**AC:**
- [auto] Hook script exists and is executable
- [manual] Running `sqlite3 pib.db "INSERT INTO actions..."` is blocked with informative message
- [manual] Adding `--force-raw-sql` allows the command through with warning
- [manual] Phase file with `skip: true` disables the hook entirely

---

## Action 3: PreToolUse Hook — Action Creation Quality Gate

**Enforcement layer:** Hook (~100%) — blocks creation of actions with
inadequate notes. QA cabinet member defines the criteria; we encode them.

**Why:** Actions created with empty/garbage notes propagate detail loss
through the entire plan→execute pipeline. This is Pattern A's root cause.
A compliance-layer instruction in SKILL.md was failing at ~60-80%.

**Files to create:**
- `templates/hooks/action-quality-gate.sh` — the hook script

**Files to modify:**
- `lib/cli.js` — add hook to settings.json injection

**Implementation:**

`templates/hooks/action-quality-gate.sh`:

```bash
#!/bin/bash
# PreToolUse hook on pib_create_action
# Blocks action creation when notes fail quality checks.
# Quality criteria defined by QA cabinet member.
#
# Checks:
# 1. Notes field is present and non-empty
# 2. Notes are not just a copy of the title (text field)
# 3. Notes contain an acceptance criteria section (## AC, ## Acceptance, **AC:**, etc.)
# 4. Notes are at least 100 characters (a meaningful paragraph minimum)
# 5. Notes contain a surface area section (## Surface, **Files:**, etc.)
#
# These criteria were defined by the QA cabinet member based on field feedback
# showing that thin action notes are the #1 cause of execute-phase failures.

INPUT="$CLAUDE_TOOL_INPUT"

NOTES=$(echo "$INPUT" | jq -r '.notes // empty')
TEXT=$(echo "$INPUT" | jq -r '.text // empty')

if [ -z "$NOTES" ]; then
  echo '{"decision":"block","reason":"Action notes are empty. Every action needs notes with: implementation details, acceptance criteria, and surface area. The bar: a cold-start developer reads ONLY these notes and can implement correctly."}'
  exit 0
fi

# Check: notes aren't just the title repeated
if [ "$NOTES" = "$TEXT" ]; then
  echo '{"decision":"block","reason":"Action notes are identical to the title. Notes must contain implementation details, acceptance criteria, and surface area — not just a restated title."}'
  exit 0
fi

# Check: minimum length (100 chars = ~1 meaningful paragraph)
NOTE_LEN=${#NOTES}
if [ "$NOTE_LEN" -lt 100 ]; then
  echo "{\"decision\":\"block\",\"reason\":\"Action notes are only ${NOTE_LEN} characters. Minimum is 100. Include: implementation approach, acceptance criteria, and surface area (files to change).\"}"
  exit 0
fi

# Check: has acceptance criteria section
if ! echo "$NOTES" | grep -qiE '(## (AC|Acceptance|Criteria)|(\*\*AC|\*\*Acceptance)|\- \[[ x]\])'; then
  echo '{"decision":"block","reason":"Action notes have no acceptance criteria section. Add a section with ## Acceptance Criteria or ## AC containing testable criteria."}'
  exit 0
fi

# Check: has surface area section
if ! echo "$NOTES" | grep -qiE '(## Surface|## Files|\*\*Files|\*\*Surface|files:|surface area)'; then
  echo '{"decision":"block","reason":"Action notes have no surface area section. Add ## Surface Area listing the files/directories this action will change."}'
  exit 0
fi

echo '{"decision":"allow"}'
```

**Hook registration:**

```json
{
  "type": "command",
  "event": "PreToolUse",
  "matcher": "pib_create_action",
  "command": "bash .claude/hooks/action-quality-gate.sh"
}
```

**Flow compatibility:** Flow doesn't use `pib_create_action` — it uses its
own API. Flow needs an equivalent hook on its own action creation pathway.
This is tracked as a downstream task for Flow, not built here. The pattern
(quality gate hook on action creation) is the transferable concept; the
implementation is project-specific.

**AC:**
- [auto] Hook script exists and is executable
- [manual] Creating action with empty notes is blocked
- [manual] Creating action with notes = title is blocked
- [manual] Creating action with <100 char notes is blocked
- [manual] Creating action without AC section is blocked
- [manual] Creating action without surface area is blocked
- [manual] Creating action with all sections present is allowed

---

## Action 4: PreToolUse Hook — Action Completion Spec Verification Gate

**Enforcement layer:** Hook (~100%) — blocks marking actions complete
without verifying the spec was followed.

**Why:** The execute skill's "verify AC before closing" instruction was
being ignored (~60-80% compliance). A hook makes it ~100%.

**Files to create:**
- `templates/hooks/action-completion-gate.sh` — the hook script

**Files to modify:**
- `lib/cli.js` — add hook to settings.json injection

**Implementation:**

`templates/hooks/action-completion-gate.sh`:

```bash
#!/bin/bash
# PreToolUse hook on pib_complete_action
# Before marking an action complete, verifies that:
# 1. The full action notes were read this session (checked via a breadcrumb file)
# 2. A verification summary exists
#
# The execute skill writes a breadcrumb to .claude/verification/<fid>.json
# when it reads the full spec and again when it verifies AC.
# This hook checks that both breadcrumbs exist.

INPUT="$CLAUDE_TOOL_INPUT"
FID=$(echo "$INPUT" | jq -r '.fid // empty')

if [ -z "$FID" ]; then
  echo '{"decision":"allow"}'
  exit 0
fi

VERIFY_DIR=".claude/verification"
BREADCRUMB="$VERIFY_DIR/$FID.json"

if [ ! -f "$BREADCRUMB" ]; then
  echo "{\"decision\":\"block\",\"reason\":\"No verification record for action $FID. Before completing an action: (1) Read the full spec via pib_get_action, (2) Compare implementation against every AC, (3) Write verification summary to .claude/verification/$FID.json. Then retry completion.\"}"
  exit 0
fi

# Check breadcrumb has both phases
SPEC_READ=$(jq -r '.spec_read // false' "$BREADCRUMB" 2>/dev/null)
AC_VERIFIED=$(jq -r '.ac_verified // false' "$BREADCRUMB" 2>/dev/null)

if [ "$SPEC_READ" != "true" ]; then
  echo "{\"decision\":\"block\",\"reason\":\"Verification record exists but spec was not read. Use pib_get_action to read full notes, then update .claude/verification/$FID.json with spec_read: true.\"}"
  exit 0
fi

if [ "$AC_VERIFIED" != "true" ]; then
  echo "{\"decision\":\"block\",\"reason\":\"Spec was read but AC not verified. Compare implementation against each acceptance criterion, then update .claude/verification/$FID.json with ac_verified: true and a summary of what was checked.\"}"
  exit 0
fi

echo '{"decision":"allow"}'
```

**Execute skill integration:** The execute skill (SKILL.md Step 1 and
Step 7) must write the breadcrumb files. This is covered in Action 8.

**Breadcrumb format** (`.claude/verification/<fid>.json`):

```json
{
  "fid": "abc123",
  "spec_read": true,
  "spec_read_at": "2026-04-13T10:00:00Z",
  "ac_verified": true,
  "ac_verified_at": "2026-04-13T11:30:00Z",
  "verification_summary": "All 4 AC met: endpoint returns 200, validation rejects bad input, tests pass, types clean.",
  "deviations": []
}
```

**AC:**
- [auto] Hook script exists and is executable
- [manual] Completing action without breadcrumb is blocked
- [manual] Completing action with spec_read=false is blocked
- [manual] Completing action with ac_verified=false is blocked
- [manual] Completing action with full breadcrumb is allowed
- [auto] `.claude/verification/` directory created by execute skill or hook

---

## Action 5: Remove `disable-model-invocation` from cc-feedback + Fix Feedback Pipeline

**Enforcement layer:** Structural — removes the flag that prevents the
assistant from filing feedback, and adds outbox scanning for wrong-write
locations.

**Why:** Three broken feedback delivery paths:
1. Outbox exists but never auto-flushed (partially fixed by orient check)
2. `/cc-feedback` blocked by `disable-model-invocation` — assistant CAN'T file feedback
3. Assistant writes to local `.claude/memory/feedback/` instead — CC never checks there

This action fixes all three paths.

**Files to modify:**
- `templates/skills/cc-feedback/SKILL.md` — remove `disable-model-invocation: 'true'`
- `templates/skills/orient/SKILL.md` — add outbox flush + wrong-path scan

**Implementation for cc-feedback/SKILL.md:**

Remove this line from frontmatter:
```yaml
disable-model-invocation: 'true'
```

**Implementation for orient/SKILL.md** (in Step 1: Load Context, Default behavior):

Add after the existing context loading steps:

```markdown
### Feedback pipeline check

1. **Flush outbox.** Read `~/.claude/cc-feedback-outbox.json`. If items
   exist with `delivered: false`:
   - If this is the CC source repo (package.json name is
     `create-claude-cabinet`): copy items to `feedback/` directory,
     mark as delivered, write back atomically (write to temp file,
     rename over original).
   - If this is a consuming project with cc-registry.json: copy items
     to the CC source repo's `feedback/` using the path from
     cc-registry.json, mark as delivered.
   - Wrap in try/catch. If JSON is malformed, log warning and reset
     to `[]`. Never crash orient over a bad outbox.

2. **Scan wrong-write locations.** Check these paths for CC-scoped
   feedback that was written to the wrong place:
   - `.claude/memory/feedback/*.md` — consuming projects sometimes
     write here instead of the outbox
   - `.claude/feedback/*.md` — another common wrong-write location
   If found, surface: "Found N feedback files in [path] that should
   be in the CC outbox. Copy to outbox? [y/n]"
```

**AC:**
- [auto] `disable-model-invocation` does not appear in cc-feedback/SKILL.md
- [manual] Assistant can invoke /cc-feedback programmatically
- [manual] Orient flushes outbox items when running in CC source repo
- [manual] Orient scans wrong-write locations and surfaces found items
- [manual] Malformed outbox JSON triggers warning + reset, not crash

---

## Action 6: Orient — LSP Auto-Detection Per Tech Stack

**Enforcement layer:** Structural detection + advisory recommendation.
Orient detects the tech stack and checks for matching LSP plugins. Can't
force install (that's the user's choice), but can flag the gap every session.

**Why:** LSP plugins are the primary structural fix for code-level feedback
items (missing imports, prop guessing, type errors). But they only work if
installed. Auto-detection ensures every project gets the right recommendation.

**Files to modify:**
- `templates/skills/orient/SKILL.md` — add LSP check to health phase
- `templates/skills/cabinet-cc-health/SKILL.md` — add LSP health check

**Implementation for orient/SKILL.md** (in health check phase):

```markdown
### LSP plugin check

Detect project tech stack and verify matching LSP plugins are installed:

| Indicator file | Language | LSP plugin |
|---|---|---|
| tsconfig.json or .ts files | TypeScript | typescript-lsp |
| pyproject.toml, requirements.txt, .py files | Python | pyright-lsp |
| Cargo.toml | Rust | rust-analyzer-lsp |
| go.mod | Go | gopls-lsp |

For each detected language without its LSP plugin:
- Surface as health warning: "⚠ [Language] detected but [plugin] not installed. Install via: claude plugins install [plugin]"
- This is advisory, not blocking — the user decides.

Check installed plugins via: `claude plugins list` (if available) or
check `~/.claude/plugins/` directory.
```

**Implementation for cabinet-cc-health/SKILL.md:**

Add to health checks:
```markdown
### LSP Plugin Coverage

For each language detected in the project (via tsconfig.json, pyproject.toml,
Cargo.toml, go.mod, etc.), verify the matching LSP plugin is installed.
Missing LSP plugins are a WARNING-level finding — they represent structural
enforcement that's available but not active.
```

**AC:**
- [manual] Orient detects TypeScript project and checks for typescript-lsp
- [manual] Orient detects Python project and checks for pyright-lsp
- [manual] Missing LSP plugin surfaced as health warning with install command
- [manual] cc-health includes LSP coverage as WARNING-level check

---

## Action 7: Orient — Structural Omega Query + Memory File Guard

**Enforcement layer:** Structural (scripted command) + Hook (memory file guard)

**Why two things:**
1. Orient's omega query is currently a prose instruction that gets skipped
   ~20-40% of sessions. Making it a scripted command makes it structural.
2. When omega is configured, writing to flat `.claude/memory/` files is the
   wrong path. A PostToolUse hook catches this and redirects to omega.

**Files to modify:**
- `templates/skills/orient/SKILL.md` — replace prose omega instruction with
  scripted command block
- `templates/hooks/omega-memory-guard.sh` — already exists, verify it covers
  this case

**Implementation for orient/SKILL.md:**

Replace the current omega query instruction (which says something like
"query omega for additional context") with a bash command block that
executes mechanically:

```markdown
### Omega context (MANDATORY if omega configured)

If `~/.claude-cabinet/omega-venv/bin/omega` exists, execute this query:

\`\`\`bash
~/.claude-cabinet/omega-venv/bin/omega query "session context for $(basename $(pwd)): recent decisions, active constraints, known issues" --limit 10
\`\`\`

If the command fails or returns empty, surface warning in briefing:
"⚠ Omega context not loaded — prior session decisions may be missing.
Check: omega hooks doctor"

Do NOT skip this step. Do NOT paraphrase the instruction. Execute the
command.
```

**Memory file guard hook** (`templates/hooks/omega-memory-guard.sh`):

This hook already exists in the repo. Verify it handles this case: when
omega is configured and the user writes to `.claude/memory/**/*.md`, it
should emit an advisory warning (not block) saying "Omega is configured —
use omega_store() for new memories. Flat memory files are read-only exports."

If the existing hook doesn't cover this, add the check. The hook should:
1. Check if omega venv exists (`~/.claude-cabinet/omega-venv/bin/omega`)
2. Check if the file being written matches `.claude/memory/**/*.md`
3. If both true: emit advisory warning, allow the write
4. If omega not configured: allow silently

**AC:**
- [auto] Orient SKILL.md contains the bash command block for omega query
- [manual] Orient executes the omega query as a command, not as prose
- [manual] Failed omega query surfaces warning in briefing
- [manual] Writing to .claude/memory/ when omega is active triggers advisory
- [manual] Writing to .claude/memory/ when omega is NOT active is silent

---

## Action 8: Execute Skill — Verification Breadcrumb Protocol

**Enforcement layer:** Structural (breadcrumb files) + Hook (completion
gate from Action 4 enforces the breadcrumbs exist)

**Why:** Execute's "read the spec" and "verify AC" instructions were
compliance-layer text with ~60-80% adherence. The breadcrumb protocol
creates artifacts that the completion hook can verify mechanically.

**Files to modify:**
- `templates/skills/execute/SKILL.md` — update Step 1 and Step 7/8

**Implementation for execute/SKILL.md:**

**Step 1 (Load the Plan)** — add after loading the plan reference:

```markdown
### Load full spec

For the action you're about to execute:

1. Call `pib_get_action` with the action's fid to get the complete notes.
2. If `pib_get_action` is not available, use `pib_query` with:
   `SELECT * FROM actions WHERE fid = '<fid>'`
3. Read the FULL notes. If notes appear truncated, re-query.
4. Write the spec breadcrumb:

\`\`\`bash
mkdir -p .claude/verification
cat > .claude/verification/<fid>.json << 'SPEC'
{
  "fid": "<fid>",
  "spec_read": true,
  "spec_read_at": "<ISO timestamp>",
  "ac_verified": false,
  "verification_summary": null,
  "deviations": []
}
SPEC
\`\`\`

Do NOT proceed to implementation until the breadcrumb is written.
The completion hook (Action 4) will block you from marking this
action complete without it.
```

**Step 7 (Verify AC)** — replace or augment existing verification:

```markdown
### Verify acceptance criteria

For each AC in the action's notes:
1. State the criterion
2. State whether it's met, with evidence (file path, test output, etc.)
3. If not met, add to deviations list

After checking all ACs, update the breadcrumb:

\`\`\`bash
# Update verification breadcrumb (use jq or write full JSON)
cat > .claude/verification/<fid>.json << 'VERIFY'
{
  "fid": "<fid>",
  "spec_read": true,
  "spec_read_at": "<original timestamp>",
  "ac_verified": true,
  "ac_verified_at": "<ISO timestamp>",
  "verification_summary": "<1-2 sentence summary of what was verified>",
  "deviations": [<any deviations found, as strings>]
}
VERIFY
\`\`\`

If deviations is non-empty, DO NOT mark the action complete.
Address deviations first, or escalate to the user.
```

**Step 8 (Deviation propagation)** — add:

```markdown
### Check downstream impact

If this action's implementation deviated from the plan (deviations array
is non-empty in the breadcrumb), check downstream actions in the same
project:

1. `pib_list_actions` for the same project with status != done
2. For each remaining action, check if its surface area overlaps with
   files modified in this action (use `git diff --name-only` from before
   this action started)
3. If overlap found, flag: "Action [fid] may need updating — files in
   its surface area were modified during [this fid] with deviations."
```

**AC:**
- [manual] Execute Step 1 writes spec breadcrumb before implementation
- [manual] Execute Step 7 updates breadcrumb with AC verification
- [manual] Non-empty deviations array blocks completion
- [manual] Downstream actions with overlapping surface area are flagged
- [auto] .claude/verification/ directory structure is correct

---

## Action 9: Plan Skill — QA Convened at Phase 6 + Compliance Stack Check

**Enforcement layer:** Compliance (SKILL.md text) — justified because
plan completeness genuinely requires judgment. QA is the expert.

**Why:** Static checklists for plan completeness miss context-dependent
issues. The QA cabinet member has the domain knowledge to judge whether
a plan's actions are implementable by a cold-start developer. Also adds
a compliance stack analysis step: for each proposed fix, what enforcement
layer is it at? If it's compliance-layer for a structural problem, flag it.

**Files to modify:**
- `templates/skills/plan/SKILL.md` — update Phase 6 and Phase 8

**Implementation for Phase 6 (Completeness Check):**

Replace or augment the existing completeness check with:

```markdown
### Phase 6: Completeness Check

Convene the QA cabinet member (`/cabinet qa`) for a completeness review.
QA evaluates each action in the plan against these criteria:

- Can a developer reading ONLY this action's notes implement without
  questions?
- Does every action have testable acceptance criteria?
- Are implementation details specific (exact files, methods, formats)
  not vague ("update the API")?
- Is the surface area (files to change) explicitly listed?
- If the plan defines multiple endpoints/components/interfaces, is there
  a Phase 0 action defining shared conventions (response format, error
  codes, naming)?

QA returns a verdict per action: PASS, NEEDS DETAIL, or BLOCK.
BLOCK means the action is unimplementable as written. Do not proceed
to Phase 7 until all actions pass or the user overrides.
```

**Add to Phase 8 (Create the Work Item) — compliance stack analysis:**

```markdown
### Compliance stack check (before filing)

For each action in the plan, verify the enforcement layer matches the
problem severity:

- If the action adds SKILL.md prose to fix something that was already
  failing as SKILL.md prose → flag as "compliance-layer fix for
  compliance-layer failure." Consider: can this be a hook instead?
- If the action adds a hook → good, verify it's mechanically checkable
- If the action adds structural encoding (tool, script, schema) → ideal

Surface the analysis: "N actions are structural, M are hooks, K are
compliance-layer. The following compliance-layer items may need
promotion: [list]."

The user decides whether to promote or accept the risk.
```

**AC:**
- [manual] Phase 6 convenes QA for completeness review
- [manual] Each action gets PASS/NEEDS DETAIL/BLOCK verdict from QA
- [manual] BLOCK verdict prevents proceeding to Phase 7
- [manual] Phase 8 includes compliance stack analysis before filing
- [manual] Compliance-layer fixes for structural problems are flagged

---

## Action 10: Review UI Integration into Audit Module

**Enforcement layer:** Structural — makes the review UI available to all
consuming projects through the CC installer.

**Why:** The review UI is the meta-tool for human-in-the-loop decision
making. Plans, audits, critique feedback, proposals — all need itemized
review. Currently exists as template files but isn't installable.

**Files to modify:**
- `lib/cli.js` — add review-server.mjs and review-ui.html to the `audit`
  module's templates array
- `templates/skills/plan/SKILL.md` — add review UI integration for plan
  critique workflow

**Implementation for lib/cli.js:**

In the MODULES object, find the `audit` module's templates array. Add:

```javascript
'scripts/review-server.mjs',
'scripts/review-ui.html',
```

**Implementation for plan/SKILL.md** (critique review phase):

After cabinet critique is collected, add a phase that uses the review UI:

```markdown
### Present critique for human review

If cabinet critique was collected:

1. Start the review server:
   `node scripts/review-server.mjs --port 3459 &`

2. Format each critique finding as a review item:
   ```json
   {
     "id": "<critic>-<n>",
     "group": "<critic name>",
     "severity": "<high|moderate|advisory>",
     "title": "<finding title>",
     "detail": "<finding detail with context>"
   }
   ```

3. POST to `http://localhost:3459/api/session`:
   ```json
   {
     "title": "Plan Critique — <plan name>",
     "items": [<formatted items>],
     "verdictLabels": "critique"
   }
   ```

4. Tell the user: "Review critique at http://localhost:3459"

5. When user says they've submitted, GET
   `http://localhost:3459/api/verdicts` and process:
   - **adopt**: incorporate into plan
   - **reject**: drop with reason noted
   - **revise**: modify based on user's notes
   - **defer**: track for future, not in this plan
   - **question**: answer the question, re-present if needed

6. Revise plan based on verdicts. All items must reach a terminal
   state (adopted, rejected, deferred) before the plan is finalized.
```

**Flow compatibility:** Flow can override the review UI in cases where it
has a more specialized interface (e.g., Flow's project/action review has
richer context from the Flow app). Flow should use the generic review UI
for: cabinet critique, general plan review, feedback triage. Flow should
override for: work item review (Flow's app has full action context), and
any review that needs Flow-specific data (forecasts, prep status, etc.).

The mechanism: Flow creates `phases/review-ui.md` with `skip: true` in
skills where it wants to use its own UI, and the skill falls through to
Flow's override behavior.

**AC:**
- [auto] review-server.mjs and review-ui.html in audit module templates
- [manual] Fresh CC install includes review-server.mjs and review-ui.html
- [manual] Plan skill uses review UI for critique presentation
- [manual] All verdict types (adopt/reject/revise/defer/question) handled
- [manual] Flow can override via phase file

---

## Action 11: Migrate Memory Files to Omega Script

**Enforcement layer:** Structural tool — provides a one-command migration
path from flat memory files to omega.

**Why:** Projects that started before omega was configured have memory in
flat `.claude/memory/` files. These need migration. Without a script, the
migration is manual and error-prone. Debrief can call this automatically;
orient can warn about unmigrated files.

**Files to create:**
- `templates/scripts/migrate-memory-to-omega.py`

**Files to modify:**
- `templates/skills/orient/SKILL.md` — add unmigrated file detection
- `templates/skills/debrief/SKILL.md` — add auto-migration call

**Implementation for migrate-memory-to-omega.py:**

```python
#!/usr/bin/env python3
"""Migrate flat .claude/memory/*.md files to omega semantic memory.

Usage: python3 migrate-memory-to-omega.py [--dry-run] [--memory-dir PATH]

Scans .claude/memory/ for .md files not yet migrated to omega.
For each file:
  1. Reads content
  2. Determines memory type from filename/content heuristics
  3. Calls omega_store() via the omega CLI
  4. Renames to .migrated on success

Idempotent — safe to run multiple times. .migrated files are skipped.
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path
from datetime import datetime

OMEGA_BIN = os.path.expanduser("~/.claude-cabinet/omega-venv/bin/omega")

TYPE_HEURISTICS = {
    "decision": ["decision", "chose", "decided", "went with", "picked"],
    "lesson_learned": ["lesson", "learned", "mistake", "gotcha", "never again"],
    "user_preference": ["prefer", "preference", "always", "never", "style"],
    "constraint": ["constraint", "limitation", "can't", "must not", "blocked"],
    "error_pattern": ["error", "bug", "broke", "failed", "crash"],
}

def detect_type(filename, content):
    """Guess memory type from filename and content."""
    text = (filename + " " + content).lower()
    scores = {}
    for mtype, keywords in TYPE_HEURISTICS.items():
        scores[mtype] = sum(1 for kw in keywords if kw in text)
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "decision"

def migrate_file(filepath, dry_run=False):
    """Migrate a single memory file to omega."""
    content = filepath.read_text(encoding="utf-8").strip()
    if not content:
        return "empty", "Skipped — empty file"

    mtype = detect_type(filepath.name, content)

    if dry_run:
        return "dry_run", f"Would store as {mtype}: {filepath.name}"

    try:
        result = subprocess.run(
            [OMEGA_BIN, "store", "--type", mtype, "--text", content],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            migrated_path = filepath.with_suffix(".md.migrated")
            filepath.rename(migrated_path)
            return "migrated", f"Stored as {mtype}, renamed to {migrated_path.name}"
        else:
            return "error", f"omega store failed: {result.stderr.strip()}"
    except Exception as e:
        return "error", f"Exception: {e}"

def main():
    parser = argparse.ArgumentParser(description="Migrate memory files to omega")
    parser.add_argument("--dry-run", action="store_true", help="Show what would happen")
    parser.add_argument("--memory-dir", default=".claude/memory",
                        help="Memory directory to scan (default: .claude/memory)")
    args = parser.parse_args()

    if not os.path.exists(OMEGA_BIN):
        print(f"ERROR: Omega not found at {OMEGA_BIN}")
        print("Install omega first: create-claude-cabinet --module memory")
        sys.exit(1)

    memory_dir = Path(args.memory_dir)
    if not memory_dir.exists():
        print(f"No memory directory at {memory_dir}")
        sys.exit(0)

    md_files = sorted(memory_dir.glob("**/*.md"))
    if not md_files:
        print("No .md files to migrate.")
        sys.exit(0)

    print(f"Found {len(md_files)} memory files to migrate.")
    if args.dry_run:
        print("DRY RUN — no changes will be made.\n")

    results = {"migrated": 0, "error": 0, "empty": 0, "dry_run": 0}
    for f in md_files:
        status, msg = migrate_file(f, dry_run=args.dry_run)
        results[status] += 1
        print(f"  [{status}] {f.name}: {msg}")

    print(f"\nDone. Migrated: {results.get('migrated', 0)}, "
          f"Errors: {results.get('error', 0)}, "
          f"Empty: {results.get('empty', 0)}")

if __name__ == "__main__":
    main()
```

**Orient integration:** Add to orient health check:
```markdown
If omega is configured and `.claude/memory/*.md` files exist (not
.migrated), surface: "⚠ Found N unmigrated memory files. Run:
python3 scripts/migrate-memory-to-omega.py --dry-run"
```

**Debrief integration:** Add to debrief cleanup phase:
```markdown
If omega is configured and `.claude/memory/*.md` files were written
this session, run migration automatically:
`python3 scripts/migrate-memory-to-omega.py`
```

**AC:**
- [auto] Script exists and runs without errors on `--dry-run`
- [manual] Script migrates .md files to omega with correct types
- [manual] Migrated files renamed to .md.migrated
- [manual] Running again skips .migrated files (idempotent)
- [manual] Orient warns about unmigrated files
- [manual] Debrief auto-migrates files written this session

---

## Action 12: surface_memories Enhancement + PreToolUse for Prevent-Type Memories

**Enforcement layer:** Hook enhancement — addresses why memories are
"loaded but not applied."

**Why:** The surface_memories hook fires on PostToolUse and searches by
file path. Two problems: (1) file path doesn't match behavioral memories
("never guess in browser automation" doesn't match any filename), and
(2) PostToolUse output has lower attention weight than tool results.

**Two-part fix:**

**Part A: PreToolUse prompt hook for high-risk domains**

Create a prompt hook that fires BEFORE editing files in domains where
we have prevent-type memories. This puts the memory in the decision
window, not after the fact.

File to create: `templates/hooks/domain-memories.sh`

```bash
#!/bin/bash
# PreToolUse prompt hook on Edit|Write
# Surfaces prevent-type memories for high-risk file domains.
# Uses omega query to search by behavioral context, not filename.

INPUT="$CLAUDE_TOOL_INPUT"
FILE_PATH=$(echo "$INPUT" | jq -r '.file_path // .path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

OMEGA_BIN="$HOME/.claude-cabinet/omega-venv/bin/omega"
if [ ! -x "$OMEGA_BIN" ]; then
  exit 0
fi

# Map file patterns to behavioral search terms
SEARCH_TERM=""
case "$FILE_PATH" in
  *playwright*|*puppeteer*|*selenium*|*cypress*)
    SEARCH_TERM="browser automation testing prevent mistakes" ;;
  *deploy*|*railway*|*docker*|*fly.toml*)
    SEARCH_TERM="deployment prevent mistakes constraints" ;;
  *migration*|*schema*|*.sql*)
    SEARCH_TERM="database migration prevent mistakes constraints" ;;
  *auth*|*session*|*token*|*credential*)
    SEARCH_TERM="authentication security prevent mistakes" ;;
esac

if [ -z "$SEARCH_TERM" ]; then
  exit 0
fi

# Query omega for prevent-type memories
MEMORIES=$("$OMEGA_BIN" query "$SEARCH_TERM" --type constraint --type error_pattern --limit 3 2>/dev/null)

if [ -n "$MEMORIES" ] && [ "$MEMORIES" != "No results" ]; then
  echo "⚠ RELEVANT MEMORIES for $(basename "$FILE_PATH"):"
  echo "$MEMORIES"
  echo "---"
fi
```

Hook registration:
```json
{
  "type": "prompt",
  "event": "PreToolUse",
  "matcher": "Edit|Write",
  "command": "bash .claude/hooks/domain-memories.sh"
}
```

**Part B: Document the surface_memories limitation**

In `templates/skills/orient/SKILL.md`, add a note in the omega section:

```markdown
**Known limitation:** The omega `surface_memories` hook searches by file
path, not behavioral context. Memories like "never guess in browser
automation" won't surface when editing `tests/login.spec.ts` because
the filename doesn't match. The `domain-memories` PreToolUse hook
(Action 12A) addresses this for known high-risk domains. For other
domains, manually query omega before editing unfamiliar code.
```

**AC:**
- [auto] domain-memories.sh hook exists and is executable
- [manual] Editing a playwright file triggers omega query for automation memories
- [manual] Editing a regular file does NOT trigger the hook
- [manual] Hook is silent when omega is not configured
- [manual] Surfaced memories appear BEFORE the edit, not after

---

## Action 13: Minor Fixes (Batch)

**13a. Fix `disable-model-invocation` quoted string**

In any SKILL.md that has `disable-model-invocation: 'true'` (string, not
boolean), either remove the flag entirely (if the skill should be
model-invocable) or fix to `disable-model-invocation: true` (boolean).

Files to check: all `templates/skills/*/SKILL.md`

**13b. Debrief-to-orient contract**

Add to `templates/skills/debrief/SKILL.md` (cleanup/handoff phase):

```markdown
### Orient contract

Debrief MUST record these for the next session's orient to function:

1. **Session summary** — what was done, stored in omega
2. **Open items** — any unfinished work, with fids
3. **Active constraints** — anything discovered that limits future work
4. **Feedback filed** — count of cc-feedback items filed this session

Orient will query omega for these. If debrief skips any, orient starts
blind on that dimension.
```

**13c. Outbox error handling**

Wherever outbox flush is implemented (orient, or a shared utility), ensure:
- try/catch around JSON.parse of outbox file
- Atomic write: write to `outbox.json.tmp`, then `fs.renameSync` over original
- On successful flush: reset to `[]`, don't accumulate delivered markers
- On malformed JSON: log warning, reset to `[]`, don't crash

**13d. hookify plugin research**

Research the hookify plugin from the Claude Code marketplace. Determine:
- What it does (auto-generate hooks from friction patterns?)
- Whether it's useful for our enforcement pipeline promotion step
- If yes, document in the enforcement pipeline as a tool for promotion

This is research only — no code changes. File findings to omega.

**AC:**
- [auto] No `'true'` (quoted string) remains in any SKILL.md frontmatter
- [manual] Debrief SKILL.md contains orient contract section
- [manual] Outbox flush uses try/catch and atomic write
- [auto] `node -c lib/cli.js` passes
- [manual] hookify research findings stored in omega

---

## Execution Order

These actions have dependencies. Execute in this order:

1. **Action 1** (pib_get_action) — no dependencies, unblocks Action 4 and 8
2. **Action 2** (bash SQL guard) — no dependencies
3. **Action 3** (creation quality gate) — no dependencies
4. **Action 4** (completion gate) — depends on Action 1 (pib_get_action)
5. **Action 5** (cc-feedback + feedback pipeline) — no dependencies
6. **Action 6** (LSP auto-detection) — no dependencies
7. **Action 7** (omega query + memory guard) — no dependencies
8. **Action 8** (execute breadcrumbs) — depends on Action 1 and 4
9. **Action 9** (plan QA + compliance stack) — no dependencies
10. **Action 10** (review UI integration) — no dependencies
11. **Action 11** (memory migration script) — depends on Action 7
12. **Action 12** (domain memories hook) — no dependencies
13. **Action 13** (minor batch) — no dependencies

**Parallelizable:** Actions 1-3, 5-7, 9-10, 12-13 can all run in parallel.
Actions 4 and 8 must wait for 1. Action 11 should follow 7.

## Surface Area

- scripts/pib-db-lib.mjs
- scripts/pib-db-mcp-server.mjs
- templates/hooks/work-tracker-guard.sh (NEW)
- templates/hooks/action-quality-gate.sh (NEW)
- templates/hooks/action-completion-gate.sh (NEW)
- templates/hooks/domain-memories.sh (NEW)
- templates/scripts/migrate-memory-to-omega.py (NEW)
- templates/scripts/review-server.mjs (existing, wire into module)
- templates/scripts/review-ui.html (existing, wire into module)
- templates/skills/cc-feedback/SKILL.md
- templates/skills/orient/SKILL.md
- templates/skills/execute/SKILL.md
- templates/skills/plan/SKILL.md
- templates/skills/debrief/SKILL.md
- templates/skills/cabinet-cc-health/SKILL.md
- lib/cli.js

## Flow Downstream Tasks (not built here, tracked)

- Flow needs its own action creation quality gate hook (equivalent to
  Action 3) targeting its API-based action creation
- Flow needs to decide which review UI interactions use the generic UI
  vs Flow's own app (recommendation: generic for critique/plan review,
  Flow app for work item review)
- Flow's work-tracker-guard.sh phase file needs to guard flow.db tables
  instead of pib.db tables
