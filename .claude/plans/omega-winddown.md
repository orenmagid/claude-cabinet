# Plan: Wind Down Omega, Migrate to Built-In Memory (v2 — post-cabinet)

## Problem

CC's `memory` module ships omega-memory as the primary semantic-memory
backend. After ~6 months of use across 8 consumer projects, the system
underperforms on every dimension we adopted it for:

- **Knowledge graph empty in practice.** `omega stats` reports 0 edges
  across 559 memories.
- **Retrieval noisy.** Orient queries return 6/8 hits at 0% similarity;
  cross-project drift dominates.
- **Project keys not normalized.** Same project keyed multiple ways,
  splitting retrieval.
- **Core feature paywalled.** `omega_protocol()` requires OMEGA Pro;
  free-tier sessions get `ModuleNotFoundError` (1.4.3) or a CTA stub
  (1.4.5+).
- **Integration tax recurring.** ONNX SIGSEGV, ESM type:module, hook
  PATH, infinite Stop hook, MCP disconnects, omega-memory-guard
  blocking built-in `.md` writes.

Anthropic's platform direction is markdown-first (May 2026): CLAUDE.md
hierarchy, `.claude/rules/`, auto-memory at
`~/.claude/projects/<slug>/memory/` with MEMORY.md (200-line / 25KB cap
at session start) + topic files (loaded on demand). Subagents get
opt-in persistent memory via `memory: <scope>` frontmatter. This plan
migrates CC and consumers to that model.

## Dissent Recorded (per anti-confirmation critique)

These are positions we sailed past. The plan proceeds anyway, but
honestly:

- **Built-in memory is ~4 weeks old.** We are early adopters of a
  platform feature whose long-term shape is unknown. MIGRATION-0.27.md
  acknowledges this.
- **Rules ≠ episodic memory.** The "in-session immediacy goes in
  `.claude/rules/`" reframe handles normative content ("do X") but
  not episodic content ("last time we tried X, this happened").
  Cross-project episodic recall is genuinely lost in this migration.
  Phase 9 files a deferred-trigger action to monitor for this gap.
- **auto_capture failures will follow us.** "Captured but not applied
  in-turn" is a retrieval/injection problem, not a layer problem.
  Built-in won't fix it. Phase 3's debrief rewrite includes a
  "lessons-applied-to-own-output" scan that's not omega-specific.
- **claude-mem (76k stars) deserved deeper evaluation.** Survey
  research dismissed it for integration tax we accept as plausible
  but didn't independently verify.

If at 60 days post-migration we see 3+ filed observations of
"couldn't find prior context I knew I had," Phase 9's monitor fires
and we revisit (claude-mem, Letta, or a thin semantic layer on top
of topic files).

## Decisions Locked

1. Drop standalone `/remember` slash command. Native conversational
   write path ("just say 'remember X'") already exists in Claude Code
   per [memory docs](https://code.claude.com/docs/en/memory). Document
   that. Ship optional `/cc-remember --topic <topic> <text>` for
   scripted/deterministic capture with explicit override.
2. Wire cabinet-member subagent memory via official `memory: <scope>`
   frontmatter (scope = `project` by default for cabinet members that
   benefit; `user` for those needing cross-project context).
3. Cross-project sharing: **symlinks default** (pick for the user, not
   ask them to choose mechanism). `@imports` documented as footnote.
4. CC version: **v0.27.0**.
5. cc-upgrade pauses and asks, defaulting to dry-run.

## Phase Order (revised)

Phase ordering was changed from v1 to avoid mid-flight gaps where
rewritten skills assume topic files that don't exist yet. Self-migrate
CC's memories *first*, then rewrite the skills against real data.

1. **Phase 1** — Migration tooling
2. **Phase 2** — Self-migrate CC memories (tool-only, no destructive ops)
3. **Phase 3** — Rewrite built-in-aware scaffolding (skills, rules, hooks)
4. **Phase 4** — CLI changes (full `--migrate-memory`, `--unmigrate-memory`,
   orphan sweep, metadata fix, module removal)
5. **Phase 5** — End-to-end self-migration via the full command
6. **Phase 6** — cc-upgrade detection + user-friendly prompts
7. **Phase 7** — Release v0.27.0
8. **Phase 8** — Walk local consumers
9. **Phase 9** — Confidence-period cleanup + retrieval-risk monitor (deferred)

## Implementation

### Phase 1 — Migration Tooling

**1.1. Build `lib/migrate-from-omega.js`**

Exports `migrateFromOmega({ outputDir, dryRun, force })`.

Steps:
- Detect omega venv at `~/.claude-cabinet/omega-venv/bin/omega`. Absent
  → return `{ migrated: 0, reason: 'no-omega' }`.
- **Unfiltered-then-classify export** (per boundary-man #6): run
  `omega export-obsidian --output-dir <tmp>` with no `--project` filter
  first (captures all memories including null-project entries). Then
  read exported `_index.md` + subdirectories. Classify each memory's
  destination per its `project` field:
  - Memory's `project` matches current project slug OR
    `/Users/<user>/<slug>` OR any worktree path under cwd → "this
    project"
  - Memory's `project` is null/empty/missing → "unscoped" (goes to
    `unscoped.md` topic file)
  - Otherwise → "cross-project" (goes to `cross-project.md`)
- **Partitioning algorithm** (per qa #1): type-first, recency-second.
  Map omega types to fixed topic files:
  - `decision` → `decisions.md`
  - `lesson_learned` + `lesson` + `error_pattern` → `lessons.md`
  - `user_preference` → `preferences.md`
  - `constraint` → `constraints.md`
  - `session_summary` + `memory` + `compaction` → `session-summaries.md`
  - `advisor_insight` + `pattern` + `task_completion` → `lessons.md`
  - cross-project memories → `cross-project.md`
  - unscoped memories → `unscoped.md`
  - Unknown type → `lessons.md`
- Within each file, sort by timestamp descending. If any file exceeds
  25KB, split into `<topic>-recent.md` (last 90 days) and
  `<topic>-archive.md` (older).
- Write topic files. Filenames bounded: 4 minimum (decisions, lessons,
  preferences, constraints), 9 maximum (+ session-summaries, cross-project,
  unscoped, 2 split-overflows).
- **MEMORY.md overflow algorithm** (per technical-debt #4, anthropic-insider
  #3): build index with verbose 1-line topic descriptions optimized for
  Claude's discovery ("decisions.md — architectural choices about omega,
  cabinet structure, hook design; consult when revisiting memory or
  cabinet architecture"). If index exceeds 180 lines OR 22KB, group
  topic files under category headings (`## Recent (last 90 days)`,
  `## Reference`, `## Archive`) and list older files by filename only.
  Hard cap: `wc -l MEMORY.md` ≤ 200 AND `wc -c MEMORY.md` ≤ 25000.
- **`autoMemoryDirectory` detection** (per anthropic-insider #4): if
  `~/.claude/settings.json` has `autoMemoryDirectory` set, use that as
  output base. Otherwise default to the platform-derived
  `~/.claude/projects/<slug>/memory/` (slug detection: prefer reading
  it from `/memory` output or existing directory; only synthesize if
  absent).
- **Idempotency**: if `<outputDir>/MEMORY.md` exists with the "Source:
  migrated from omega" preamble, return `{ reason: 'already-migrated' }`
  unless `force: true`.
- Return `{ migrated, topicFiles, indexPath, exportedProjectKeys }`.

**1.2. Build `lib/migration-snapshot.js`** (per workflow-cop #1)

One-shot utility that captures pre-migration state for forensics and
for guiding Phase 4's removal logic:
- Exact contents of omega-related hooks in `~/.claude/settings.json`
  (with file:line refs)
- Exact text of OMEGA block in `~/.claude/CLAUDE.md`
- omega MCP entries in `~/.claude/settings.json`, `~/.claude.json`, and
  any project `.mcp.json`
- `omega stats` output
- list of distinct `project` values in omega DB
- git SHA of `templates/skills/memory/` at snapshot time

Writes to `.claude/plans/omega-winddown-snapshot.json`. Phase 4
references this when stripping hooks/MCP entries (deterministic match
against snapshot, not pattern-guess against live state).

**1.3. Smoke-test**

Dry-run against CC's project:
- Verify counts: `migrated` matches sum across topic files
- All 559-ish memories accounted for (in this-project + cross-project
  + unscoped — none silently lost)
- MEMORY.md within caps (≤200 lines, ≤25KB)
- Each topic file ≤25KB
- Empty-omega-DB case: write minimal MEMORY.md with "no prior memories
  migrated" preamble, return `{ migrated: 0, reason: 'empty-db' }`
  — not an error

### Phase 2 — Self-Migrate CC Memories (Tool-Only)

**2.1. Run migration tool against CC's omega DB**

From repo root: `node -e "require('./lib/migrate-from-omega.js').migrateFromOmega({ dryRun: false })"`

Verify output at `~/.claude/projects/-Users-orenmagid-claude-cabinet/memory/`:
- MEMORY.md exists, within caps
- Topic files reasonable
- Hand-edit ONE bad topic-file classification if found (test the
  human-override path informally)

**2.2. Inspect retrieval quality manually**

Open a fresh session. Ask: "what did we decide about the omega
migration?" → see if Claude finds it via the MEMORY.md index pointer
to `decisions.md`. If not, sharpen the MEMORY.md index entry for
decisions.md.

CC's omega memories are now in built-in. Omega still installed,
hooks still active (we haven't touched them yet) — that's Phase 5.

### Phase 3 — Built-In Memory Scaffolding

Now that CC has real topic files (from Phase 2), the skill rewrites
have something to test against.

**3.1. Rewrite `templates/skills/memory/SKILL.md`** in-place

Drop omega references entirely. New SKILL.md describes:
- Where memory lives (`~/.claude/projects/<slug>/memory/`)
- MEMORY.md as the index, topic files as content
- Built-in conversational capture ("just say 'remember X'")
- Optional `/cc-remember --topic <topic> <text>` for scripted capture
- Mental model section (per user-advocate #5): "The new storage is
  plain markdown you can read and edit."

**3.2. Build `templates/skills/cc-remember/`** (not `/remember`)

Per anthropic-insider #1 — avoid collision with native `/memory` and
the conversational write path. Scope `/cc-remember` to deterministic
scripted capture:
- Accepts `--topic <topic>` flag for explicit user override
- Without `--topic`: keyword classification (deterministic, not LLM
  judgment per qa #2):
  - "decided"/"chose" → decisions
  - "learned"/"discovered" → lessons
  - "prefer"/"always"/"never" → preferences
  - "blocked"/"requires"/"constraint" → constraints
  - "this session"/"today we" → session-summaries
  - "across projects"/"all projects" → cross-project
  - Fallback → lessons
- Echo classification + reasoning to user (per user-advocate #7):
  "Wrote to lessons.md (categorized as a lesson because it describes
  a workflow rule). To override: `/cc-remember --topic decisions
  <text>`."

**3.3. Shared topic-write contract** (per technical-debt #3, new)

Build `scripts/append-to-topic.mjs` — single helper used by
`/cc-remember`, debrief record-lessons, and any future writer.
Exports `appendToTopic({ topic, text, project, date })` that:
- Ensures topic file exists (creates with `# <Topic title>` heading
  if absent)
- Appends under today's date heading (`## YYYY-MM-DD`) — creates
  heading if first entry today
- Updates MEMORY.md index "last updated" if topic file was just
  created or changed scope
- Returns `{ topicFile, dateHeading, byteCount }`

Both `/cc-remember` and debrief's record-lessons call this. No
duplicate file-format logic.

**3.4. Memory format validator** (per technical-debt #7, new)

Add `scripts/validate-memory.mjs` to `templates/scripts/`. Checks:
- `MEMORY.md` exists, ≤200 lines, ≤25KB
- Every topic file referenced in MEMORY.md index exists
- Every topic file under 25KB
- Topic file headings use the agreed `## YYYY-MM-DD` format
- Topic file count in 4-9 range OR index uses category sections

Wired into `templates/skills/validate/phases/validators.md` as a
project-defined validator (gets picked up by `/validate` skeleton).

**3.5. Rewrite orient phases**

- `templates/skills/orient/phases/context.md`: replace omega query
  block. New: "Read `~/.claude/projects/<slug>/memory/MEMORY.md` (or
  `autoMemoryDirectory` if set). For any topic file whose index
  description matches current session focus, read it. The native
  auto-memory system also surfaces relevant memories automatically."
- `templates/skills/orient/phases/auto-maintenance.md`: drop all omega
  consolidate/compact/backup/discover blocks. Replace with brief note:
  "Built-in memory is file-based; no maintenance required. Optionally
  run `node scripts/validate-memory.mjs` periodically to catch format
  drift."
- `templates/skills/orient/SKILL.md`: remove the omega bootstrap
  block in step 1. Keep deployment detection, unmerged branch check,
  LSP plugin check.

**3.6. Rewrite debrief capture phase**

`templates/skills/debrief/phases/record-lessons.md`:
- Drop omega_store guidance.
- New: "For each lesson worth keeping, invoke `appendToTopic()` from
  `scripts/append-to-topic.mjs`. Update MEMORY.md index entry if
  topic file is new or its scope changed."
- Add "lessons applied to own output" scan: before sending debrief
  report, scan it against any lessons captured this session — does
  the report itself violate what was just learned? This addresses
  the substance of `act:f6c4e3cc`'s memory-applied-to-own-output
  piece. **Not omega-specific — same check works under any backend.**

**3.7. Rewrite `templates/.claude/rules/memory-capture.md`**

Drop omega-specific instructions. New content:
- Capture happens via (a) Claude's native auto-memory (conversational),
  (b) `/cc-remember` (scripted), (c) debrief's record-lessons (session-
  end).
- This-turn behavior goes in `.claude/rules/`, not memory.
- Topic-file format defined in `scripts/append-to-topic.mjs`.

**3.8. Cross-project sharing scaffolding** (per user-advocate #4 —
default to symlinks, don't make user choose mechanism)

- New `templates/cabinet/cross-project-rules-README.md` explains both
  patterns and which CC picks.
- Update `templates/skills/onboard/phases/interview.md`: reframe
  question to value-not-mechanism:
  > "You have N CC projects. Want them to share some rules (coding
  > conventions, formatting preferences, etc.)? [1] Yes, edit once
  > and all projects see it (recommended) [2] No, each independent
  > [3] Tell me more"
- Yes → create `~/.claude-cabinet-shared/rules/` if absent, symlink
  from project's `.claude/rules/shared/`.
- "Tell me more" → explain symlinks vs @imports, re-ask.
- Only ask if user has 2+ CC projects in cc-registry. First install
  defers the question.

**3.9. Cabinet-member subagent memory** (per anthropic-insider #2 —
use official `memory:` field)

- Update `templates/skills/cabinet-*/SKILL.md` frontmatter to add
  `memory: project` for members that benefit from persistent memory:
  - **historian** (institutional memory custodian) — `memory: user`
    (cross-project view by design)
  - **record-keeper** (doc accuracy) — `memory: project`
  - **technical-debt** — `memory: project`
  - **goal-alignment** — `memory: project`
  - **anti-confirmation** — `memory: project` (remember prior
    challenges)
- Other 26 members default to no `memory:` field (use parent project
  memory).
- Platform auto-loads, auto-enables Read/Write/Edit, auto-injects
  system prompt instructions. CC just declares the field.
- Document the pattern in `templates/cabinet/_briefing-cabinet.md`.

### Phase 4 — CLI Changes

**4.1. Add `--migrate-memory` subcommand** to `lib/cli.js`

CLI invocation: `npx create-claude-cabinet --migrate-memory [--dry-run]`.
Steps with idempotency state-machine (per boundary-man #1):

1. Read `.ccrc.json.migrated_from_omega`:
   - Object with `state === 'complete'` → exit 0, "already migrated"
   - Object with `state === 'in-progress'` → resume from
     `completedSteps[last] + 1`
   - Absent → fresh run
2. Run `migrationSnapshot()` if snapshot doesn't already exist
3. Write `.ccrc.json.migrated_from_omega = { state: 'in-progress',
   startedAt: <ISO>, completedSteps: [] }` (via merge-preserving
   `metadata.write()`, see 4.2)
4. **Backup** `~/.claude/CLAUDE.md` to
   `~/.claude-cabinet/migration-backup-<ISO>/CLAUDE.md`
5. **Backup** `~/.claude/settings.json` to backup dir
6. **Backup** `~/.claude.json` (if exists) to backup dir
7. **Backup** project `.mcp.json` (if has omega entry) to backup dir
8. Write `~/.claude-cabinet/migration-backup-<ISO>/ROLLBACK.md`
   describing how to restore (per user-advocate #6)
9. Run `migrateFromOmega()` to write topic files
10. Disable omega hooks in `~/.claude/settings.json` — use the
    snapshot's exact entries, not pattern-guess
11. **Strip OMEGA block from `~/.claude/CLAUDE.md`** with validation:
    - Require exactly one `<!-- OMEGA:BEGIN ` AND exactly one
      `<!-- OMEGA:END -->` marker
    - If validation fails: skip with message "OMEGA block markers
      malformed in `~/.claude/CLAUDE.md`. Remove manually. See
      backup for original." Don't guess.
12. **Remove omega MCP server registration** from ALL THREE locations
    (per anthropic-insider + boundary-man):
    - `~/.claude/settings.json` (where CC's omega-setup.js wrote it)
    - `~/.claude.json` (Claude Code primary user config)
    - project `.mcp.json` (if present and has omega entry)
13. **Also add omega to `~/.claude/settings.json.disabledMcpjsonServers`**
    (per anthropic-insider #7) so re-installation of omega-memory
    package elsewhere doesn't auto-re-register
14. Remove project's `omega-memory-guard.sh` hook from project's
    `.claude/settings.json` if present
15. **Remove project's `.claude/skills/memory/`** with version-anchored
    hash check (per boundary-man #5): compare each file's current SHA
    against the SHA in the CC version recorded in their `.ccrc.json`.
    If untouched, remove; if customized, leave with one-time warning
    in MIGRATION-0.27.md telling user to manually delete or rewrite.
16. Set `.ccrc.json.migrated_from_omega = { state: 'complete',
    date: <ISO>, version: '0.27.0', backupDir: '~/.claude-cabinet/...',
    snapshotPath: '...' }`
17. Print summary

Each step 4-15 individually idempotent (own "is this already done?"
check) so resume after `Ctrl-C` works.

**Note:** `--migrate-memory` does NOT delete the omega venv or DB.
That's Phase 9 (deferred-trigger gated).

**4.2. Fix `lib/metadata.js`** (per boundary-man #2)

`metadata.write()` currently overwrites. Change to:
- Read existing `.ccrc.json` if present
- Merge new fields, preserving any unknown top-level keys
- Write the merged result

This protects `migrated_from_omega` (and any future field) from being
silently destroyed by subsequent CC installs.

**4.3. Add `--unmigrate-memory` subcommand** (per user-advocate #6)

`npx create-claude-cabinet --unmigrate-memory`:
- Reads `.ccrc.json.migrated_from_omega.backupDir`
- Restores `~/.claude/CLAUDE.md`, `~/.claude/settings.json`,
  `~/.claude.json`, project `.mcp.json` from backups
- Resets `.ccrc.json.migrated_from_omega.state = 'rolled-back'`
- Does NOT delete the migrated topic files (user can keep them, the
  omega DB still has the source data, this is reversible)
- Prints: "Rolled back. Omega should be functional again on next
  session start. Topic files at ~/.claude/projects/.../memory/
  preserved (delete manually if desired)."

**4.4. Remove memory module from MODULES + dead-file deletions**

In `lib/cli.js`:
- Remove `'memory'` entry from MODULES (line 446-453)
- Remove `const { setupOmega } = require('./omega-setup')` (line 10)
- Remove `--- Set up omega memory ---` block (line 1028-1037)
- Remove `includeMemory` branch (line 981)
- Update `--modules` help text to drop `memory`

Delete:
- `lib/omega-setup.js`
- `scripts/cabinet-memory-adapter.py`
- `scripts/migrate-memory-to-omega.py`
- `templates/.claude/hooks/omega-memory-guard.sh`

**4.5. Update `lib/settings-merge.js`**

- Remove `MEMORY_HOOKS` constant (lines 4-15)
- Remove `MEMORY_HOOKS` from module.exports (line 234)
- Remove `includeMemory` parameter + branch from `mergeSettings()`
- Keep legacy cleanup block (handles old v0.9.x hooks)
- **Add omega-era hook cleanup** to the SAME centralized cleanup
  function (per technical-debt #2): so a consumer who doesn't run
  `--migrate-memory` but does any other CC operation gets omega
  hooks stripped automatically. Removes "two cleanup paths" debt.

**4.6. Orphan reference sweep** (per technical-debt #1, new)

- Delete `templates/hooks/domain-memories.sh` (line 18: hardcoded
  OMEGA_BIN). Remove from `DEFAULT_HOOKS` in settings-merge.js.
- Rewrite `templates/skills/cabinet-historian/SKILL.md`: drop omega
  blocks (lines 83-152), replace with built-in memory tier description.
- Rewrite `templates/skills/cabinet-cc-health/SKILL.md`: replace
  omega-venv/adapter/ONNX validation block (lines 394-431) with
  validator for new MEMORY.md/topic-file layout (delegate to
  `scripts/validate-memory.mjs` from 3.4).
- Update `templates/skills/onboard/phases/detect-state.md` line 52:
  drop omega detection row.
- Update `templates/README.md` lines 28, 46, 112: drop omega refs from
  installer descriptions.
- **AC**: `grep -r 'omega' templates/ lib/ scripts/` returns 0 matches
  outside MIGRATION-0.27.md and changelog comments.

**4.7. Mark migration code for sunset** (per technical-debt #6)

Add JSDoc to `lib/migrate-from-omega.js` and any one-time migration
helpers: `@deprecated Remove after v1.0.0 — one-time migration for
v0.27.0 omega removal.`

File a deferred-trigger action: "Fires when CC reaches v1.0.0 — remove
all `@deprecated` migration code."

### Phase 5 — End-to-End Self-Migration via Full Command

**5.1. Pre-flight: close concurrent Claude Code sessions** (per
workflow-cop #5)

Print warning: "About to mutate `~/.claude/settings.json` and
`~/.claude/CLAUDE.md` (global state). Any other Claude Code session
running on this machine will get inconsistent state until restarted.
Confirm no other sessions are active. Continue? (y/N)"

**5.2. Dry-run, then real run**

- `node bin/create-claude-cabinet.js --migrate-memory --dry-run` —
  inspect output
- `node bin/create-claude-cabinet.js --migrate-memory` — real
- Verify:
  - `.ccrc.json.migrated_from_omega.state === 'complete'`
  - Backup dir exists with ROLLBACK.md
  - `~/.claude/CLAUDE.md` OMEGA block stripped (verify with grep)
  - `~/.claude/settings.json` omega hooks absent
  - omega entries removed from MCP config files
  - `disabledMcpjsonServers` includes omega
  - Topic files match Phase 2 output (no re-migration needed)
- Run `/orient-quick` in fresh session, verify:
  - Completes <30s without error
  - No "omega", "ModuleNotFoundError", "OMEGA Pro" in output
  - Briefing references MEMORY.md as memory source

**5.3. Commit**

Commit Phase 1-5 changes to CC repo. Validate passes.

### Phase 6 — cc-upgrade Detection

**6.1. Update `/cc-upgrade` skill**

Detection logic (deterministic, per qa #6):
```
detectOmega() = ANY of:
  - .ccrc.json modules includes "memory"
  - ~/.claude-cabinet/omega-venv/ exists
  - ~/.claude/settings.json hooks include command matching /fast_hook/
  - ~/.claude.json or ~/.claude/settings.json mcpServers includes "omega"
```

If detected, present user-friendly prompt (per user-advocate #1):
```
CC's memory module is changing in v0.27.0.

What you have now: an omega-memory database with N entries.
(omega-memory is a Python-based semantic memory engine CC used
to ship.)

What's replacing it: Claude Code's built-in memory at
~/.claude/projects/<slug>/memory/. No Python, no daemon, no paywall.
Your N entries become markdown topic files.

[1] Show me what would change (dry-run) — default
[2] Migrate now
[3] Skip — leave omega running for now
```

Default action: dry-run. "yes" → real migration. "skip" → cc-upgrade
continues; omega stays running; user can migrate later via
`npx create-claude-cabinet@latest --migrate-memory`.

### Phase 7 — Release v0.27.0

**7.1. Write `MIGRATION-0.27.md`** (per user-advocate #2 — user-centric
framing)

Structure around questions:
- **Do I need to do anything?** (lead — answer: probably one command)
- **What about my old memories?** (preserved as markdown — reassuring,
  in first 3 lines)
- **What will I notice change?** (auto-memory replaces omega tools,
  `/cc-remember` replaces omega_store, no more Python venv)
- **What if something goes wrong?** (`--unmigrate-memory`, backup dir
  location, ROLLBACK.md)
- **What if I never used omega?** (empty-DB case — migration is safe,
  fast, gives you a clean memory dir baseline)
- **Forward-compatibility note** (per anthropic-insider #6): built-in
  memory is recent; structure is compatible with future Anthropic
  Dreams consolidation if it comes to Claude Code
- **Why the change?** (curious users — paragraph, last)
- **Appendix: what the migration script does, step by step** (the
  9 internal steps, in audit-trail form, for technical readers)

**7.2. Close obsolete feedback items** (per workflow-cop #7)

Move these to `feedback/triaged/` with `_resolution.md` noting
"obsoleted by v0.27.0 omega removal":
- `feedback/2026-04-16-omega-auto-capture-hook-may-not-be-firing-during-long-sessio-3.md`
- `feedback/2026-04-20-omega-protocol-errors-every-session-no-module-named-omega-protocol-33.md`
- `feedback/2026-04-17-memory-stored-in-debrief-not-applied-to-the-debrief-s-own-ou-20.md`
  (partially resolved by Phase 3.6's "lessons-applied" scan)

Close pib-db actions:
- `act:b8f1035a` ("Omega long-session auto_capture observability") →
  won't-fix
- `act:f6c4e3cc` ("Debrief phase discipline: BLOCKING + memory-applied")
  → split: memory-applied piece superseded by Phase 3.6; BLOCKING
  cabinet consultations piece becomes its own action (keep open).

**7.3. Run `/cc-publish` for v0.27.0**

- Pre-publish: validate, dogfood install works
- Release order (per workflow-cop #2): version bump → commit → tag →
  push tag → npm publish (publish *last* — unyankable)
- Recovery: if npm publish fails after tagging, `git tag -d` + retry
- Release notes point at MIGRATION-0.27.md

### Phase 8 — Walk Local Consumers

**8.1. Clean cc-registry** (per workflow-cop #3 + boundary-man #10)

Before any walk:
- Remove `/Users/orenmagid` entry from `~/.claude/cc-registry.json`
  (home dir; not a valid consumer)
- Verify remaining 7 paths exist

**8.2. Build `lib/migrate-all-consumers.js`** (CC-source-only)

Iterates `~/.claude/cc-registry.json`:
- For each project path:
  - **REFUSE if path == `os.homedir()` or any ancestor** (per
    boundary-man #10)
  - Skip if path doesn't exist (log + report at end)
  - Skip if `.ccrc.json.migrated_from_omega.state === 'complete'`
  - Show dry-run output
  - Pause for y/n confirm
  - Real run on yes
- **Batched confirms** (per workflow-cop #3): mode for "show me all
  3 dry-runs together, then approve as batch" — `--batch 3` flag —
  reduces decision count
- Writes `walk-state.json` after each consumer (`{ consumer, status,
  timestamp, hashMismatches[] }`) so resume across sessions is clean
- End-of-walk report: migrated/skipped/failed categorization, total
  = registry size

**8.3. Execute walk** (manual operator session)

Filed as separate action. Operator runs `node lib/migrate-all-consumers.js
[--batch 3]`. Realistically 60-90 minutes for 7 consumers.

### Phase 9 — Confidence Period + Retrieval-Risk Monitor (Deferred)

**9.1. Cleanup action** (deferred-trigger gated, per workflow-cop #4)

Trigger condition: fires when ALL of:
- 14+ days elapsed since v0.27.0 release
- ≥4 of 7 consumers have run at least one `/orient` or `/debrief`
  post-migration (verified via cc-registry `updatedAt` or session
  artifacts)
- No audit finding or feedback file mentions "memory", "omega",
  or "migration" in trailing 14 days

When trigger fires:
- Archive `~/.omega/omega.db` to `~/.omega/omega.db.archive-<date>`
- Delete `~/.claude-cabinet/omega-venv/`
- Uninstall `omega-memory` package if nothing else uses it
- Set `.ccrc.json.migrated_from_omega.state = 'sunset'`

**9.2. Retrieval-risk monitor action** (deferred-trigger gated, per
anti-confirmation challenge)

Trigger condition: fires if 3+ filed observations report "couldn't
find prior context I knew I had" OR "captured X but agent ignored X"
within 60 days post-migration.

When trigger fires: revisit memory architecture (claude-mem deeper
eval, Letta, or thin semantic layer over topic files). Don't auto-
revert — file a new plan.

**9.3. Migration code sunset action** (deferred-trigger gated)

Trigger: fires when CC reaches v1.0.0.

When trigger fires: remove all `@deprecated` migration code
(`lib/migrate-from-omega.js`, `lib/migration-snapshot.js`,
`lib/migrate-all-consumers.js`, `--migrate-memory`,
`--unmigrate-memory`).

## Surface Area

- files: lib/cli.js
- files: lib/omega-setup.js (deleted)
- files: lib/settings-merge.js
- files: lib/metadata.js
- files: lib/migrate-from-omega.js (new)
- files: lib/migrate-all-consumers.js (new)
- files: lib/migration-snapshot.js (new)
- files: scripts/cabinet-memory-adapter.py (deleted)
- files: scripts/migrate-memory-to-omega.py (deleted)
- files: scripts/append-to-topic.mjs (new)
- files: scripts/validate-memory.mjs (new)
- files: templates/skills/memory/SKILL.md
- files: templates/skills/cc-remember/SKILL.md (new)
- files: templates/skills/orient/SKILL.md
- files: templates/skills/orient/phases/context.md
- files: templates/skills/orient/phases/auto-maintenance.md
- files: templates/skills/debrief/phases/record-lessons.md
- files: templates/skills/onboard/phases/interview.md
- files: templates/skills/cc-upgrade/SKILL.md
- files: templates/skills/cabinet-historian/SKILL.md
- files: templates/skills/cabinet-cc-health/SKILL.md
- files: templates/skills/cabinet-record-keeper/SKILL.md
- files: templates/skills/cabinet-technical-debt/SKILL.md
- files: templates/skills/cabinet-goal-alignment/SKILL.md
- files: templates/skills/cabinet-anti-confirmation/SKILL.md
- files: templates/skills/onboard/phases/detect-state.md
- files: templates/skills/validate/phases/validators.md
- files: templates/.claude/rules/memory-capture.md
- files: templates/.claude/hooks/omega-memory-guard.sh (deleted)
- files: templates/hooks/domain-memories.sh (deleted)
- files: templates/cabinet/cross-project-rules-README.md (new)
- files: templates/cabinet/_briefing-cabinet.md
- files: templates/README.md
- files: MIGRATION-0.27.md (new)
- files: package.json
- dirs: templates/skills/memory/
- dirs: ~/.claude-cabinet/migration-backup-<ISO>/ (runtime, per-consumer)

## Acceptance Criteria (per action)

### Phase 1
**1.1 migrate-from-omega.js**
- [auto] `node -e "require('./lib/migrate-from-omega.js').migrateFromOmega({dryRun: true})"` runs without throwing
- [auto] Empty omega-DB case returns `{ migrated: 0, reason: 'empty-db' }`, not an error
- [auto] Returned `migrated` equals sum of memories across topic files (no silent loss)
- [auto] Generated MEMORY.md: `wc -l` ≤ 200 AND `wc -c` ≤ 25000
- [auto] No single topic file > 25KB
- [auto] Topic file count in 4-9 range
- [auto] `autoMemoryDirectory` setting respected if present

**1.2 migration-snapshot.js**
- [auto] Produces JSON with non-null entries for hooks, MCP, OMEGA block, project keys
- [auto] git SHA matches `git rev-parse HEAD:templates/skills/memory/`

**1.3 smoke test**
- [manual] On CC: total memories in output ≥ 100 (claude-cabinet had ~114)
- [manual] No memory present in omega export is missing from topic files (hash check)

### Phase 2
- [manual] `~/.claude/projects/-Users-orenmagid-claude-cabinet/memory/MEMORY.md` exists, indices look discoverable
- [manual] Fresh-session query "what did we decide about omega migration?" surfaces decisions.md
- [auto] Omega still functional (hooks intact, MCP connected) — destructive ops not yet attempted

### Phase 3
**3.1 memory SKILL.md** — [auto] `grep -c "omega_\|omega-memory\|fast_hook" templates/skills/memory/SKILL.md` = 0
**3.2 /cc-remember** — [auto] each of 6 fixture inputs writes to expected topic file by keyword classifier
**3.3 append-to-topic.mjs** — [auto] Both `/cc-remember` and debrief record-lessons import from same module (grep verification)
**3.4 validator** — [auto] `node scripts/validate-memory.mjs` against CC's MEMORY.md exits 0
**3.5 orient phases** — [auto] `grep -c "omega" templates/skills/orient/phases/*.md` = 0
**3.6 debrief** — [auto] `grep -c "omega" templates/skills/debrief/phases/record-lessons.md` = 0; [manual] "lessons-applied" scan triggers on test fixture
**3.7 memory-capture.md** — [auto] `grep -c "omega" templates/.claude/rules/memory-capture.md` = 0
**3.8 onboard cross-project** — [manual] onboarding asks the value-framed question only if cc-registry has 2+ consumers; default selection works
**3.9 cabinet memory** — [auto] 6 named cabinet members have `memory:` frontmatter set; other 25 don't

### Phase 4
**4.1 --migrate-memory** — [auto] Subcommand prints help; [manual] mid-run Ctrl-C followed by re-run completes cleanly; [auto] runs idempotently (second run exits 0 with "already migrated")
**4.2 metadata.js** — [auto] Unit test: write `{ foo: 1, migrated_from_omega: {} }`, call createMetadata, verify both keys still present
**4.3 --unmigrate-memory** — [manual] After migration, --unmigrate restores `~/.claude/CLAUDE.md` and `~/.claude/settings.json` to backup state
**4.4 dead-file deletion** — [auto] Deleted files don't exist; [auto] `node -c lib/cli.js` passes
**4.5 settings-merge** — [auto] `MEMORY_HOOKS` not in exports; [auto] omega hook cleanup runs on every install
**4.6 orphan sweep** — [auto] `grep -r 'omega' templates/ lib/ scripts/ | grep -v MIGRATION-0.27.md | grep -v "changelog\|comment"` returns 0 matches
**4.7 sunset markers** — [auto] All migration modules have `@deprecated` JSDoc

### Phase 5
**5.1 pre-flight** — [manual] Warning displayed; abort on "N"
**5.2 end-to-end** — [auto] `.ccrc.json.migrated_from_omega.state === 'complete'`; [auto] `grep "OMEGA:" ~/.claude/CLAUDE.md` returns 0; [auto] `jq '.mcpServers.omega' ~/.claude.json ~/.claude/settings.json` returns null in both; [manual] /orient-quick clean
**5.3 commit** — [auto] `git status` clean after commit; CC validate passes

### Phase 6
**6.1 cc-upgrade detection** — [auto] `detectOmega()` true on fixture with each of the 4 signals individually; false on clean fixture; [manual] Default option is dry-run

### Phase 7
**7.1 MIGRATION-0.27.md** — [auto] Contains sections "Do I need to do anything?", "What about my old memories?", "What if something goes wrong?", "What if I never used omega?"
**7.2 close feedback** — [auto] 3 feedback files moved to feedback/triaged/; resolution files written
**7.3 cc-publish** — [deferred] v0.27.0 on npm; git tag matches; non-yankable

### Phase 8
**8.1 registry clean** — [auto] `/Users/orenmagid` not in cc-registry.json
**8.2 migrate-all-consumers.js** — [auto] Refuses `os.homedir()` paths; [auto] walk-state.json updates after each consumer
**8.3 execute walk** — [manual] All non-home consumers either migrated successfully, skipped with documented reason, or failed with actionable error; no `.claude/skills/memory/` blown away when customized

### Phase 9
- [deferred] Trigger conditions evaluated weekly during orient (deferred-check phase)
- [deferred] Cleanup runs after trigger fires; venv/DB archived

## Verify Plan

N/A — tooling + scaffolding migration, no UI changes, no
`e2e/features/` scenarios to update.

## Defer Annotations (post-execution follow-ups)

These items from cabinet critique are not in scope for execution but
are filed as project notes:

- **claude-mem deeper evaluation** — anti-confirmation challenge.
  Defer until Phase 9.2 trigger fires (if it does).
- **Phase 7 fatigue mitigation beyond batching** — if 60-90 min
  walk is too much, split across 2 sessions.
- **Topic file format hardening over time** — if validator catches
  drift, tighten the format spec rather than ad-hoc fixing.

## Files To Close As Obsoleted

Handled in Phase 7.2 above.
