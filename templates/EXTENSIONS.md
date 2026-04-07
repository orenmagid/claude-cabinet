# Extension Examples: How Flow Uses Claude Cabinet

Claude Cabinet (CC) gives you skeletons. Your project fills them in via phase files —
replacing defaults with project-specific behavior, adding custom phases
the skeleton doesn't define. This document shows what that looks like
in practice, using Flow (CC's reference implementation) as the example.

Flow is a cognitive workspace built on Claude Code — a GTD system,
research thread manager, and course management tool. It has a deployed
web app (Railway), a local SQLite cache, research threads, an inbox
pipeline, and 25+ skills. It's what happens when a project grows past
CC's defaults while staying on CC's rails.

You and Claude will make different choices for your project. These
examples show what choices Flow made and why — not what you should do,
but what's possible.


## Flow's Phase File Overrides by Skill

For each skeleton skill, the tables show: which CC phase files Flow
overrides (replacing default behavior with Flow-specific content), and
which custom phase files Flow adds (concerns CC doesn't define).

Phase file states: **default** = CC's behavior is fine, no override
needed. **override** = Flow writes its own content. **custom** = Flow
adds a phase CC doesn't have. **skip** = Flow actively opts out.

### orient

CC's orient skeleton loads context, syncs data, scans work, checks
health, and presents a briefing. Flow's orient is its most complex
skill — 47 steps managing a deployed app, research threads, an inbox
pipeline, and multiple always-on cabinet members.

| Phase | CC Default | Flow Override |
|---|---|---|
| `context.md` | Read status files | `system-status.md`, 7 research threads (`thread.yaml` + `CLAUDE.md`), `MEMORY.md` index, active course syllabi |
| `data-sync.md` | Skip | DB pull from Railway (`sync-db-to-railway.sh --pull`). Report failure but don't block. |
| `work-scan.md` | Query pib-db for open actions | Inbox counts via API, open plans in Flow Dev folder, deferred triggers evaluation, stale articulation questions, unactioned audit findings, Needs Review projects |
| `health-checks.md` | Empty | Skill staleness (last-verified > 30d), telemetry compliance, LaunchAgent health |
| `auto-maintenance.md` | Empty | Morning briefing timestamp, cleanup stale locks |
| `cabinet.md` | Empty | Always-on: life-tracker, debugger, system-advocate, life-optimization |
| `briefing.md` | Present summary | Time-aware format: full briefing (morning), abbreviated (afternoon), minimal (quick variant) |

**Custom phases Flow adds:**

| Custom Phase | What It Does |
|---|---|
| `command-queue.md` | Fetch and process pending commands from the Flow app UI (re-prep, delete, re-articulate) |
| `articulation-sweep.md` | Process `pending-question` actions (follow-ups), then scan for vague candidates (capped at 3) |
| `prep-scout-sweep.md` | Auto-prep unprepped actions due within 7 days (capped at 3) |
| `feature-spotlight.md` | System advocate's adoption ladder — surface one underused feature per session |

**Why so many custom phases:** Flow's orient does operational maintenance
that most projects won't need early on. The command queue, articulation,
and prep scout are features that emerged from months of use. A new project
would start with just `context.md` and `work-scan.md` overrides and add
custom phases as concerns emerge.

### debrief

CC's debrief skeleton inventories work, closes items, updates state,
records lessons, and captures loose ends. Flow's debrief is the second
most complex skill — it resolves feedback comments, runs prep scout and
articulation sweeps, checks machine-level drift, and enforces QA gates.

| Phase | CC Default | Flow Override |
|---|---|---|
| `inventory.md` | Scan git log + conversation | Same approach, plus check for uncommitted work, unresolved preview tool sessions |
| `close-work.md` | Match session work against pib-db actions | Match against Railway API actions. QA cabinet member gate: actions can't be marked complete if QA report shows failures. Project auto-completion scan. |
| `auto-maintenance.md` | Empty | Commit + push changes, pull fresh DB after mutations |
| `update-state.md` | Update status files | Update `system-status.md` build log, move PLANNED items to COMPLETED |
| `health-checks.md` | Empty | Machine setup drift (LaunchAgents, hooks, env vars), telemetry compliance |
| `record-lessons.md` | Save to memory | Historian cabinet member (always activated) records lessons, updates memory patterns, prevents knowledge loss |
| `loose-ends.md` | Capture to inbox | Life-tracker cabinet member (always activated) sweeps for non-dev loose ends. Inbox routing via API. |
| `report.md` | Present summary | Evening preview if after 5pm, offer to archive conversation |

**Custom phases Flow adds:**

| Custom Phase | What It Does |
|---|---|
| `feedback-resolution.md` | Scan system-feedback comments, resolve ones addressed by session work |
| `prep-scout-sweep.md` | Same as orient — runs again at session close for newly relevant actions |
| `articulation-sweep.md` | Same as orient — process follow-ups, scan for new vague candidates |
| `project-completion.md` | Check if any projects have all actions completed, prompt for project close |

**Key pattern:** Flow's debrief has *mandatory cabinet members* — historian
and life-tracker always activate. In CC's skeleton, cabinet members are
optional (the `cabinet.md` phase can be empty). Flow overrides this
by listing required cabinet members in its close-work and loose-ends phases.

### validate

CC's validate skeleton runs validators from a single phase file. Flow
overrides with 8 specific validators.

| Phase | CC Default | Flow Override |
|---|---|---|
| `validators.md` | Commented-out examples | 8 validators: fid coverage (`validate-fids.sh`), thread structure (`validate-threads.sh`), folder integrity (`validate-folders.sh`), MEMORY.md references, TypeScript (`npx tsc --noEmit`), Vite build (`npx vite build`), ESLint (`npx eslint`), Mantine import check |

**No custom phases.** Validate is the simplest skeleton — one phase file
does the job. Flow just fills in its specific checks.

### plan

CC's plan skeleton researches, checks overlap, drafts with template,
runs cabinet critique, checks completeness, presents, and files work.
Flow's plan adds a design committee pattern and specific work tracking.

| Phase | CC Default | Flow Override |
|---|---|---|
| `research.md` | Explore codebase | Same, plus check ecosystem memory (`reference-skill-ecosystem.md`) for prior art |
| `overlap-check.md` | Query pib-db | Query Railway DB via sqlite3 on local cache. Check open actions + recent completed. |
| `plan-template.md` | Generic sections | Flow template: Context, Approach, Surface Area (files grouped), Acceptance Criteria with `[auto]`/`[manual]`/`[deferred]` tags, Risk assessment |
| `cabinet-critique.md` | Activate relevant cabinet members | QA always-on. Design committee (information-design + usability) for UI plans with HTML mock generation. |
| `completeness-check.md` | Review for gaps | Same default behavior |
| `present.md` | Show plan for approval | Same, plus offer to post to Flow app's Review Plan view for async review |
| `work-tracker.md` | Create pib-db action | POST to Railway API. Default project: Flow Development (`prj:5740e09b`). Deferred folder: `fld:3557e5b4`. |

**Custom phases Flow adds:**

| Custom Phase | What It Does |
|---|---|
| `design-committee.md` | For UI plans: spawn information-design + usability cabinet members, generate HTML mock, iterate before coding |

### execute

CC's execute skeleton loads the plan, activates cabinet members, implements
with checkpoints, validates, and commits. Flow adds QA enforcement and
design mock verification.

| Phase | CC Default | Flow Override |
|---|---|---|
| `load-plan.md` | Read plan from conversation or file | Same, plus check for design mocks in action notes (`mock_path`) and `.claude/mocks/` |
| `cabinet.md` | Activate relevant cabinet members | QA always-on. Boundary-man always-on. Others per plan's surface area. |
| `validators.md` | Run project validators | Delegates to `/validate` skill |
| `verification-tools.md` | Empty | Preview tool for manual AC verification. `[manual]` criteria MUST use preview tools — only legitimately untestable items get `[needs-user]` tag. |
| `commit-and-deploy.md` | Git commit | Classify changes (markdown-only vs code vs mixed). Markdown: `git push` (webhook pulls). Code: `git push` + `railway up`. Verify deploy via `/verify-deploy`. |

**Key pattern:** Flow's execute enforces a QA gate — the QA cabinet member
produces a verification report at checkpoint 3, and debrief won't mark
actions complete if QA shows failures. This is the "mandatory cabinet member"
pattern: a cabinet member that's advisory in CC becomes load-bearing in Flow.

### audit

CC's audit skeleton selects cabinet members, runs structural checks, loads
triage suppression, spawns cabinet member agents, and persists findings.
Flow overrides the data layer and execution model.

| Phase | CC Default | Flow Override |
|---|---|---|
| `member-selection.md` | Discover from SKILL.md files, use committees | Same discovery, but 21 additional domain cabinet members available |
| `structural-checks.md` | Run fast structural scripts | Same validators as `/validate`, run before LLM analysis |
| `triage-history.md` | Load from pib-db or filesystem | Load from Railway DB via API (`GET /api/audit/findings?status=deferred`) |
| `member-execution.md` | Spawn parallel subprocess agents | Nested Agent tool calls (same session context). Two-phase protocol: explore thoroughly, then rank top 5-8 findings. |
| `finding-output.md` | Merge to JSON, optionally ingest to pib-db | POST findings to Railway API (`POST /api/audit/findings`). Per-cabinet-member JSON files also saved locally. |

**Custom phases Flow adds:**

| Custom Phase | What It Does |
|---|---|
| `triage.md` | Programmatic triage of findings via Railway API PATCH endpoint (approve/reject/defer) |
| `next-steps.md` | Offer quick-fix, /plan, or bulk triage based on findings after output |

**Why nested agents instead of subprocesses:** CC's default uses
`claude --print` for parallel cabinet member execution. Flow found that
subprocess spawning creates API concurrency errors during active
sessions. Nested Agent tool calls avoid this. A project without this
constraint can use CC's subprocess default.

### pulse

CC's pulse skeleton checks self-description accuracy, spots dead
references, and detects staleness. Flow overrides with extensive
count verification and principle practice checks.

| Phase | CC Default | Flow Override |
|---|---|---|
| `checks.md` | Count freshness, dead references | Count freshness across 3 files (`project-skills-infrastructure.md`, `system-status.md`, `_briefing.md`). Dead reference spot-check with rotation tracking (`pulse-state.json`). Skill staleness (last-verified > 30d). Rules enforcement health. Session drift detection. Principle spot-check (samples different principle each run). Memory index auto-fix. |
| `auto-fix-scope.md` | Closed list of safe fixes | Same closed list: numeric counts, MEMORY.md filenames, system-status moves, `_briefing.md` cabinet member lists, last-verified dates |
| `output.md` | Stratified output | Same stratification: Fixed, Options, Questions, Tensions, Skill Assessments. Options create Flow Dev actions with `source: pulse`. |

**Key pattern:** Pulse's `checks.md` is where most project-specific
content lives. A new project starts with the default count-freshness
check and adds checks as it discovers what drifts. Flow's principle
spot-check (rotating through CLAUDE.md principles) is a pattern any
project could adopt.

### triage-audit

CC's triage skeleton loads findings, presents via UI, and applies
verdicts. Flow overrides the data source and verdict application.

| Phase | CC Default | Flow Override |
|---|---|---|
| `load-findings.md` | Query pib-db or read JSON files | Fetch from Railway DB via API with severity + cabinet member ordering |
| `triage-ui.md` | Start local `triage-server.mjs`, open browser | Same local server, but opened via Chrome MCP tool for reading verdicts |
| `apply-verdicts.md` | Update pib-db, attempt fixes | Three mechanisms: quick fix inline, create Flow Dev action (grouped by theme, `[Audit]` prefix), or defer/reject via Railway API PATCH. Project vs Single Action heuristic for 5+ coherent findings. Update cabinet member boundaries for rejected patterns. |


## Patterns in Flow-Specific Skills

Flow has 15+ skills beyond the 8 skeleton skills. These are fully specific
to Flow — they reference Flow's API, database schema, directory structure,
and domain concepts. But each embodies a reusable *pattern* that a different
project could implement for its own domain.

| Pattern | Flow Skill | What It Does | Generic Lesson |
|---|---|---|---|
| Entity scaffolding | `/scaffold` | Creates threads, skills, cabinet members with templates, symlinks, and validation | Any project with repeatable entity types benefits from a scaffold skill that enforces the correct directory structure and metadata. |
| Prompt refinement loop | `/refine-prompts` | Discovers all prompt artifacts (cabinet members, skills, tool configs), evaluates on 5 axes (clarity, calibration, accuracy, scope, anti-patterns), refines collaboratively | Any project with multiple prompt artifacts benefits from periodic prompt refinement. The discover-evaluate-refine loop is the pattern. |
| Command queue processing | `/handle-findings` | Reads queued commands from the app UI, routes to handlers (auto-fix, assess, create-action), updates status via API | Any project where async work gets queued for Claude to process later. The read-route-execute-update-status loop is the pattern. |
| Classify-and-route | `/process-inbox` | Classifies inbox items by cognitive type (action, idea, thread capture, reference, decision), routes to destinations via API | Any project with a capture inbox that needs triage. The classify-propose-confirm-route loop is the pattern. |
| Raw-capture-to-structured | `/incorporate` | Takes voice memo transcripts, verifies source passages, writes self-contained entries, places in development files, updates argument spine | Any project that receives raw input (voice memos, notes, screenshots) needing structured placement. Verify sources, write self-contained entries, update indexes. |
| Scan-filter-confirm-execute | `/prep-scout` | Scans actions for offloadable research, filters by exclusion categories (relationship, creative, spiritual), does legwork, writes summaries | Any project where Claude can do background research on queued items. The scan-filter-execute-summarize loop is the pattern. |
| Change-type deployment | `/deploy` | Classifies changes (markdown-only, code, mixed), takes appropriate deploy path (git push vs git push + platform deploy), verifies | Any project with multiple deployment paths depending on what changed. The classify-deploy-verify loop is the pattern. |
| Area health review | `/quarterly-review` | SQL-driven area-by-area walkthrough: stale actions, recurring cadence health, person context freshness, open loops, supply patterns | Any project with areas of responsibility benefits from periodic health queries. The SQL query templates are reusable. |

These are future extraction candidates. If Claude Cabinet grows beyond Wave 6, the
highest-value patterns to skeleton would be: entity scaffolding (widely
applicable), prompt refinement (universal for Claude Code projects), and
command queue processing (needed by any project with an async work queue).


## Writing Domain-Specific Cabinet Members

CC ships 27 generic cabinet members. Your project can add domain-specific
cabinet members on top of these. Here are three examples showing how to write your own.

### Example 1: GTD (encoding domain expertise)

Flow's `gtd` cabinet member encodes David Allen's Getting Things Done
methodology as an evaluation lens. What makes it effective:

- **Calibrated severity.** Three levels: *load-bearing* (system breaks
  without this — e.g., inbox capture under 2 seconds), *useful* (improves
  workflow — e.g., @context tags), *Allen-specific* (orthodoxy that may
  not fit — e.g., formal tickler file). The cabinet member never dogmatically
  insists on GTD purity.
- **Concrete checklists.** Each of Allen's 5 stages (capture, clarify,
  organize, reflect, engage) has specific checkpoints mapped to system
  features — not abstract principles but "does the inbox have < 2 second
  friction?" and "does the weekly review cover all lists?"
- **Horizon alignment.** Maps Allen's horizons of focus (ground through
  50,000 feet) to system concepts: Ground = Actions, 10K = Projects,
  20K = Areas, 50K = CLAUDE.md principles. Flags missing levels.

**The pattern:** Pick a methodology you know well. Map its principles to
concrete system checks. Calibrate severity so the cabinet member gives
useful feedback without being a purist.

### Example 2: Goal-Alignment (meta-cabinet-member)

Flow's `goal-alignment` cabinet member evaluates whether the system is
becoming what it's meant to become. It's a meta-cabinet-member — it
evaluates the system itself, not just the code.

- **Four evaluation areas:** Purpose delivery (is the system doing its
  job?), priority alignment (are the right things getting built?),
  mission drift (has scope crept?), feedback responsiveness (are user
  complaints being addressed?).
- **Evidence-based.** Every observation requires evidence: "4 feedback
  items older than 2 weeks unanswered" not "could be better aligned."
- **Surface interaction.** Evaluates how the app and Claude Code
  complement each other — are handoffs clean? Is information visible
  in both surfaces?

**The pattern:** Write a cabinet member that asks "is this system becoming
what it should be?" Map your project's mission to evaluation criteria.
Require evidence for every observation.

### Example 3: Philosophical Grounding (academic discipline as lens)

Flow's `philosophical-grounding` cabinet member applies phenomenological
philosophy to system design. It checks whether the system respects
how humans actually encounter and understand things — pre-reflective
experience, temporal flow, embodied interaction.

**The pattern:** Any deep domain expertise can become a cabinet member.
The key is translating domain concepts into concrete system observations:
"phenomenological encounter" becomes "does the UI let you see the item
before it's been pre-categorized?" Academic rigor becomes evaluation
rigor.

### Writing your own

A good domain cabinet member has four elements:
1. **Identity** — who it is and what expertise it brings
2. **Boundaries** — what it does NOT evaluate (prevents overlap)
3. **Convening criteria** — when it fires (audits, planning, always-on)
4. **Severity calibration** — what's critical vs nice-to-have, with
   examples of each

See `_prompt-guide.md` in the cabinet member infrastructure for the full
craft knowledge of writing cabinet member prompts.


## What We Found That Might Be Generic

During Wave 6, we scanned Flow's specific skills for accidentally-generic
code — patterns that are reusable but weren't extracted in Waves 1-5.
Eight skills contained reusable patterns (documented in the table above).
The full analysis is in the methodology essay's Wave 6 findings section.

These are patterns, not extraction candidates — yet. The patterns are
documented here so Claude Cabinet users know what's possible. If your project needs
entity scaffolding or prompt refinement, you'll write your own version.
If Claude Cabinet grows a Wave 7, the strongest candidates for skeleton extraction
are scaffold, refine-prompts, and handle-findings.
