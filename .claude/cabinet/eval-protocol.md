# Skill Effectiveness Assessment Protocol

Shared reference for evaluating whether skills and cabinet members are doing
their job. Adapted from Anthropic's skill-creator eval framework for manual
assessment. This is not an automated test suite — it's a structured way to
ask "is this skill working?" and get an evidence-based answer.

## When This Runs

Two trigger mechanisms ensure this protocol doesn't just sit as a document:

1. **Pull (via prompt refinement):** When reviewing a skill's definition,
   run the assessment before proposing changes. The assessment grounds the
   refinement in evidence rather than intuition.

2. **Push (via process-therapist):** During audits, process-therapist checks whether
   any skill's last assessment is older than 30 days. If so, it surfaces
   an "eval overdue" finding, which enters the normal triage flow. The
   user decides whether to act on it.

## The Assessment Framework

### 1. Define Assertions

An assertion is a testable claim about what a skill should produce.
Each assertion has three fields:

```
{ "text": "what is being tested",
  "passed": true/false,
  "evidence": "supporting data or reasoning" }
```

**Types of assertions:**

- **Behavioral:** Does the skill produce the right actions?
  - Example: "The planning skill produces AC with [auto]/[manual]/[deferred] tags"
  - Example: "The orient skill surfaces overdue items before suggesting focus"

- **Quality:** Is the output at the right level?
  - Example: "The inbox skill asks before routing ambiguous items"
  - Example: "QA cabinet member catches [auto] AC failures before commit"

- **Coverage:** Does the skill handle its full scope?
  - Example: "The execute skill runs all checkpoint types (pre, per-group, pre-commit)"
  - Example: "Roster-check detects drift between skill definition and documentation"

- **Boundary:** Does the skill stay in its portfolio?
  - Example: "Organized-mind flags cognitive load but does not suggest UI framework components"
  - Example: "Anti-confirmation challenges reasoning quality without developing domain arguments"

**How many assertions per skill:** 5-8 for core skills (planning,
execution, orientation, inbox processing). 3-5 for cabinet members. More
isn't better — each assertion should test something meaningfully different.

### 2. Sample Past Executions

Use conversation history and memory to find evidence:

- Find recent sessions where a skill was invoked
- Find sessions where a cabinet member activated
- Find sessions where something went wrong

Also check:
- Memory files for feedback corrections (these are failed assertions)
- Git history for reverted changes (execution failures)
- Audit triage history for rejected findings (cabinet member miscalibration)

**Sample size:** 3-5 recent executions is sufficient for manual assessment.
If a skill hasn't been invoked 3 times in the last month, that itself is
a finding (coverage gap or trigger problem).

### 3. Score Each Assertion

For each assertion, review the sampled executions and score:

| Score | Meaning |
|-------|---------|
| **pass** | Assertion holds in all sampled executions |
| **partial** | Assertion holds in some but not all executions |
| **fail** | Assertion does not hold in any sampled execution |
| **untestable** | Not enough data to evaluate (note why) |

Record the evidence for each score — a pass without evidence is
an assumption, not a finding.

### 4. Aggregate and Interpret

```
## Assessment: /plan — 2026-03-22

Assertions: 6 total
- Pass: 4 (67%)
- Partial: 1 (17%)
- Fail: 1 (17%)
- Untestable: 0

Pass rate: 67% (4/6 testable)

### Findings
- PASS: Produces AC with [auto]/[manual]/[deferred] tags (5/5 sampled plans)
- PASS: Surface area includes all implementation files (4/5 — one missed shared entry point)
- PASS: Presents plan for user approval before creating action (5/5)
- PASS: Runs cabinet member critique before presenting (4/5 — skipped once for trivial plan)
- PARTIAL: Plans deliver complete features (3/5 — two plans had infrastructure-only steps)
- FAIL: Plan notes persist reasoning (1/5 — four plans had thin "why" sections)
```

**Interpretation guide:**

| Pass rate | Health | Action |
|-----------|--------|--------|
| 80-100% | Healthy | Monitor. Note partial assertions for refinement. |
| 60-79% | Degrading | Investigate failing assertions. Are they skill design issues or execution drift? Propose targeted refinements. |
| Below 60% | Unhealthy | The skill needs significant revision. Root-cause analysis before patching. |

### 5. Track Over Time

Append each assessment to a tracking section at the bottom of
the skill's SKILL.md (or in a separate ASSESSMENTS.md if the skill
is approaching the 500-line limit):

```markdown
## Assessment Log

### 2026-03-22 — Pass rate: 67% (4/6)
Key finding: Plan notes don't persist reasoning. "Why" sections thin.
Action taken: Added emphasis in Step 2 template + calibration example.

### 2026-04-15 — Pass rate: 83% (5/6)
Improvement: Reasoning persistence now at 4/5. Remaining partial: feature
completeness — one plan delivered infrastructure step without wiring.
```

This creates a trend line. A declining pass rate across assessments
signals systemic drift. An improving rate confirms refinements are working.

## Example: Complete Assessment

*(Adapted from a reference implementation's orient skill assessment)*

```
## Assessment: /orient — 2026-03-22
Sampled: 5 recent sessions (3 standard, 1 morning, 1 user-requested)

### Assertions

1. BEHAVIORAL: Pulls fresh data before presenting briefing
   Score: pass
   Evidence: All 5 sessions ran data sync in Step 2.

2. BEHAVIORAL: Surfaces overdue items with severity indication
   Score: pass
   Evidence: 4/5 sessions had overdue items; all were surfaced with
   due dates. One session had no overdue items (correctly omitted).

3. BEHAVIORAL: Mentions inbox counts (main + sub-inboxes)
   Score: partial
   Evidence: 4/5 sessions showed inbox counts. One session showed main
   inbox count but omitted sub-inbox counts (had 2 items in a sub-inbox
   that went unmentioned).

4. QUALITY: Suggested focus grounded in data, not defaults
   Score: pass
   Evidence: All 5 suggestions referenced specific items (deadlines,
   project momentum, inbox counts). None defaulted to "continue last
   session's work" without evidence.

5. COVERAGE: Morning mode includes calendar + completions
   Score: untestable
   Evidence: Only 1 morning-mode session in sample. Calendar was shown.
   Completions section was present but sparse. Need more morning-mode
   samples to evaluate reliably.

6. BOUNDARY: Does not prescribe what to work on
   Score: pass
   Evidence: All 5 sessions ended with "What feels right?" or similar.
   None said "You should work on X."

### Summary
Assertions: 6 total
- Pass: 4 (67%), Partial: 1 (17%), Fail: 0, Untestable: 1 (17%)
- Pass rate: 80% (4/5 testable)
- Health: Healthy

### Actions
- Sub-inbox counts: add explicit check to orient phase (address partial)
- Morning mode: defer re-assessment until 3+ morning sessions available
```

## For Cabinet Members (Compressed Format)

Cabinet members are simpler — they produce findings in a structured format.
Assessment focuses on:

1. **Signal quality:** Are findings actionable or noise?
   - Check audit triage history: what percentage were accepted vs. rejected?
   - A >50% rejection rate means the cabinet member is miscalibrated.

2. **Portfolio discipline:** Does the cabinet member stay in its domain?
   - Check findings for cross-portfolio observations that duplicate other cabinet members.

3. **Activation accuracy:** Does it fire when relevant and stay quiet when not?
   - Check: did it activate for files/topics outside its declared scope?
   - Check: were there situations where it should have activated but didn't?

Three assertions per cabinet member is sufficient. Use the same
pass/partial/fail/untestable scoring.
