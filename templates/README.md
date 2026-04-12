# Claude Cabinet — Template Reference

These are the upstream templates that the `create-claude-cabinet` installer
copies into your project. Everything here mirrors the `.claude/` directory
structure. The installer handles copying, hook merging, and index generation
— you don't need to copy files manually unless you want to.

For the adoption story and user-facing docs, see the root
[README.md](../README.md). For how Flow and other projects extend these
templates, see [EXTENSIONS.md](EXTENSIONS.md).

## What's Here

### Hooks (4)

| Artifact | What It Does |
|----------|-------------|
| `hooks/git-guardrails.sh` | PreToolUse hook that blocks destructive git operations (force push to main, hard reset, git clean). Zero configuration. |
| `hooks/skill-telemetry.sh` | UserPromptSubmit hook that detects /skill-name invocations and logs to JSONL. Configurable via env vars. |
| `hooks/skill-tool-telemetry.sh` | PostToolUse hook that captures programmatic Skill tool invocations. Configurable via env vars. |
| `hooks/cc-upstream-guard.sh` | PreToolUse hook that blocks edits to manifest-tracked upstream files. Prevents downstream drift. |

### Rules (2)

| Artifact | What It Does |
|----------|-------------|
| `rules/enforcement-pipeline.md` | Generic enforcement pipeline: capture, classify, promote, encode, monitor. Describes the compliance stack and promotion criteria. |
| `rules/memory-capture.md` | When and how to capture memories to omega. What to capture, what not to, cadence guidance. |

### Skills (22 workflow + 30 cabinet members)

**Workflow Skills:**

| Skill | What It Does |
|-------|-------------|
| `skills/audit/` | Convene the full cabinet for a quality review. Select members, run structural checks, spawn parallel agents, merge and persist findings. 5 phase files. |
| `skills/cabinet/` | Front door to browse and consult expert cabinet members. Reads from `_index.json`. |
| `skills/cc-upgrade/` | Conversational upgrade when new Claude Cabinet versions arrive. Intelligence is the merge strategy. |
| `skills/debrief/` | Session close. Inventory work, close items, run cabinet consultations, update state, persist, record lessons. 9 phase files. |
| `skills/debrief-quick/` | Quick debrief variant — core phases only, skip presentation. |
| `skills/execute/` | Execute a plan with cabinet member checkpoints. 3-checkpoint protocol (pre-implementation, per-file-group, pre-commit). 5 phase files. |
| `skills/execute-plans/` | Batch execution of multiple plans with conflict detection. |
| `skills/cc-extract/` | Analyze project artifacts and propose upstream extraction candidates for Claude Cabinet. |
| `skills/investigate/` | Structured codebase exploration: frame, observe, hypothesize, test, conclude. |
| `skills/cc-link/` | Set up local development linking for Claude Cabinet source repo work. |
| `skills/memory/` | Browse, search, and manage semantic memory via omega. |
| `skills/menu/` | Dynamically discover and display all available skills. Reads from `_index.json`. |
| `skills/onboard/` | Conversational onboarding. Interviews you, generates briefings, wires the session loop. Re-runnable. 8 phase files. |
| `skills/orient/` | Session start. Load context, sync data, scan work, run health checks, spawn cabinet consultations, show skills menu. 7 phase files. |
| `skills/orient-quick/` | Quick orient variant — core phases only, skip presentation. |
| `skills/plan/` | Structured planning with cabinet critique. Research, overlap check, draft, critique, completeness, present, file. 9 phase files. |
| `skills/cc-publish/` | Publish workflow (CC source repo only, not shipped to consumers). |
| `skills/pulse/` | Self-description accuracy check. Count freshness, dead references, staleness. 3 phase files. |
| `skills/seed/` | Recruit new cabinet members. Detect technology signals, propose expertise, build collaboratively. 4 phase files. |
| `skills/triage-audit/` | Audit finding triage via local web UI or CLI. Load, present, apply verdicts. 3 phase files. |
| `skills/cc-unlink/` | Remove local development linking. Returns to published npm package. |
| `skills/validate/` | Run structural validation checks. Validators defined in phase files. |
| `skills/work-tracker/` | Open the work tracking UI interactively. Starts local server. |

**Cabinet Members (27):**

Generic expert lenses that activate at structured checkpoints. Each is a
domain expert encoded in markdown with frontmatter declaring standing
mandates and scoped directives.

| Cabinet Member | Domain |
|----------------|--------|
| `cabinet-accessibility` | WCAG compliance, keyboard nav, screen reader, focus management |
| `cabinet-anti-confirmation` | Reasoning quality, cognitive bias detection |
| `cabinet-architecture` | System fit, infrastructure leverage, CTO-level evaluation |
| `cabinet-boundary-man` | Implicit guards, silent exclusions, ZOMBIES analysis |
| `cabinet-cc-health` | Claude Cabinet adoption health, configuration drift, anti-bloat |
| `cabinet-data-integrity` | Cross-store consistency, referential integrity, API contracts |
| `cabinet-debugger` | Dependency chains, error modes, environment prerequisites |
| `cabinet-framework-quality` | UI framework utilization, API coverage, anti-patterns |
| `cabinet-goal-alignment` | Strategic purpose alignment, feature-mission fit |
| `cabinet-historian` | Institutional memory, decision archaeology, context preservation |
| `cabinet-information-design` | Spatial composition, visual hierarchy, layout decisions |
| `cabinet-mantine-quality` | Mantine v8 specialist (opt-in pre-built variant) |
| `cabinet-organized-mind` | Levitin's cognitive neuroscience applied to system design |
| `cabinet-process-therapist` | Skill/process effectiveness, overlap/gap analysis |
| `cabinet-qa` | Active testing, acceptance criteria, regression verification |
| `cabinet-record-keeper` | Documentation accuracy, docs-code drift, convention compliance |
| `cabinet-roster-check` | Skill ecosystem strategy, coverage gaps, redundancy |
| `cabinet-security` | Threat model, secrets management, API protection |
| `cabinet-small-screen` | Viewport adaptability, touch targets, responsive layout |
| `cabinet-speed-freak` | Database queries, render efficiency, perceived speed |
| `cabinet-system-advocate` | Feature adoption tracking, capability discoverability |
| `cabinet-technical-debt` | Fowler's debt quadrant, structural sustainability |
| `cabinet-ui-experimentalist` | Bleeding-edge UI patterns, experimental techniques |
| `cabinet-usability` | Interaction model coherence, UX design |
| `cabinet-user-advocate` | End-user perspective, system education |
| `cabinet-vision` | Strategic direction, what the project should become |
| `cabinet-workflow-cop` | Development lifecycle, human burden, guardrail effectiveness |

**Cabinet Infrastructure (8):**

| File | Purpose |
|------|---------|
| `cabinet/committees.yaml` | Upstream committee definitions (ux, code, health, process, strategic). Project customizations go in `committees-project.yaml`. |
| `cabinet/directives-project.yaml` | Template for project-level directive overlay. Extends upstream members with project-specific mandates and directives. |
| `cabinet/composition-patterns.md` | Five patterns for combining cabinet members: parallel, sequential, adversarial, nested, temporal. |
| `cabinet/eval-protocol.md` | Structured assessment framework for evaluating skill/cabinet member effectiveness. |
| `cabinet/lifecycle.md` | When to adopt, retire, and assess cabinet members. |
| `cabinet/output-contract.md` | How cabinet members produce structured findings for the audit system. |
| `cabinet/prompt-guide.md` | Craft knowledge for writing cabinet member prompts. 17 principles. |

### Scripts (12)

| Script | What It Does |
|--------|-------------|
| `scripts/cabinet-memory-adapter.py` | Python adapter for omega memory. Project-scoped tiered retrieval. |
| `scripts/cc-drift-check.cjs` | Compare installed file hashes against manifest. Detect upstream drift. |
| `scripts/finding-schema.json` | JSON Schema for audit finding validation. |
| `scripts/load-triage-history.js` | Build suppression lists from triage history. Tries pib-db first, falls back to filesystem. |
| `scripts/merge-findings.js` | Merge per-cabinet-member JSON outputs into unified run-summary. Optional `--db` flag for pib-db ingestion. |
| `scripts/pib-db.mjs` | Reference data layer CLI. SQLite for work tracking (actions, projects) and audit findings. |
| `scripts/pib-db-schema.sql` | Database schema: projects, actions, audit_runs, audit_findings. |
| `scripts/resolve-committees.cjs` | Merge upstream `committees.yaml` with project `committees-project.yaml`. Deterministic output. |
| `scripts/triage-server.mjs` | Self-contained Node.js HTTP server for triage UI. Zero external dependencies. |
| `scripts/triage-ui.html` | Browser-based triage interface. Dark-themed, severity badges, bulk actions. |
| `scripts/work-tracker-server.mjs` | Self-contained Node.js HTTP server for work tracking UI. |
| `scripts/work-tracker-ui.html` | Browser-based work tracking interface. Projects, actions, filtering. |

### Briefing Templates (6)

| Template | What It Generates |
|----------|-------------------|
| `briefing/_briefing-template.md` | Hub template. Describes all briefing files and the member-to-briefing mapping. |
| `briefing/_briefing-identity-template.md` | Project identity: what it is, core principles, user context. |
| `briefing/_briefing-architecture-template.md` | Tech stack, data stores, deployment. |
| `briefing/_briefing-jurisdictions-template.md` | Directory layout, file ownership, conventions. |
| `briefing/_briefing-cabinet-template.md` | Active members, portfolio rules, invocation patterns. |
| `briefing/_briefing-work-tracking-template.md` | Work tracking setup, query patterns. |
| `briefing/_briefing-api-template.md` | API endpoints, auth, entity types (only if project has an API). |

### Memory (1 pattern + 1 template)

| Artifact | What It Does |
|----------|-------------|
| `memory/patterns/pattern-intelligence-first.md` | Universal principle: use LLM for semantic work, JSON for pipelines, research before coding. |
| `memory/patterns/_pattern-template.md` | Pattern file format for the feedback-to-enforcement pipeline. |

## How to Adopt

### Recommended: use the installer

```bash
npx create-claude-cabinet
```

The CLI walks you through module selection, copies templates, sets up
hooks, generates the skill index, and optionally installs a SQLite work
tracker. Then run `/onboard` in Claude Code for conversational setup.

For non-developers or fresh machines:

```bash
curl -fsSL https://raw.githubusercontent.com/orenmagid/claude-cabinet/main/install.sh | bash
```

### Manual adoption (copy what you need)

If you prefer manual control, copy files from this `templates/` directory
into your project's `.claude/` directory. The minimum viable adoption:

1. Copy `hooks/git-guardrails.sh` to `.claude/hooks/`
2. Add the hook to `.claude/settings.json`
3. Copy `skills/menu/` to `.claude/skills/menu/`

You now have git safety and skill discovery. Add more modules as needed:

- **Session loop:** `skills/orient/`, `skills/debrief/`
- **Planning:** `skills/plan/`, `skills/execute/`
- **Audit:** `skills/audit/`, `skills/pulse/`, `skills/triage-audit/`, plus `cabinet/` infrastructure and `scripts/`
- **Cabinet members:** Copy individual `skills/cabinet-*/` directories for the experts you want

## Configuration

No config files, no YAML DSL, no template engine. Configuration uses:

1. **Briefing files** — Project context that cabinet members read. Fill in
   from the templates. Members reference sections by name.

2. **Phase files** — Project-specific behavior for skeleton skills. Three
   states: absent (use default), `skip: true` (disable), or content
   (override).

3. **Committee overlays** — `committees-project.yaml` extends upstream
   committee definitions. `directives-project.yaml` extends upstream
   member mandates and directives.

4. **Environment variables** — For hooks and scripts. Telemetry hooks read
   `TELEMETRY_DIR`, `TELEMETRY_FILE`. Database scripts read `PIB_DB_PATH`
   (default: `./pib.db`). All have sensible defaults.

## Skill Index

The installer generates `.claude/skills/_index.json` at install time,
caching metadata for all skills: name, description, type (workflow vs
cabinet), standing mandates, scoped directives, and invocability flags.
Consumers (`/menu`, `/cabinet`, orient, debrief, plan, execute,
investigate, seed) read the index instead of scanning individual files.

## Adopting Skeletons: Where Content Goes

### Skeleton SKILL.md (generic, lives in this package)

- Orchestration (the sequence of phases and how they connect)
- Phase protocol (the three-state table)
- Identity (what the skill *is*)
- Generic motivation (why this kind of skill exists)
- Calibration (without/with examples using generic scenarios)

### Phase files (project-specific)

- Operational instructions (what to check, fix, report)
- Specific commands (bash, file paths, API calls)
- Domain logic (rotation tracking, drift detection, etc.)

### The placement test

1. Would a different project need this? -> Skeleton SKILL.md
2. Does it reference specific files, commands, or APIs? -> Phase file
3. Does it help Claude understand the skill but isn't executable? -> Your SKILL.md
4. Does it accumulate over time? -> SKILL.md section, not a phase
