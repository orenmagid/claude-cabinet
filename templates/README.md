# Process-in-a-Box

Generic methodology artifacts extracted from Flow, a cognitive workspace
built on Claude Code. These are the transferable parts of a development
process that emerged from months of iterative building — the patterns
that work regardless of what you're building.

For the full methodology and the reasoning behind these artifacts, see
the [methodology essay](../areas/flow-development/process-in-a-box-methodology.md).

## What's Here

This package contains **Waves 1-7** artifacts. Wave 1 is generic as-is.
Wave 2 parameterizes mixed-extractable artifacts — replacing hardcoded
paths with references to `_context.md` and environment variables. Wave 3
skeletons the session loop — orient and debrief — using the `phases/`
pattern established by validate in Wave 2. Wave 4 skeletons the
compliance stack — enforcement pipeline, plan, and execute. Wave 5
skeletons the audit loop — audit, pulse, triage-audit — with a reference
data layer, perspective infrastructure, and scripts that make the
whole system work out of the box. Wave 6 documents how Flow extends
and will adopt the package — see [EXTENSIONS.md](EXTENSIONS.md) for
annotated phase file overrides, reusable patterns, and perspective
writing examples. Wave 7 adds the lifecycle layer — onboarding,
capability seeding, upgrades, and CoR health monitoring.

Everything is organized to mirror the `.claude/` directory structure, so
adoption is straightforward: copy what you need into your project's
`.claude/` directory.

### Hooks (4)

| Artifact | Wave | What It Does |
|----------|------|-------------|
| `hooks/git-guardrails.sh` | 1 | PreToolUse hook that blocks destructive git operations (force push to main, hard reset, git clean). Zero configuration needed. |
| `hooks/stop-hook.md` | 1 | Template for a Stop event hook that checks whether the session-closing skill ran. Prompt-type (advisory, not blocking). |
| `hooks/skill-telemetry.sh` | 2 | UserPromptSubmit hook that detects /skill-name invocations and logs to JSONL. Configurable via env vars. |
| `hooks/skill-tool-telemetry.sh` | 2 | PostToolUse hook that captures programmatic Skill tool invocations. Configurable via env vars. |

### Rules (1)

| Artifact | Wave | What It Does |
|----------|------|-------------|
| `rules/enforcement-pipeline.md` | 4 | Generic enforcement pipeline: capture → classify → promote → encode → monitor. Describes the compliance stack, enforcement types, promotion criteria. |

### Skills (13)

| Artifact | Wave | What It Does |
|----------|------|-------------|
| `skills/menu/SKILL.md` | 1 | Dynamically discovers and displays all skills by scanning `.claude/skills/*/SKILL.md`. No hardcoded content. |
| `skills/investigate/SKILL.md` | 2 | Structured codebase exploration: frame → observe → hypothesize → test → conclude. Pure methodology, no project-specific content. |
| `skills/validate/SKILL.md` | 2 | **First `phases/` skeleton.** Orchestrates validators and presents a unified summary. Validators defined in `phases/validators.md`. |
| `skills/orient/SKILL.md` | 3 | **Session start skeleton.** Loads context, syncs data, scans work, runs health checks and maintenance, presents briefing. 7 phase files. |
| `skills/debrief/SKILL.md` | 3 | **Session close skeleton.** Inventories work, closes items, updates state, records lessons, captures loose ends. 8 phase files. |
| `skills/plan/SKILL.md` | 4 | **Planning skeleton.** Research, overlap check, draft, perspective critique, completeness check, present, file work item. 7 phase files. |
| `skills/execute/SKILL.md` | 4 | **Execution skeleton.** Load plan, activate perspectives, 3-checkpoint protocol (pre-implementation, per-file-group, pre-commit), validate, verify AC. 5 phase files. |
| `skills/audit/SKILL.md` | 5 | **Audit skeleton.** Select perspectives, fast structural checks, load triage suppression, spawn parallel perspective agents with two-phase protocol, merge and persist findings. 5 phase files. |
| `skills/pulse/SKILL.md` | 5 | **Pulse skeleton.** Self-description accuracy check: count freshness, dead reference spot-check, staleness detection. Two modes: embedded (silent in orient/debrief) and standalone. 3 phase files. |
| `skills/triage-audit/SKILL.md` | 5 | **Triage skeleton.** Load findings, prepare commentary, present via local web UI or CLI, apply verdicts (fix/defer/reject), create actions for approved findings. 3 phase files. |
| `skills/onboard/SKILL.md` | 7 | **Onboarding skeleton.** Conversational interview that generates the initial context layer. Re-runnable: first run generates, subsequent runs refine. 6 phase files. |
| `skills/seed/SKILL.md` | 7 | **Capability seeding skeleton.** Detects technology adoption signals, proposes expertise conversations, builds and maintains perspectives collaboratively. 4 phase files. |
| `skills/cor-upgrade/SKILL.md` | 7 | **Upgrade skeleton.** Conversational merge when new CoR skeletons arrive. Intelligence is the merge strategy — conversation, not mechanical copy. 4 phase files. |

### Scripts (6)

| Artifact | Wave | What It Does |
|----------|------|-------------|
| `scripts/pib-db.js` | 5 | Reference data layer CLI. SQLite database for work tracking (actions, projects) and audit findings. Commands: init, query, create-action, list-actions, create-project, ingest-findings, triage, triage-history. |
| `scripts/pib-db-schema.sql` | 5 | Database schema: projects, actions, audit_runs, audit_findings (with triage status). |
| `scripts/merge-findings.js` | 5 | Merges per-perspective JSON outputs into unified run-summary.json. Optional `--db` flag to ingest into pib-db. |
| `scripts/load-triage-history.js` | 5 | Builds suppression lists from triage history. Tries pib-db first, falls back to filesystem scan. |
| `scripts/triage-server.mjs` | 5 | Self-contained Node.js HTTP server for triage UI. Zero external dependencies. In-memory data shuttle. |
| `scripts/triage-ui.html` | 5 | Browser-based triage interface. Dark-themed, findings grouped by perspective, severity badges, Fix/Defer/Reject/Question verdicts, bulk actions, progress bar. |
| `scripts/finding-schema.json` | 5 | JSON Schema for audit finding validation. |

### Perspectives (15 + 7 infrastructure)

Generic expert lenses that activate at structured checkpoints (planning,
execution, audit). Each is a named domain expert encoded in markdown.

**Wave 1 — generic as-is (8):**

| Perspective | Domain | Activation |
|------------|--------|-----------|
| `anti-confirmation` | Reasoning quality, cognitive bias detection | On high-stakes decisions |
| `boundary-conditions` | Implicit guards, silent exclusions, ZOMBIES analysis | Always-on during execution |
| `debugger` | Dependency chains, environment prereqs, pre-flight investigation | Always-on during execution |
| `mobile-responsiveness` | Viewport adaptability, touch targets, responsive layout | During audits + layout code |
| `organized-mind` | Levitin's cognitive neuroscience applied to system design | During audits + planning |
| `performance` | Database queries, render efficiency, bundle size, perceived speed | During audits |
| `qa` | Active testing, acceptance criteria, regression verification | Always-on during plan + execute |
| `technical-debt` | Fowler's debt quadrant, Beck's four rules, structural sustainability | During audits |

**Wave 2 — parameterized via `_context.md` (6):**

| Perspective | Domain | What's Parameterized |
|------------|--------|---------------------|
| `accessibility` | WCAG compliance, keyboard nav, screen reader, focus management | Scan scope paths, UI framework references |
| `data-integrity` | Cross-store consistency, referential integrity, API contracts | Database paths, entity types, server paths |
| `documentation` | Docs-code drift, convention compliance, CLAUDE.md coverage | File paths, validation scripts, entity types |
| `meta-process` | Skill/perspective effectiveness, overlap/gap analysis | Audit infrastructure paths, prompt guide location |
| `process` | Development lifecycle, human burden, guardrail effectiveness | Deployment platform, sync mechanisms, scheduled tasks |
| `security` | Threat model, secrets management, API protection, deployment security | Server paths, deployment config, secret names |

**Wave 7 — lifecycle (1):**

| Perspective | Domain | Activation |
|------------|--------|-----------|
| `cor-health` | CoR adoption health, phase file coverage, configuration drift, anti-bloat | Always-on during audit |

**Infrastructure files (7):**

| File | Wave | Purpose |
|------|------|---------|
| `_eval-protocol.md` | 1 | Structured assessment framework for evaluating skill/perspective effectiveness |
| `_composition-patterns.md` | 1 | Five patterns for combining perspectives: parallel, sequential, adversarial, nested, temporal |
| `_context-template.md` | 1+2 | Template for the project-specific context file every perspective reads. Wave 2 added: Scan Scopes, API Configuration, Entity Types, User Context. |
| `_prompt-guide.md` | 2 | Craft knowledge for writing perspective prompts. 17 principles including Levitin's cognitive architecture. |
| `output-contract.md` | 5 | How perspectives produce structured findings for the audit system. Defines the assumption/evidence/question triad, severity calibration, positive findings, autoFixable field, JSON output format. |
| `_groups-template.yaml` | 5 | Technology-implied starter groups for organizing perspectives (ux, code, health, process). Copy as `_groups.yaml` and customize. |
| `_lifecycle.md` | 5 | When to adopt, retire, and assess perspectives. Cross-cutting vs grouped distinction. |

### Memory (1 pattern + 1 template)

| Artifact | What It Does |
|----------|-------------|
| `patterns/pattern-intelligence-first.md` | Universal principle: use LLM for semantic work, JSON for pipelines, research before coding |
| `patterns/_pattern-template.md` | The pattern file format itself — frontmatter schema for the feedback-to-enforcement pipeline |

## How to Adopt

### Minimum viable adoption

1. Copy `hooks/git-guardrails.sh` to `.claude/hooks/`
2. Add the hook to your `.claude/settings.json`:
   ```json
   {
     "hooks": {
       "PreToolUse": [{
         "matcher": "Bash",
         "hooks": [{
           "type": "command",
           "command": ".claude/hooks/git-guardrails.sh"
         }]
       }]
     }
   }
   ```
3. Copy `skills/menu/SKILL.md` to `.claude/skills/menu/`

You now have git safety and skill discovery.

### Adding telemetry

1. Copy `hooks/skill-telemetry.sh` and `hooks/skill-tool-telemetry.sh`
   to `.claude/hooks/`
2. Add to your `.claude/settings.json`:
   ```json
   {
     "hooks": {
       "UserPromptSubmit": [{
         "matcher": "",
         "hooks": [{ "type": "command", "command": ".claude/hooks/skill-telemetry.sh" }]
       }],
       "PostToolUse": [{
         "matcher": "Skill",
         "hooks": [{ "type": "command", "command": ".claude/hooks/skill-tool-telemetry.sh" }]
       }]
     }
   }
   ```
3. Optionally set `TELEMETRY_DIR` to control where JSONL records are written
   (defaults to `~/.claude/telemetry/`)

### Adding perspectives

1. Copy `skills/perspectives/` to `.claude/skills/perspectives/`
2. Create your own `_context.md` from `_context-template.md` — fill in
   your project's specifics (scan scopes, data store, entity types, etc.)
3. Wave 2 perspectives reference `_context.md` sections by name — fill in
   the sections relevant to the perspectives you adopt
4. Perspectives are now available for your planning, execution, and audit
   skills to invoke

### Adding the validate skeleton

1. Copy `skills/validate/` (including `phases/`) to `.claude/skills/validate/`
2. Edit `phases/validators.md` — uncomment and adapt the example validators
   for your project's type checker, linter, build step, etc.
3. Run `/validate` to confirm your validators work

This is the first skill using the `phases/` pattern. The skeleton defines
the orchestration; you write your validators in the phase file.

### Guided onboarding (recommended)

Instead of manually copying files, run `/onboard` after copying the
onboard skill. It interviews you about your project, generates the
context layer, wires the session loop, and presents opt-in modules.
Re-run it as your project matures to refine what was generated.

### Adding the session loop (orient + debrief) — manual

1. Copy `skills/orient/` and `skills/debrief/` (including `phases/`)
   to `.claude/skills/orient/` and `.claude/skills/debrief/`
2. Edit the orient phase files:
   - `phases/context.md` — what files and state to read at session start
   - `phases/data-sync.md` — how to sync fresh data (skip if purely local)
   - `phases/work-scan.md` — what work items to check
   - Leave other phase files empty until you need them
3. Edit the debrief phase files:
   - `phases/close-work.md` — how to match and close work items
   - `phases/update-state.md` — what state files to update
   - `phases/record-lessons.md` — how to capture lessons
   - Leave other phase files empty until you need them
4. Add the stop hook (`hooks/stop-hook.md`) to verify debrief ran

Start with context + work-scan + close-work + record-lessons. Add more
phases as your project matures and you discover what decays without them.

To add project-specific phases the skeleton doesn't define, create new
files in `phases/` — each declares when it runs relative to the core
phases. Claude discovers them at runtime.

### Adding the planning/execution workflow

1. Copy `skills/plan/` and `skills/execute/` (including `phases/`)
   to `.claude/skills/plan/` and `.claude/skills/execute/`
2. Edit the plan phase files:
   - `phases/overlap-check.md` — how to search for existing work (skip if
     no work tracker yet)
   - `phases/plan-template.md` — customize your plan sections (or leave
     empty for the default template)
   - `phases/work-tracker.md` — how to file work items
3. Edit the execute phase files:
   - `phases/load-plan.md` — where your plans live (or leave empty if
     plans are always in conversation)
   - `phases/commit-and-deploy.md` — your commit and deploy workflow
   - `phases/validators.md` — what validation to run
   - `phases/verification-tools.md` — tools for checking manual AC
4. Fill in the **Work Tracking** section of your `_context.md`

Start with plan-template + work-tracker + commit-and-deploy. Other phase
files have sensible defaults. To actively suppress a default phase, write
`skip: true` in the file instead of leaving it empty.

### Adding the enforcement pipeline

1. Copy `rules/enforcement-pipeline.md` to `.claude/rules/`
2. Copy `memory/patterns/` to your memory directory

1. Copy `memory/patterns/` to your memory directory
2. Use `_pattern-template.md` as the format for capturing your own
   project's friction patterns
3. Over time, patterns accumulate and some get promoted to rules or hooks

### Adding the audit loop

The audit loop has three skills (audit, pulse, triage-audit), a reference
data layer, and supporting scripts. The design philosophy is "Claude on
Rails" — sensible defaults that work out of the box, easy to override
when you outgrow them.

1. **Initialize the reference data layer:**
   ```bash
   cp process-in-a-box/scripts/pib-db*.* your-project/scripts/
   cd your-project && node scripts/pib-db.js init
   ```
   This creates a local SQLite database for work tracking and audit
   findings. The session loop skills (orient work-scan, debrief close-work,
   plan overlap-check and work-tracker) will use it automatically via
   their default behaviors.

2. **Copy audit skills:**
   ```bash
   cp -r process-in-a-box/skills/audit/ .claude/skills/audit/
   cp -r process-in-a-box/skills/pulse/ .claude/skills/pulse/
   cp -r process-in-a-box/skills/triage-audit/ .claude/skills/triage-audit/
   ```

3. **Copy perspective infrastructure:**
   ```bash
   cp process-in-a-box/skills/perspectives/output-contract.md .claude/skills/perspectives/
   cp process-in-a-box/skills/perspectives/_groups-template.yaml .claude/skills/perspectives/
   cp process-in-a-box/skills/perspectives/_lifecycle.md .claude/skills/perspectives/
   ```

4. **Copy audit scripts:**
   ```bash
   cp process-in-a-box/scripts/merge-findings.js your-project/scripts/
   cp process-in-a-box/scripts/load-triage-history.js your-project/scripts/
   cp process-in-a-box/scripts/triage-server.mjs your-project/scripts/
   cp process-in-a-box/scripts/triage-ui.html your-project/scripts/
   cp process-in-a-box/scripts/finding-schema.json your-project/scripts/
   ```

5. **Set up perspective groups** (optional):
   ```bash
   cp .claude/skills/perspectives/_groups-template.yaml .claude/skills/perspectives/_groups.yaml
   ```
   Uncomment the groups relevant to your project.

6. **Run your first audit:** `/audit` — it discovers perspectives, runs
   them, and persists findings. Then `/triage-audit` to review results.

The reference data layer is designed to be replaced. When your project
outgrows local SQLite (needs a team dashboard, external API, deployed
database), override the relevant phase files in each skill. The phase
file protocol means you replace one piece at a time without touching
the skill orchestration.

## What You and Claude Build Together

The package provides skeletons and infrastructure. You and Claude fill
in the project-specific parts together — Claude helps you write the
phase files, configure perspectives, and set up validators. This is
the working relationship the methodology is built around: the human
provides judgment and domain knowledge, Claude implements, evaluates,
and proposes.

These are the project-specific pieces to build as you adopt:

- **`_context.md`** — Project-specific context that all perspectives read.
  Start from `_context-template.md`. Claude helps you fill in the sections
  relevant to the perspectives you adopt.
- **Orient phase files** — Session startup specifics (what to read, what
  to sync, what work to scan). The skeletons have commented-out examples;
  Claude helps you adapt them for your project.
- **Debrief phase files** — Session close specifics (how to close work,
  what state to update, how to capture lessons). Same pattern — skeletons
  guide, Claude helps implement.
- **Validators** — Edit `skills/validate/phases/validators.md` with your
  project's specific checks. Claude can help identify what to validate.
- **Plan phase files** — Planning specifics (how to check for existing work,
  your plan template, how to file work items). Skeletons have defaults for
  each phase; customize when your project needs something different.
- **Execute phase files** — Execution specifics (where plans live, what
  verification tools to use, how to commit and deploy). Same pattern.

- **Audit phase files** — Audit specifics (which perspectives to run,
  fast structural checks, how to persist findings). Defaults use pib-db
  and the included scripts; customize when your project needs external
  storage or different workflows.
- **Pulse checks** — What self-description accuracy to verify (counts,
  references, staleness). Start empty for defaults; add project-specific
  checks as you discover what drifts.
- **Triage phase files** — Where findings come from, how to present them,
  how to apply verdicts. Defaults use the local triage UI and pib-db.
- **Perspective groups** — Copy `_groups-template.yaml` as `_groups.yaml`
  and uncomment the groups relevant to your technology stack.

None of this requires working alone. Claude is the constant companion
throughout — the package provides the structure, and you build the
specifics together through use.

## Configuration

There is no `box.yaml` or template engine. Configuration uses two mechanisms:

1. **`_context.md`** — For perspectives. Fill in the sections relevant to
   the perspectives you adopt. Perspectives reference sections by name
   (e.g., `_context.md § Data Store`).

2. **`phases/` directories** — For skills. Skeleton SKILL.md defines the
   generic workflow. You write your implementations in phase files. Claude
   reads whatever phase files exist at runtime. All skeleton skills use
   this pattern: validate, orient, debrief, plan, and execute.

   Phase files have **three states**:
   - **Absent or empty** → use the skeleton's default behavior
   - **Contains `skip: true`** → explicitly opt out, skip entirely
   - **Contains content** → custom behavior replaces the default

   This three-state protocol means a new project gets useful behavior
   out of the box, while mature projects can customize or suppress any
   phase. All skeleton skills use this pattern: validate, orient,
   debrief, plan, execute, audit, pulse, triage-audit, onboard, seed,
   and upgrade.

3. **Environment variables** — For hooks and scripts. Telemetry hooks read
   `TELEMETRY_DIR`, `TELEMETRY_FILE`, `DEBUG_LOG`, `SKILL_DIR`. Database
   scripts read `PIB_DB_PATH` (default: `./pib.db`), `REVIEWS_DIR`
   (default: `./reviews`). All have sensible defaults.

## What This Package Does NOT Include

- **Flow-specific skills** — 15 skills deeply specific to Flow's
  architecture (inbox processing, voice capture, deploy verification,
  etc.). The generic patterns (orient, debrief, plan, execute, audit,
  pulse, triage-audit) are included as skeletons. See
  [EXTENSIONS.md](EXTENSIONS.md) for annotated descriptions of these
  skills and the reusable patterns they embody.
- **Flow-specific perspectives** — system-advocate, life-tracker,
  life-optimization, and 19 other perspectives tied to Flow's domain
  (GTD expertise, Mantine quality, sync health, etc.). EXTENSIONS.md
  includes examples showing how to write your own domain perspectives.
- **Distribution mechanism** — No npm package, no installer. Copy files.
  The `/onboard` skill guides adoption. The `/cor-upgrade` skill handles updates.

## Relationship to Flow

Flow is the reference implementation — the project these artifacts were
extracted from. Flow continues using its own copies in `.claude/`. The
package is a standalone extraction that proves these artifacts are
cleanly separable. Flow's specific implementations serve as extension
examples showing what a mature deployment looks like. See
[EXTENSIONS.md](EXTENSIONS.md) for annotated examples of how Flow
extends, overrides, and will adopt the package's skeletons.

## Waves

This package includes all 7 waves of the extraction:

1. **Package generic artifacts** — done (17 artifacts)
2. **Parameterize paths** — done (14 artifacts: telemetry hooks, validate
   skeleton, investigate, prompt guide, 6 parameterized perspectives,
   `_context.md` contract)
3. **Skeleton the session loop** — done (orient + debrief skeletons with
   7 + 8 phase files, custom phase injection for project extensions)
4. **Skeleton the compliance stack** — done (enforcement pipeline rules,
   plan skeleton with 7 phases, execute skeleton with 5 phases, three-state
   phase protocol, `_context.md` Work Tracking section)
5. **Skeleton the audit loop** — done (audit + pulse + triage-audit
   skeletons with 5 + 3 + 3 phase files, reference data layer with SQLite
   for work tracking and audit findings, perspective infrastructure with
   output contract + groups + lifecycle, 7 scripts including triage UI,
   interaction boundary documentation, default phase content using pib-db)
6. **Document extension examples** — done (EXTENSIONS.md with annotated
   Flow phase file overrides, accidentally-generic scan documenting 8
   reusable patterns, perspective writing guide with 3 examples)
7. **Lifecycle layer** — done (onboard skeleton for project adoption with
   3-mode re-runnability, seed skeleton for capability seeding from tech
   signals, upgrade skeleton for conversational box updates, cor-health
   perspective for adoption monitoring, pib-db enhancements: status
   tracking, tags, update-action command, migration logic)

## Adopting Skeletons: Where Content Goes

When you adopt a skeleton — replacing a monolithic skill definition with
the skeleton SKILL.md plus project-specific phase files — use these
placement rules.

### Skeleton SKILL.md (generic, lives in this package)

- Orchestration (the sequence of phases and how they connect)
- Phase protocol (the three-state table)
- Identity (what the skill *is*)
- Generic motivation (why this kind of skill exists — any project
  recognizes the problem)
- Boundary tables (generic: how this skill relates to other skeleton skills)
- Assessment Log section (empty placeholder for runtime accumulation)
- Calibration (without/with examples using generic scenarios)
- Extending instructions (how to add phases, validators, checks)

### Phase files (project-specific)

- Operational instructions (what to check, fix, report)
- Specific commands (bash, file paths, API calls)
- Specific file references (which files to count, verify, scan)
- Domain logic (rotation tracking, drift detection, etc.)
- Cadence and timing (when checks run relative to other steps)

### Your project's SKILL.md (starts as skeleton copy, then extends)

- Project frontmatter (`always-on-for`, project-specific `related`
  entries, `last-verified`)
- Extended boundary tables: skeleton's generic rows PLUS rows for your
  project-specific skills
- Project-specific context that helps Claude understand *your*
  deployment (but NOT operational instructions — those go in phases)

### What stays outside phase files

- **Runtime state** (e.g., `pulse-state.json`) stays alongside the
  skill, not in `phases/`
- **Contextual guidance** (boundary tables, identity) stays in SKILL.md
- **Accumulation sections** (assessment logs) stay in SKILL.md

### The placement test

1. Would a different project need this? → Skeleton SKILL.md
2. Does it reference specific files, commands, or APIs? → Phase file
3. Does it help Claude understand the skill but isn't executable? →
   Your SKILL.md
4. Does it accumulate over time? → SKILL.md section, not a phase
