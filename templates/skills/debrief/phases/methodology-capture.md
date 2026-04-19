# Methodology Capture — Instruction Phase

**Position:** After record-lessons, before upstream-feedback.

**This is an instruction phase** — it tells Claude when and how to
capture methodology-level artifacts from a session. It ships with CC
and should not be deleted or replaced with `skip: true`. If the phase
file is removed, the behavior described here still applies via the
default-from-SKILL.md mechanism.

## What this phase does

Standard debrief captures individual lessons ("user scope hints are
defensive signals"), discrete decisions ("used append-only history
table"), and documentation fixes. It does NOT capture the **reasoning
chain** or **self-critique layer** behind load-bearing methodology —
the kind of work where *how you did it* is as important as *what you
did*.

This phase fills that gap when the session's work warrants it. Most
sessions don't. The phase is gated on detection heuristics so bug
fixes and small refactors skip silently.

## Test for "core work"

Adapted from the source feedback that motivated this phase:

> Not every session, but when the work is core to the product's
> differentiation or legitimacy — the thing the founder would want
> on a pitch deck, the thing a customer would ask "how do I know
> this works?" about.

If the session produced methodology that could be asked about, defended,
demonstrated, or replicated — it's core work. If it was routine
application of existing methodology, it isn't.

## Workflow

### 1. Detect methodology-level signals (silent)

Scan the session for any of these signals. Fire only when one or more
match. Otherwise skip silently and proceed to upstream-feedback.

- **New skill created** in `.claude/skills/` or `templates/skills/`
  (including new `phases/*.md` files that define orchestration logic,
  not just content)
- **Multi-phase pib-db project** with actions named "Phase N…" where
  N ≥ 2 (or equivalent work-tracker multi-phase structure)
- **Audit artifacts** written to structured run directories
  (e.g., `audit-runs/<timestamp>/`)
- **Multi-subagent parallel choreography** used during this session
  (two or more agents spawned in a single parallel batch with
  coordinated roles)
- **Gate scripts with pass/fail thresholds** created this session
  (exit codes, verification-breadcrumbs, blocking-phase markers)
- **Disposition registers or calibration harnesses** created this
  session (files that record triage outcomes, calibration examples,
  decision rationales for future reference)
- **New convention docs** under `templates/cabinet/` or equivalent
  reference-docs location that encode cross-skill or cross-project
  invariants

Detection should be based on evidence from this session — git diff,
files written, subagent spawn counts. Do not guess. If ambiguous,
err toward not-firing (false positives waste the user's attention;
false negatives only cost one methodology record).

### 2. Ask once (if signals fire)

Present the detected signals in a single sentence, then ask a
four-choice question. Do not ask open-ended questions. Do not batch
with other debrief prompts.

> "This session produced methodology work: [brief list of detected
> signals — e.g., 'a new skill, a 4-phase project, a gate script'].
> Capture:
> (a) **internal critique-edges record** (reasoning chain, skeptic's
>     counters, off-ramps)
> (b) **narrateable summary** (200-400 words for external audiences)
> (c) **both**
> (d) **neither**"

If the user says (d), stop silently — the detection fired but the
user declined. Do not re-prompt next session for the same work.

### 3. Write the requested artifacts

Write to `.claude/methodology/YYYY-MM-DD[-slug]-<type>.md` where
`<type>` is `internal` or `narrative`. Slug is a short phrase derived
from the session's focus. If the directory doesn't exist, create it.

**Path override:** If `phases/methodology-capture.md` in the project
overrides the default location (e.g., some projects may want
`docs/methodology/` instead), respect the override.

### 3a. Internal critique-edges record

For each significant decision made this session, record:

```markdown
### [Decision in one sentence]

**Claim:** What we decided and why it's defensible.

**Evidence:** What we had in hand — measurements, prior cases,
documentation, stakeholder input.

**Skeptic's critique:** Where a thoughtful reader could press. What
would a contrarian cabinet member flag? What dismissals might be
too quick?

**Counter:** Our response to the critique — the reason the decision
still stands despite the pressure.

**Off-ramp:** What would change our mind? What observation, metric,
or shift in constraints would cause us to revisit this?
```

A session typically has 2-6 significant decisions worth this treatment.
Not every micro-choice. The test: "would a future session executing
this work benefit from knowing the skeptic's critique?"

### 3b. Narrateable summary

Write 200-400 words, external-audience-friendly. Readable by a
non-insider. No skill-specific jargon unless inlined with a
one-phrase gloss.

Structure (flexible — adapt to what the work is):

- **The problem** (1-2 sentences about the friction or opportunity)
- **The approach** (what methodology was applied or built)
- **Specifics and scale** (concrete numbers, files, components — enough
  that a reader can sense the work's weight)
- **What makes this work** (the load-bearing mechanism, the non-obvious
  insight)
- **How you'd know it's working** (what metric, signal, or demonstration
  would confirm it)

Format so it could be pasted into a pitch deck section, an about page,
an investor update, a collaborator email, or a customer FAQ.

### 4. Integration with the debrief report

At the end of the report phase, surface any methodology artifacts
created this session:

> **Methodology captured this session:**
> - `.claude/methodology/2026-04-18-deferred-trigger-mechanism-internal.md` — 4 decisions with skeptic counters
> - `.claude/methodology/2026-04-18-deferred-trigger-mechanism-narrative.md` — 340 words

One-line preview plus file path for each. Don't paste the content —
the files are the artifact.

## Project overrides

Projects MAY override behavior by editing this phase file:

- **`skip: true`** — entire phase skipped, including detection.
- **Custom detection heuristics** — replace the signal list above with
  project-specific triggers.
- **Custom templates** for internal/narrative records — some projects
  may want different sections or formats.
- **Different output location** — e.g., `docs/methodology/` for
  projects that want methodology visible to collaborators via
  standard docs tooling.

The default (this file's content as shipped) should be reasonable for
any project doing occasional core methodology work.

## Calibration

**Without this phase (what happens today):**
Session produces a new multi-phase skill with gate scripts, a convention
doc, and a calibration harness. Debrief captures three discrete lessons
("user scope hints are defensive," "append-only history preserves
audit trail," etc.) and closes. Six weeks later, someone asks "why did
you build it this way instead of [X]?" — the answer is fully in
someone's head (maybe nobody's, if attention has moved on), and the
skeptic's critique that was considered and addressed during the work
isn't recoverable. The narrative layer that would let a stakeholder
understand what was done at a glance doesn't exist.

**With this phase:**
Same session fires the multi-phase + new-skill + convention-doc
signals. User picks (c) both. Claude writes:
- `internal.md` with 4 decisions, each including the skeptic's
  critique and the off-ramp (so a future disagreement has ground
  to stand on)
- `narrative.md` in 340 words, pastable into a roadmap email
When a stakeholder asks six weeks later, the artifact exists. When
the project revisits the decision, the off-ramps are legible.

The phase costs maybe 3-5 minutes per session it fires. It fires on
a minority of sessions. Most sessions are untouched.

## Relationship to adjacent phases

- **record-lessons** (step 9): captures individual lessons. Parallel
  layer: granular, fact-shaped. This phase captures the layer above:
  compositional, reasoning-shaped.
- **upstream-feedback** (step 11): captures CC friction. Different
  input (what hurt) and destination (CC source repo feedback/).
- **skill-discovery** (step 12): asks whether the workflow should
  become a skill. Different output (a skill file), different trigger
  (repeatability, not depth).

These four phases together cover: discrete lessons (9), methodology
layer (this), friction (11), and workflow-worth-encoding (12). Each
fills a different bucket. None subsumes another.
