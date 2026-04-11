---
model: opus
name: investigate
description: |
  Structured codebase exploration before planning. Four phases: observe
  (gather facts), hypothesize (form explanations), test (verify), conclude
  (summarize findings). Replaces ad-hoc grepping with a systematic approach.
  Use when: "investigate", "explore this", "figure out how X works",
  "why is X happening", "look into", "/investigate".
related:
  - type: skill
    name: plan
    role: "Terminal state — /investigate feeds into /plan"
  - type: skill
    name: audit
    role: "Audit finds issues, /investigate explores them"
  - type: file
    path: cabinet/_briefing.md
    role: "System briefing for investigation scope"
model: opus
argument-hint: "what to investigate — e.g., 'why orient fails on fresh installs'"
---

# /investigate — Structured Codebase Exploration

## Arguments

If `$ARGUMENTS` is provided, use it as the investigation question —
proceed directly to step 1 (Frame the Question) with this as the
question text. If empty, ask the user what they want to investigate.

## Purpose

Replace ad-hoc grepping and scattered file reads with a disciplined
exploration protocol. When you need to understand how something works,
why something is broken, or what the codebase looks like before planning
a change, /investigate gives you a structured path from question to answer.

Adapted from obra/superpowers systematic-debugging pattern.

## Workflow

### 1. Frame the Question

State the investigation question clearly. Good questions:
- "How does inbox processing route items to threads?"
- "Why are telemetry events showing duplicate session-start entries?"
- "What would need to change to support recurring actions?"

Bad questions (too vague — narrow first):
- "How does the system work?" → Pick a specific subsystem
- "Is the code good?" → That's /audit, not /investigate

### 2. Cabinet Consultations

Before exploring, check if any cabinet members have relevant context.
Read `.claude/skills/_index.json` and filter to entries where
`standingMandate` includes `"investigate"` and `directives.investigate`
exists. Spawn matching members as agents in parallel, passing the
investigation question from step 1.

If no members match or the index is missing, proceed directly to
observation.

### 3. Observe (Gather Facts)

Collect raw data without interpreting it. Use the Explore agent or
direct Grep/Glob/Read calls:

- **Map the surface area:** Which files, functions, and data flows
  are involved? Use Glob to find relevant files, Grep to find key
  function names and call sites.
- **Read the code:** Read the actual implementation, not just the docs.
  Docs can be stale; code is ground truth.
- **Check the data:** If the question involves runtime behavior, look
  at actual data (DB contents, log files, telemetry, API responses).
- **Note surprises:** Anything that contradicts your expectations is
  a finding worth recording.

**Output:** A bulleted list of concrete observations. Each observation
should cite a specific file:line or data point.

### 4. Hypothesize (Form Explanations)

Based on observations, form 1-3 hypotheses that explain what you're seeing.

For each hypothesis:
- State it clearly in one sentence
- Identify what evidence would confirm it
- Identify what evidence would refute it

**The discipline here is generating alternatives.** Don't lock onto the
first explanation. If you only have one hypothesis, you're not investigating
— you're confirming.

### 5. Test (Verify)

For each hypothesis, actively seek the confirming AND refuting evidence
you identified. This may involve:
- Reading more code to check call paths
- Running commands to check actual behavior
- Querying the database for state
- Checking git history for when behavior changed

**Record results per hypothesis:** confirmed, refuted, or inconclusive
(with what additional data would resolve it).

### 6. Conclude

Summarize findings in a structured report:

```markdown
## Investigation: {question}

### Observations
- {key observation 1} — {file:line}
- {key observation 2} — {file:line}

### Findings
- {finding 1}: {what we learned and why it matters}
- {finding 2}: {what we learned and why it matters}

### Unresolved
- {anything still unclear, if applicable}

### Recommendation
{What to do with these findings — usually "proceed to /plan"}
```

Present the report to the user. If the findings are sufficient to act on,
the next step is `/plan`.

## Terminal State

Next step: `/plan` (if findings warrant action) or report findings and
close (if the investigation was purely informational).

## Principles

- **Observe before hypothesizing.** Gather facts first. Premature
  hypotheses create confirmation bias — you read code looking for
  evidence of what you already believe.
- **Generate alternatives.** One hypothesis is confirmation, not
  investigation. Force yourself to consider at least one alternative
  explanation.
- **Cite evidence.** Every observation and finding should point to a
  specific file, line, data point, or command output. Unsourced claims
  are opinions, not findings.
- **Know when to stop.** Investigation serves planning. Once you have
  enough understanding to plan confidently, stop. Exhaustive exploration
  of every tangent is a different activity.

## Calibration

**Core failure this targets:** Starting implementation based on assumptions
about how the codebase works, then discovering mid-implementation that the
assumptions were wrong.

### Without Skill (Bad)

User says "add a feature to archive completed items." Claude greps for
"item" in a few files, reads the config, and starts writing an archive
script. Mid-implementation, discovers that items are referenced by ID
in API endpoints, in 3 different UI routes, in a sync mechanism, and
in foreign key relationships across 2 database tables. The archive
script moved the records but broke 6 references. Rolls back and starts
over with a proper plan.

### With Skill (Good)

User says `/investigate` — "what would need to change to archive items?"
Claude maps the surface area: config files, API endpoints, UI routes,
database foreign keys, sync references. Forms two hypotheses: (1) items
can be soft-deleted with a status flag, (2) items need physical removal
with cascade cleanup. Tests both against the codebase. Concludes with a
complete dependency map and recommends `/plan` with the status-flag
approach. The subsequent plan accounts for all 6 reference points from
the start.
