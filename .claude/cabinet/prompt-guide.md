# Cabinet Member Prompt Guide

What makes a good cabinet member prompt. This guide is craft knowledge for
writing and evaluating cabinet member prompts — the `SKILL.md` files in
`.claude/skills/cabinet-{name}/` that teach Claude how to think about a
dimension of quality. It's not generic prompt engineering advice. It's
patterns specific to this system.

## Principles

### 1. Teach Thinking, Not Checklists
A good prompt gives an analytical framework — *how to reason*
about a domain. A bad prompt gives a list of things to grep for.

**Good:** "Think about structural sustainability — whether the codebase
can absorb change without accumulating hidden costs. Use Fowler's debt
quadrant to classify what you find."

**Bad:** "Check for: unused imports, any types, missing interfaces,
TODO comments, console.log statements."

The checklist approach breaks when the codebase changes. The thinking
approach adapts because the agent understands *why* it's looking.

### 2. Each Expert Owns a Domain
Every cabinet member must have a clear "Boundaries" section that
names which other cabinet members own adjacent concerns. This prevents
duplicate work and keeps each expert focused.

**Pattern:** "Mobile layout issues (that's small-screen)" /
"UI framework component choices (that's framework-quality)" / "Code quality
issues (that's technical-debt)"

When two cabinet members could plausibly flag the same thing, decide which
one owns it and update both prompts.

### 3. Use Authoritative External Knowledge
Cabinet members should go to primary sources, not rely on baked-in
knowledge that goes stale:

- **MCP documentation servers** — your project's framework docs via
  MCP tools like `list_doc_sources` and `fetch_docs`
- **llms.txt pattern** — fetch the docs index, then drill into specific
  pages for detail
- **WebSearch** — verify current standards, check for ecosystem updates

**Anti-pattern:** Embedding a static list of framework components in
the prompt. It goes stale when the framework updates.

**Pattern:** Instruct the agent to fetch the framework's docs index at
start, then consult specific component pages as needed.

### 4. Preview Tools for Runtime Evaluation
Cabinet members that evaluate the running app (usability, mobile,
accessibility, performance) should use preview tools to actually
interact with the app, not just read code and imagine.

Mark these cabinet members as `interactive-only: true` in frontmatter.

### 5. Observations Land on the Tool
Findings are about what the *tool* should do differently, not about
what the *user* should do differently.

Usage patterns can be *evidence* ("inbox items pile up" → the routing
workflow has too much friction). But the observation is about the tool.

### 6. Flag Divergence Without Presuming Direction
When documentation and code disagree, present both options:
- "Update the docs to match the code" OR
- "Update the code to match the documented convention"

The human decides reconciliation direction. The expert flags the gap.

### 7. Discover, Don't Prescribe
Agents should discover the current state rather than follow hardcoded
lists that go stale.

### 8. Acknowledge the Evolving System
Check `system-status.md` (or equivalent) and don't flag planned features
as missing. But *do* evaluate whether planned features are the right
priorities.

### 9. Deep Over Wide
3-5 well-researched observations with concrete evidence beat 15
shallow ones. Depth of research matters more than breadth.

### 10. Know Your Cabinet
Each cabinet member should be aware of what the others cover. The
shared briefing (`_briefing.md`) lists the full cabinet with committees.
Individual prompts should reference specific neighbors in "Boundaries."

## Cognitive Architecture Principles

These principles, derived from Daniel Levitin's *The Organized Mind*,
govern how the skill and cabinet member system itself is designed. They
apply to anyone creating or modifying skills, cabinet members, or the
consuming skills that invoke them. Consult the organized-mind cabinet member
for the full framework.

### 11. Agent Isolation as Designated Places
Each cabinet member runs in its own agent context — a clean cognitive space
free from contamination by other cabinet members' findings. This is
Levitin's "designated place" principle: the hippocampus encodes fixed
locations reliably; nomadic items get lost. A cabinet member that runs in
a shared, cluttered context is a nomadic item. An agent is its
designated place.

Consuming skills (/plan, /execute, /audit) invoke cabinet members via the
Agent tool, spawning them in parallel. Each agent receives: shared
briefing + its SKILL.md + the relevant output contract + input data.
Results are collected and synthesized by the main session.

### 12. Associative Access, Not Single-Path Retrieval
A skill or cabinet member should be findable via multiple routes — not just
its canonical name. This is why convening criteria exist: file patterns,
topic keywords, and standing-mandate declarations create multiple associative
pathways to the same expert lens. If the only way to find organized-mind
is to already know it's called "organized-mind," that's single-path
retrieval — the failure mode Levitin identifies.

When writing descriptions and convening criteria, optimize for
discoverability from multiple angles.

### 13. Functional Grouping Over Taxonomic
The cabinet member committees (Code & Architecture, User Experience,
System Health...) are taxonomic — useful for humans reading the list.
But when a consuming skill selects cabinet members, it thinks functionally:
"which lenses are relevant to *this specific change*?" The convening
criteria are the functional index. Both indexes coexist; neither replaces
the other.

When organizing skills, ask: "Would someone looking for this by *what
it does* find it?" not just "Is it in the right category?"

### 14. Respect the Working Memory Limit
Claude's context window is large but attention is finite. A checkpoint
that activates 7 cabinet members is viable because each runs in its own
agent. Within a single context, aim for 3-4 active concerns at a time.
Escalation logic (any block stops, 3+ conditional = block) respects
this by collapsing many verdicts into one decision.

### 15. The Legitimate Junk Drawer
Not everything fits a category. Process-therapist doesn't cleanly belong to
any committee. Emerging cabinet members may not have clear boundaries yet.
Forcing premature classification degrades the taxonomy. The
"uncategorized" state is legitimate infrastructure, not technical debt.

### 16. Affordances in Skill Templates
The template structure (Identity → Convening Criteria → Research Method
→ Boundaries → Calibration Examples) is itself an affordance system.
Each section tells the agent *how to use the skill* without needing
external memory. If a new skill requires reading documentation outside
itself to be invoked correctly, the template has failed.

### 17. Externalization Enables
The cabinet member cabinet isn't just a quality-checking mechanism — its
structure should reveal what dimensions of quality are covered and what
aren't. When you add a new feature area and no cabinet member covers it,
the cabinet's structure should make that gap visible. This is Levitin's
deepest claim: externalized structure doesn't just prevent errors, it
makes patterns visible that were invisible from the raw material.

## Skill Sizing

Skills should stay under **500 lines** in their primary SKILL.md file.
This isn't arbitrary — LLMs have limited attention, and shorter skills
get followed more reliably. (Source: Anthropic's skill-creator docs.)

**When a skill approaches 500 lines:**
- Extract detailed reference material to a `REFERENCE.md` file in the
  skill's directory. The SKILL.md stays lean (core workflow), the
  reference file holds the detail (API specs, exhaustive examples).
- Extract extended examples to an `EXAMPLES.md` file.
- Claude Code automatically loads all `.md` files in a skill's directory,
  so the extracted files remain accessible.

**When to keep a skill large (>300 lines):**
- The workflow is genuinely sequential and splitting would lose context
  that earlier steps need
- The skill has multiple modes that share significant setup

**When to split:**
- A skill has 3+ independent workflows that rarely run together
- Different sections serve different consumers (e.g., a reference section
  that only one skill needs should be in a separate file)

## Behavioral Calibration Standard

Key skills should include **Without Skill (Bad) / With Skill (Good)**
calibration pairs — concrete scenarios showing what goes wrong without
the skill's guidance and how the guidance changes the outcome.

**Format:**
```
## Calibration

### Without Skill (Bad)
[Concrete scenario showing what goes wrong]

### With Skill (Good)
[Same scenario, showing how the skill's guidance changes the outcome]
```

Calibration examples ground the skill's instructions in reality. They're
especially important for skills where "following the instructions" is
ambiguous — a /plan that produces "vague AC" vs. one that produces
"testable AC" is the difference between a session that executes cleanly
and one that stalls.

Not every skill needs these — simple utilities (/menu) don't benefit.
Focus calibration on skills where miscalibration has high cost: planning,
execution, session lifecycle, inbox processing.

## Structural Template

Every cabinet member skill should have these sections:

```
---
name: cabinet-{name}
description: Rich 2-3 sentence description for ambient discovery
user-invocable: false
---

# {Name}

## Identity
What this expert thinks about. The analytical framework.
What makes this cabinet member unique.

## Convening Criteria
Files: glob patterns that trigger this cabinet member
Topics: keywords that trigger this cabinet member
Standing-mandate: which skill types always activate this cabinet member

## Research Method
Where to get information, how to investigate, what to examine.
Merged from Knowledge Base + What to Reason About + Paths.

## Boundaries
What you do NOT examine. Which other cabinet members own it.

## Calibration Examples
Plain-text observations (not JSON) showing the kind of things
this cabinet member notices.
```

## Common Failure Modes

1. **Checklist prompt** — Lists things to grep for instead of teaching
   how to think. Breaks when the codebase changes.
2. **Stale references** — Mentions specific file paths, component names,
   or conventions that no longer exist.
3. **Boundary violation** — Produces observations that another cabinet member
   owns. Creates duplicate work.
4. **Static knowledge** — Embeds framework/library details that go stale.
   Should point to live docs instead.
5. **Vague observations** — "This could be improved" without specific
   evidence or assumption. Not actionable.
6. **Presumed direction** — "Fix this by doing X" when the right fix
   might be updating the convention instead. Present options.
7. **Passive conditional** — Uses "If this session modified X" as a gate
   without a scan mechanism. Claude is expected to remember what it did,
   which is exactly the kind of subjective recall that produces false
   negatives. The fix: add a `git diff --name-only` + `git status` scan
   before the conditional, and gate on the scan output.
