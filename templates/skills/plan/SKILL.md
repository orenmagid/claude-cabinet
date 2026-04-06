---
model: opus
name: plan
description: |
  Structured planning with cabinet critique. The relevant cabinet members
  weigh in on your approach before you build. Plans are self-contained: a
  future session can execute them without re-exploring the codebase. This is
  a skeleton skill using the phases/ directory pattern. Use when: "plan this",
  "create a plan", "/plan", or when triaging work into actionable items.
related:
  - type: file
    path: .claude/skills/plan/phases/research.md
    role: "Project-specific: what to investigate before planning"
  - type: file
    path: .claude/skills/plan/phases/overlap-check.md
    role: "Project-specific: how to search for existing work"
  - type: file
    path: .claude/skills/plan/phases/plan-template.md
    role: "Project-specific: what sections your plans have"
  - type: file
    path: .claude/skills/plan/phases/cabinet-critique.md
    role: "Project-specific: which cabinet members to activate, special rules"
  - type: file
    path: .claude/skills/plan/phases/composition-check.md
    role: "Project-specific: duplication check for reusable components"
  - type: file
    path: .claude/skills/plan/phases/completeness-check.md
    role: "Project-specific: domain-specific completeness rules"
  - type: file
    path: .claude/skills/plan/phases/present.md
    role: "Project-specific: how and where to present the plan"
  - type: file
    path: .claude/skills/plan/phases/work-tracker.md
    role: "Project-specific: how to create work items"
  - type: file
    path: .claude/skills/plan/phases/calibration-examples.md
    role: "Project-specific: detailed before/after plan examples"
  - type: file
    path: cabinet/_briefing.md
    role: "Project identity and configuration"
---

# /plan — Structured Planning with Cabinet Critique

## Purpose

Create a plan that carries enough detail to be executed by a future session
without re-exploring the codebase. The relevant cabinet members critique the
approach before you build. Plans carry the problem, the approach, the
surface area, and the acceptance criteria. Without structured planning,
sessions produce code changes that miss edge
cases, duplicate existing work, and can't be verified.

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

## Why This Matters

Planning before building prevents three failure modes:
1. **Duplicate work** — building something that already exists or is
   already planned. The overlap check catches this.
2. **Incomplete features** — plans that deliver dead code (infrastructure
   nobody calls, endpoints nobody hits). The completeness check catches this.
3. **Untestable acceptance** — "verify it works correctly" is not pass/fail.
   Structured AC force specificity.

The cabinet critique catches what the planner misses. A security
cabinet member notices the new API endpoint lacks auth. A data integrity
cabinet member notices the migration doesn't handle NULL values. These
concerns surface before a single line is written.

## Workflow

### 1. Research the Problem

Read `phases/research.md` for project-specific guidance on what to
investigate before planning. This might include: always check architecture
decision records, always consult specific documentation, always review
specific files or APIs, always search specific external sources.

**Default (absent/empty):** Explore the codebase to understand:
- What files are involved
- What patterns exist (how similar things are done elsewhere)
- What the current behavior is vs. desired behavior
- What constraints exist (tech stack, conventions, dependencies)

Don't propose a solution until you understand the current state.

### 2. Check for Existing Work

Read `phases/overlap-check.md` for how to search your project's work
tracker for items that overlap with the proposed work.

**Skip (absent/empty).** No work tracker = nothing to check against.
But note: without overlap checking, you risk creating duplicate plans.

When overlap is found:
- **Subsumes:** existing work covers this → don't create a new plan.
  Update the existing item if needed.
- **Partial overlap:** some work is shared → document the relationship.
  Propose splitting, merging, or absorbing.
- **Adjacent but distinct:** related topic but different scope → note
  the relationship in both items.

### 3. Draft the Plan

Read `phases/plan-template.md` for your project's plan structure. This
defines what sections your plans have and what each section should contain.

**Default (absent/empty):** Use this template:

```markdown
## Problem
What friction, gap, or issue exists. Why this matters.

## Implementation
Numbered steps with file paths. Enough detail to execute without
re-exploring.

## Surface Area
Every file that will be created or modified. This enables conflict
detection if multiple plans are executed in parallel.
- files: path/to/file1.ext
- files: path/to/file2.ext (new)

## Acceptance Criteria
Testable criteria — each marked by category:
- [auto] Criteria verifiable by running a command
- [manual] Criteria requiring human judgment or interaction
- [deferred] Criteria that can't be tested until later (e.g., post-deploy)
```

**Surface area rules:** Two plans conflict if they touch the same files.
When in doubt, declare more surface area, not less. False conflicts just
serialize execution; missed conflicts cause merge failures.

**Acceptance criteria must be pass/fail.** Each criterion names the input,
action, and expected output. "Verify it works correctly" is not a
criterion. "POST /api/foo returns 201 with expected payload" is.

### 4. Composition Check

Read `phases/composition-check.md` for how to check whether the planned
work duplicates existing reusable components in your project (skills,
plugins, middleware, shared libraries).

**Skip (absent/empty).** No reusable component library = nothing to
check against. But if your project has a library of reusable pieces,
this step prevents building a second version of something that already
exists.

When this step fires, check before running cabinet critique:
- Does the new/modified component duplicate logic from an existing one?
  If so, compose with the existing component rather than duplicating.
- Does the new component depend on others? If so, declare the
  relationships in the plan.

### 5. Cabinet Critique (Parallel Agents)

Read `phases/cabinet-critique.md` for which cabinet members to always
activate during planning, any special rules (e.g., "always include a
design committee for UI plans"), and any project-specific critique
workflow.

**Default (absent/empty):** Read `.claude/skills/cabinet-*/SKILL.md`
and identify cabinet members whose convening criteria match the plan's
surface area or topic. Spawn each matching cabinet member as a parallel
agent. Each receives:
- The cabinet member's full SKILL.md content
- Essential project briefing from `_briefing.md`
- The draft plan (problem, implementation, surface area, AC)
- Instructions to evaluate through their lens and return concerns + verdict

**Collect all verdicts.** Apply escalation:
- Any **block** → flag plan as needing revision before presenting
- 3+ **conditional** → treat as block-equivalent
- All **continue** → proceed with brief summary of suggestions

Include the synthesized critique alongside the plan when presenting.

If no cabinet members exist in the project, skip critique entirely. The
plan is still valuable without it — critique adds depth, not structure.

### 6. Completeness Check

Read `phases/completeness-check.md` for domain-specific completeness
rules beyond the generic ones (e.g., "all API changes require migration
scripts," "UI changes must address mobile viewport," "cost estimates
required for infrastructure changes").

**Default (absent/empty):** Apply the three generic completeness checks:

**a. Feature completeness.** "If someone executes this plan exactly,
will the user see a working feature?" If the answer is "no, someone
needs to wire it up later" — the plan is incomplete. Dead code is not
a feature. A callback nobody calls is not a feature.

**b. Surface area completeness.** Every file mentioned in Implementation
appears in Surface Area. New files are marked `(new)`.

**c. Acceptance criteria are testable.** Every criterion is pass/fail
with a category tag ([auto], [manual], [deferred]).

If any check fails, revise the plan before presenting.

### 7. Present to User

Read `phases/present.md` for how and where to present the plan. This
might include: a specific presentation format, required sections (cost
estimates, risk assessment), posting to a review channel, or generating
a formatted document.

**Default (absent/empty):** Present the full plan inline in conversation:
- The complete plan (all sections from your template)
- The cabinet critique summary (if cabinet members were activated)
- Any design decisions or tradeoffs you made
- Anything you're uncertain about

**Wait for explicit approval.** The user may:
- Approve as-is → proceed to create the work item
- Request changes → revise and re-present
- Ask questions → answer, then re-present if anything changed
- Reject → stop, don't create the work item

**Never skip user approval.** Even if the plan seems obvious — the user
needs to see and approve the specifics. This step always runs regardless
of phase file content.

### 8. Create the Work Item

Read `phases/work-tracker.md` for how to file the approved plan as a
work item in your project's tracking system.

**Skip (absent/empty).** Present the plan in conversation for the user
to file manually. But note: plans that live only in conversation context
will be lost — they need to be persisted somewhere durable.

### 9. Discover Custom Phases

Check for any additional phase files in `phases/` that the skeleton
doesn't define. These are project-specific extensions. Each custom
phase file declares its position in the workflow. Execute them at their
declared position.

## Phase Summary

| Phase | Absent = | What it customizes |
|-------|----------|-------------------|
| `research.md` | Default: explore codebase | What to always investigate first |
| `overlap-check.md` | Skip | How to search your work tracker |
| `plan-template.md` | Default: standard template | Your plan's sections and format |
| `composition-check.md` | Skip | Duplication check for reusable components |
| `cabinet-critique.md` | Default: match by convening criteria | Which cabinet members, special rules |
| `completeness-check.md` | Default: three generic checks | Domain-specific completeness rules |
| `present.md` | Default: inline in conversation | How and where to present |
| `work-tracker.md` | Skip | How to file work items |
| `calibration-examples.md` | Default: narrative only | Detailed before/after plan examples |

## Principles

- **Plans are self-contained.** A future session should be able to
  execute the plan without needing context from this conversation.
- **Plans deliver complete features.** No dead code, no unwired
  callbacks, no half-built infrastructure.
- **Surface areas are conservative.** Declare everything you might touch.
- **Plans carry the reasoning.** Include *why* this approach was chosen,
  not just *what* to do. This helps future sessions evaluate whether the
  plan still makes sense if context has changed.
- **User approves every plan.** No plan becomes work without explicit
  sign-off.

## Guardrails

### Plan persistence — MANDATORY

Plan files (e.g., `.claude/plans/*.md` or equivalent working documents)
are **ephemeral** — they get overwritten next time anyone enters plan
mode. They are NOT durable artifacts.

**All architectural context, design decisions, and reasoning MUST be
persisted to the work item** (action notes, issue body, task description —
wherever your work tracker stores plans). The plan file is a working
scratchpad during planning. When you create the work item:

1. **Work item notes** must contain enough detail to execute without
   referencing the plan file (implementation steps, surface area,
   verification criteria, key design decisions).
2. **Project notes** (for multi-phase plans) must contain the
   architectural reasoning that spans all phases.
3. **Never reference the plan file** from work item notes as if it will
   persist. It won't.

### Completed work — mark it done

When creating work items for work that was done in a prior session,
verify the work actually exists (check for files, DB tables, deployed
features) before marking complete. If the system says something is
active but it's actually built, mark it complete immediately.

## Lessons Learned

Record project-specific planning failures here so they don't recur.
Each entry should name the failure mode, what happened, and the fix.
This section accumulates over time — it's the skill's memory.

<!-- Add project-specific lessons below this line -->

## Calibration

**Core failure this targets:** Plans that deliver dead code, have
incomplete surface area, and untestable acceptance criteria.

### Without Skill (Bad)

User asks to plan a new feature. Claude explores the codebase, writes
a quick plan with 3 implementation steps, surface area listing 2 files,
and verification saying "verify it works correctly." The plan misses
that 2 other files need updating to wire the feature in, misses that
similar work was already planned, and has no way to verify it actually
works.

### With Skill (Good)

Same request. Claude explores, checks for existing work (finds a
related but distinct plan, notes the relationship), drafts a plan with
all files needed for a complete feature, runs it through cabinet members
(security flags a missing auth check, QA flags an untestable criterion),
revises, presents to the user with the critique. User approves, the plan
is filed as a work item. A future session can pick it up and execute
without re-exploring.

### Detailed Examples

Read `phases/calibration-examples.md` for project-specific before/after
plan examples showing exact formatting.

**Default (absent/empty):** Use the narrative examples above. They
convey the key failure modes without project-specific detail.

When present, the examples file should show at least one bad plan and
one good plan in your project's template format, with real-looking
(but anonymized) content demonstrating the difference between incomplete
and complete plans.
