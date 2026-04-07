# Enforcement Pipeline

Rules don't arrive fully formed. They start as friction — something went
wrong, someone noticed, it got written down. This pipeline turns friction
into structure over time.

## The Compliance Stack

Not all rules need the same enforcement. The stack gives each rule a
natural home based on two questions: *Can it be checked mechanically?*
and *What's the cost of violation?*

| Layer          | Mechanism                   | Compliance | Best For                           |
| -------------- | --------------------------- | ---------- | ---------------------------------- |
| CLAUDE.md      | Prompt context              | ~60-80%    | Intent, heuristics, judgment calls |
| .claude/rules/ | Scoped prompt               | ~80%       | Path-specific constraints          |
| Hooks          | Deterministic shell scripts | ~100%      | Hard guardrails                    |

A principle like "ask rather than assume when something affects
correctness" belongs in CLAUDE.md. It requires judgment. A rule like
"never commit without a fid tag" belongs in a hook. It's deterministic,
and the consequence of violating it is severe.

**The best enforcement isn't enforcement at all — it's structural
encoding that makes the wrong thing impossible.** A pre-commit hook
doesn't remind you to do something. It blocks the commit until the
condition is met. The wrong state can't enter the system. When you can
encode a rule structurally (API rejects invalid input, schema enforces
constraints), prefer that over any compliance layer.

## Pipeline Stages

### 1. Capture (every session, during debrief)

Record what went wrong or what worked unexpectedly. Raw observations,
not polished rules.

- Save to memory or a feedback directory (raw observation files)
- Check if it fits an existing pattern:
  - **MERGE** — same ground as an existing pattern → update that pattern
  - **KEEP_SEPARATE** — distinct observation → stays as individual file
  - **REPLACE** — supersedes an existing observation → remove old
  - **UPDATE** — enriches an existing pattern → add to pattern's evidence
- If 3+ related observations accumulate without a pattern, create one

### 2. Classify (at capture time)

Every observation or pattern gets an enforcement type:

- **prevent** — candidate for a hook (~100% compliance needed)
- **detect** — candidate for a validation script or post-action check
- **guide** — stays as prompt context (CLAUDE.md or rules file)
- **document** — reference material, not a rule

Classification drives what promotion means for that pattern.

### 3. Promote (periodic review)

When observations about the same class of problem accumulate, they
consolidate into a pattern and may move up the compliance stack.

**Promotion criteria are intelligence, not thresholds.** There is no
magic number of observations that triggers promotion. One catastrophic
incident can justify immediate promotion to a hook. A dozen minor
annoyances might stay as guidance forever. The human decides what to
promote and when, informed by severity and pattern, not by count.

Promotion moves a rule up the stack:
- CLAUDE.md guidance → `.claude/rules/` file (scoped, more reliable)
- Rules file → hook (deterministic, ~100% compliance)
- Any layer → structural encoding (makes the wrong thing impossible)

### 4. Encode (after promotion approval)

Implement the promoted rule at its target layer:
- **CLAUDE.md promotion:** Add to root CLAUDE.md or create/update a
  `.claude/rules/` file
- **Hook promotion:** Add to `.claude/settings.json` hooks section.
  Command hooks for deterministic checks, prompt hooks for semantic
  evaluation.
- **Structural encoding:** Modify API, schema, or validation to reject
  invalid states directly

### 5. Monitor (ongoing)

Are the rules working?
- Are hooks firing correctly?
- Is the same friction appearing despite encoding? (If yes, the
  encoding is wrong — either the rule is at the wrong layer or the
  implementation doesn't catch the actual failure mode.)
- Are there dead rules? (Rules that reference files or patterns that
  no longer exist.)
- Is unabsorbed feedback accumulating without being consolidated?

## Pattern File Format

Use the pattern template in `memory/patterns/_pattern-template.md` for
capturing consolidated patterns. Each pattern file has frontmatter with
the enforcement type, sources (raw observations that fed into it), and
promotion candidates (specific rules ready for promotion).

## Where Each Step Lives

| Step | Owner | When |
|------|-------|------|
| Capture + Classify | /debrief | Every session |
| Pattern analysis | Periodic review | As feedback accumulates |
| Promotion checkpoint | Review cadence | When patterns mature |
| Enforcement health | /orient or /pulse | Regular check |

## Audit Findings as Promotion Input

The audit system feeds the enforcement pipeline. When the same type of
finding keeps getting approved across multiple audit runs, it signals a
recurring problem that detection alone isn't solving. That's a promotion
candidate.

**The virtuous cycle:** Audit detects a pattern → triage approves it →
the fix is applied → the same finding appears again next audit → this
time, instead of just fixing it again, the pattern gets promoted to a
rule or hook that *prevents* it from recurring. The audit catches
problems; the enforcement pipeline prevents them.

**Signals that a finding should become a rule:**
- Same finding (or same class of finding) approved in 3+ audit runs
- Finding addresses something mechanically checkable (could be a hook)
- Finding addresses something that requires judgment but has a clear
  principle (could be a CLAUDE.md rule or `.claude/rules/` file)
- The cost of violation is high enough to justify enforcement

**Signals that a finding should stay a finding:**
- One-time issue that was fixed and won't recur
- Context-dependent — the right answer changes each time
- Low severity — enforcement overhead exceeds violation cost

The audit skill's triage history tracks which findings recur. The
enforcement pipeline's pattern files track which recurring findings are
ready for promotion. Together, they create a feedback loop from
observation to prevention.

## Current State

<!--
Track your project's enforcement pipeline state here:

- **N pattern files** in memory/patterns/
- **N raw observations** in memory/archive/ (or wherever you store them)
- **N rules files** in .claude/rules/
- **N hooks** in .claude/settings.json
- **N promotion candidates** identified
-->
