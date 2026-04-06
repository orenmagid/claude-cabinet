# Cabinet Member Lifecycle

How cabinet members enter, evolve, and leave your project's expertise cabinet.
Adding a cabinet member is hiring an expert. Retiring one is letting someone
go when their expertise is no longer needed. Both decisions require judgment.

## When to Adopt a Cabinet Member

**Technology signal.** Adopted React? Consider accessibility and
small-screen. Using SQLite? Consider data-integrity. Chose a
UI framework? Consider a framework-quality cabinet member. The technology
choice itself is the signal — you don't wait for an incident.

**Incident signal.** A security breach, a data loss, a deployment that
broke production — each reveals expertise the project lacked. Build a
cabinet member to carry that expertise forward so the system remembers
what the human might forget.

**Growth signal.** Working with a team? Consider workflow-cop and record-keeper.
Managing multiple areas? Consider organized-mind. Tracking complex state?
Consider data-integrity with broader scope.

**Audit gap signal.** During audit triage, you notice recurring friction
that no cabinet member covers. Before hiring a new cabinet member, check whether
an existing one could expand its scope. If not, that's a genuine gap.

## When to Retire a Cabinet Member

**No signal, no findings.** If a cabinet member hasn't caught a real issue
(approved finding) in 3+ audit cycles, it may be dead weight. Check:
- Has the domain it covers changed? (Migrated off the framework, removed
  the feature)
- Are its paths stale? (Files it checks no longer exist)
- Has another cabinet member absorbed its concerns?

**High rejection rate.** If >50% of a cabinet member's findings are rejected
at triage, it's miscalibrated. Either refine it (via `eval-protocol.md`)
or retire it if the domain isn't worth the maintenance.

**Domain no longer relevant.** Dropped the UI framework the cabinet member
checked. Moved to a managed database that handles integrity itself.
Retired the feature the cabinet member watched.

Retirement is healthy. A lean cabinet of active cabinet members is better
than a large one with dead weight. The system stays lean by actively
pruning, not just actively growing.

## How to Assess

Use `eval-protocol.md` for structured assessment:

1. Define 3-5 assertions about what the cabinet member should catch
2. Sample recent audit runs for evidence
3. Score: pass / partial / fail / untestable
4. Track over time: declining pass rate = drift

**Key metric: triage acceptance rate.** What fraction of a cabinet member's
findings does the user approve vs reject? This is the strongest signal
of calibration quality.

## Cross-Portfolio vs Committee-Assigned

Most cabinet members belong in exactly one committee (see `committees-template.yaml`).
They cover a specific domain and stay in their portfolio.

**Cross-portfolio cabinet members** intentionally span domains. Their expertise
(reasoning quality, cognitive load, test coverage) touches everything.
These activate via `standing-mandate` in their SKILL.md frontmatter,
not by committee membership. Examples: anti-confirmation, qa, debugger,
organized-mind.

Don't put a cross-portfolio cabinet member in a committee. It would run in committee
audits where it doesn't belong, and miss unassigned contexts where it does.

## Creating a New Cabinet Member

A cabinet member is a skill with `user-invocable: false`. Create it in
`.claude/skills/cabinet-{name}/SKILL.md` with:

1. **Identity** — who is this expert? What do they care about?
2. **Convening Criteria** — `standing-mandate`, `files`, `topics`
3. **Research Method** — what to examine, what tools to use, what to
   reason about
4. **Boundaries** — what this cabinet member does NOT own (prevents overlap)
5. **Calibration Examples** — good findings, wrong-portfolio findings, severity
   anchors

Add the cabinet member to your `committees.yaml` under the appropriate committee.
It's automatically discovered by the audit skill.

The best cabinet members emerge from real incidents and real audit findings.
Start rough, refine through use. A cabinet member that catches one real issue
is worth more than one that catches nothing precisely.
