---
name: seed
description: |
  Recruit new cabinet members. Scans your project for technologies and
  frameworks, proposes expert members to cover them, builds them
  collaboratively, and maintains existing ones over time. Use when: "seed",
  "check for new tech", "build a cabinet member", "/seed", after adding
  dependencies or frameworks.
related:
  - type: file
    path: .claude/skills/seed/phases/scan-signals.md
    role: "Where to look for technology signals"
  - type: file
    path: .claude/skills/seed/phases/evaluate-existing.md
    role: "Check existing cabinet members against detected tech"
  - type: file
    path: .claude/skills/seed/phases/build-member.md
    role: "How to build a new cabinet member collaboratively"
  - type: file
    path: .claude/skills/seed/phases/maintain.md
    role: "Maintain existing cabinet members (retirement, updates)"
  - type: file
    path: cabinet/_lifecycle.md
    role: "Cabinet member lifecycle guidance"
  - type: file
    path: cabinet/_briefing-template.md
    role: "Template for project briefing"
---

# /seed — Recruit New Cabinet Members

## Purpose

Recruit cabinet members as your project grows. When you adopt React, you
need accessibility expertise. When you add SQLite, you need data-integrity
expertise. When you deploy to Railway, you need security and deployment
expertise. These connections are predictable, but people don't reliably
act on them at the moment of adoption — they add the dependency, start
building, and only discover the expertise gap after an incident.

Seed makes that recruitment systematic. It scans for technology
signals in your project's configuration files, compares them against
your existing cabinet members, identifies gaps, and initiates
collaborative conversations to build the missing expertise.

This is a **skeleton skill** using the `phases/` directory pattern. The
orchestration (what to do and in what order) is generic. Your project
defines the specifics — what signals to scan for, what expertise to
associate with each signal, how to build cabinet members — in phase files
under `phases/`.

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

## Relationship to /onboard

Onboarding and skill management are the same system at different tempos.
`/onboard` runs at inception — when a project first adopts the methodology,
it does a comprehensive scan and builds the initial cabinet member roster
from scratch. `/seed` runs at steady state — when the project evolves,
a new dependency appears, a framework is added, infrastructure changes.

The detection logic overlaps intentionally. `/onboard` calls `/seed`'s
scan internally. `/seed` is the ongoing mechanism that keeps the cabinet
current as the project grows. Think of `/onboard` as the first `/seed`
run — comprehensive and foundational. Every subsequent `/seed` is
incremental and conversational.

## Workflow

### 1. Scan for Technology Signals

Read `phases/scan-signals.md` for where to look and what signal-to-
expertise mappings to apply. This phase reads package manifests, config
files, infrastructure definitions, and database artifacts to build a
picture of what technologies the project uses.

**Default (absent/empty):** Scan standard locations:
- `package.json` / `requirements.txt` / `Cargo.toml` / `go.mod` for
  dependencies
- Config files (`.eslintrc`, `tailwind.config.*`, `tsconfig.json`,
  `docker-compose.yml`, etc.)
- Infrastructure files (`Dockerfile`, `.github/workflows/`,
  `railway.json`, `vercel.json`, `fly.toml`)
- Database artifacts (`*.db` files, `migrations/`, `prisma/`,
  `drizzle.config.*`)

Apply the default signal-to-expertise mapping table (defined in the
phase file). Projects override this phase to add domain-specific signals
— a healthcare project might map HIPAA-related dependencies to a
compliance cabinet member; a financial project might map payment libraries
to a financial-integrity cabinet member.

### 2. Cabinet Consultations

Before evaluating gaps, check if any cabinet members have relevant
context. Read `.claude/skills/_index.json` and filter to entries where
`standingMandate` includes `"seed"` and `directives.seed` exists.
Spawn matching members as agents in parallel, passing the scan results
from step 1.

Include their findings in the evaluation step — a roster-check member
might identify coverage gaps, a process-therapist might flag unhealthy
existing members before you add new ones.

If no members match or the index is missing, proceed directly.

### 3. Evaluate Existing Cabinet Members

Read `phases/evaluate-existing.md` for how to compare detected signals
against the current cabinet members.

**Default (absent/empty):** For each detected technology signal:
1. Check `.claude/skills/cabinet-*/` for a cabinet member whose domain
   covers that technology
2. If a matching cabinet member exists: check whether its scan scope still
   covers the right directories and whether the technology version has
   changed significantly since the cabinet member was created
3. If no matching cabinet member exists: flag as a gap

Build two lists:
- **Gaps** — technologies without corresponding expertise
- **Stale** — cabinet members that exist but may need updating

Present both lists to the user before proceeding. The user decides which
gaps to fill and which staleness to address. Not every technology needs
a cabinet member — some are too minor, some are well-understood, some are
covered by existing cabinet members with broader scope.

### 4. Build New Cabinet Members

Read `phases/build-member.md` for how to collaboratively build a
new cabinet member with the user.

**Default (absent/empty):** For each gap the user wants to fill, run a
collaborative expertise-building conversation:
1. Research the technology (check docs, use available MCP tools)
2. Ask the user: what matters about this technology in YOUR project?
3. Draft a cabinet member `SKILL.md` following `_lifecycle.md` guidance
4. Walk through Identity, Research Method, Boundaries, and Calibration
   with the user
5. Create the file in `cabinet-{name}/SKILL.md`
6. Update `committees-project.yaml` if the cabinet member belongs in a committee
   (add to `additional_members` of an existing upstream committee, or create
   a new committee definition). Create `committees-project.yaml` if it
   doesn't exist yet.

This is co-authoring, not auto-generating. The user's domain knowledge
is what makes a cabinet member useful for their specific project. A generic
"React best practices" cabinet member catches generic issues. A cabinet member
built with the user's input — "we use Mantine, we care about keyboard
navigation, our users are on slow connections" — catches what actually
matters.

### 5. Maintain Existing Cabinet Members

Read `phases/maintain.md` for how to review the health of existing
cabinet members and recommend changes.

**Default (absent/empty):** Review the cabinet for:
- **Retirement candidates:** technologies removed from the project,
  cabinet members with high rejection rates in audit triage, cabinet members
  whose scan scopes reference files that no longer exist
- **Update candidates:** technology version changed significantly,
  new features added that the cabinet member doesn't cover, scan scope
  needs expanding to cover new directories
- **Coverage gaps:** areas of the codebase not covered by any
  cabinet member's scan scope

Apply `_lifecycle.md` criteria. Recommend retirements as readily as
adoptions — a lean cabinet is better than a comprehensive one full of
dead weight. Present recommendations; the user decides.

### 5. Discover Custom Phases

After running the core phases above, check for any additional phase
files in `phases/` that the skeleton doesn't define. These are project-
specific extensions. Each custom phase file declares its position in
the workflow. Execute them at their declared position.

## Phase Summary

| Phase | Absent = | What it customizes |
|-------|----------|-------------------|
| `scan-signals.md` | Default: scan standard locations + default mappings | Where to look, what signals map to what expertise |
| `evaluate-existing.md` | Default: compare signals to cabinet members | How to assess gaps and staleness |
| `build-member.md` | Default: collaborative conversation | How to co-author a new cabinet member |
| `maintain.md` | Default: review cabinet health | How to assess retirement, updates, gaps |

## Companion Framing

Seed is conversational by design. It doesn't auto-generate cabinet members
or silently add expertise. The tone is:

> "I noticed you added Express as a dependency. That typically means we
> should carry some expertise around security and request handling for
> this project. Want to explore what a security cabinet member should look
> like for your setup?"

The user might say "yes, let's build it," or "we don't need that — this
is an internal tool with no auth," or "good idea, but let's do it next
session." All valid responses. The skill proposes; the user decides.

This framing matters because expertise is contextual. The same technology
in two different projects needs different cabinet members. Express in a
public API needs security hardening. Express in a local dev tool needs
almost none. The conversation is where that context gets encoded.

## Extending

To customize a phase: write content in the corresponding `phases/` file.
To skip a phase: write only `skip: true` in the file.
To add a phase the skeleton doesn't define: create a new file in
`phases/` with a description of when it runs relative to the core phases.

Examples of phases mature projects add:
- **Dependency changelog scanning** — check what changed between the old
  and new version of a dependency, flag breaking changes that affect
  existing cabinet members
- **Team expertise mapping** — map detected technologies to team members
  who have relevant expertise, surface when a technology has no human
  expert (single point of failure)
- **Cost estimation** — flag technologies that have cost implications
  (cloud services, paid APIs, licensed frameworks)
- **Compliance mapping** — map technologies to compliance requirements
  (HIPAA, SOC2, GDPR) based on what data they handle

## Calibration

**Core failure this targets:** Reactive expertise acquisition. Technology
is adopted, expertise is not built until an incident reveals the gap.
The gap between adoption and incident is where preventable problems live.

### Without Skill (Bad)

Developer adds a SQLite database to the project. Builds features against
it for weeks. Nobody thinks about data integrity until a migration
corrupts production data. After the incident, someone writes a checklist
of "things to check with SQLite." The checklist lives in a wiki page
that nobody reads. Six months later, the same class of bug recurs because
the checklist wasn't integrated into the development workflow.

The expertise was reactive — built in response to pain, stored where it
couldn't influence behavior.

### With Skill (Good)

Developer adds a SQLite database. Next `/seed` run detects the `*.db`
file and `better-sqlite3` in dependencies. It says: "I see you've
adopted SQLite. Projects using SQLite typically benefit from a
data-integrity cabinet member that watches for type coercion issues, WAL
mode configuration, migration safety, and backup strategies. Want to
build one together?"

The developer says yes. They spend 10 minutes in conversation: "We're
using WAL mode, our biggest risk is concurrent writes from the sync
process, and we've had issues with empty-string-vs-NULL before." The
resulting cabinet member is specific to this project's actual risks. It
activates during audits and catches the NULL coercion bug before it
ships.

The expertise was proactive — built at the moment of adoption, stored
where it actively influences every audit cycle.
