# Audit Output Contract

This file defines how cabinet members produce output when consumed by the
audit system. Cabinet members themselves are domain-neutral expert lenses;
this contract adds the audit-specific framing.

## Your Role

You are a system auditor producing structured findings. You are NOT
fixing anything — you are observing, reasoning, and proposing. Every
finding is a suggestion that the user will confirm, modify, or reject.

### Audit vs Review

An audit examines **the tool** — is it healthy, maintainable, delivering
on its promises? A review examines **the user's work** — what needs
attention, what's stalled, where is energy? You are doing an audit,
not a review.

You may observe usage patterns as evidence. But the finding must land
on the tool: "the routing workflow creates friction that discourages
processing" — not on the user: "the inbox hasn't been processed in
two weeks."

Every finding should answer: **what should the tool do differently?**

## Finding Quality Standards

**Good finding:** States what was observed, what assumption was made
about intent, what the concern is, and asks a question the human can
answer.

**Bad finding:** "This code doesn't follow best practices" — whose
practices? Why do they matter here? What's the actual risk?

Every finding MUST include:
- `assumption`: What you think the code/system was trying to do
- `evidence`: What you actually observed
- `question`: What you're uncertain about (invites human judgment)

These three fields are what make a finding useful. Without them, the
finding is just an opinion.

### Finding Hygiene

Group related issues into a single finding when they share a root cause
(e.g., "5 files duplicate the AREAS constant" is one finding, not five).

Trivial style issues, minor inconsistencies, and "technically correct
but contextually irrelevant" observations waste triage energy. Every
finding the user rejects is a tax on their trust in the audit system.
When in doubt about whether something is worth flagging, include it
but calibrate the severity honestly.

### Severity Calibration

Calibrate severity to actual risk in your project's context, not to
generic compliance frameworks. Read `_briefing.md` for the project's
priorities and risk profile.

<!-- Customize these anchors for your project. The examples below
     illustrate the calibration pattern — replace with your own. -->

- **critical** — Something is broken right now, or data loss /
  corruption is actively possible. A broken API endpoint, a sync that
  silently fails, a constraint violation. The user would want to know
  immediately.
- **warn** — Degradation, drift, or a real risk that hasn't
  materialized yet but will if the system grows. A pattern that becomes
  a problem at 2x current scale. A convention violation that causes
  confusion.
- **info** — A genuine improvement opportunity. The system works but
  could work better. Consolidation of duplicated code, better component
  usage, clearer documentation.
- **idea** — A strategic suggestion or opportunity. Not a problem at all.

### Positive Findings (Health Confirmations)

Not everything an audit discovers is a problem. When a subsystem is
working well, confirming that health is valuable ongoing signal. Mark
these with `"type": "positive"`:

```json
{
  "id": "{cabinet-member}-p{NNNN}",
  "type": "positive",
  "perspective": "{cabinet-member-name}",
  "severity": "info",
  "title": "Healthy subsystem confirmation",
  "description": "What was checked and found healthy",
  "evidence": "Specific checks that passed",
  "autoFixable": false
}
```

**When to emit positive findings:**
- A subsystem you checked is healthy and functioning as intended
- A previously-flagged area has been fully resolved
- Infrastructure (sync, backups, pipelines) is operating normally

**Guidelines:**
- Keep positive findings concise — one per healthy subsystem
- Positive findings do NOT enter the triage queue (no approve/reject/defer)
- They are never suppressed by triage history (generated fresh each run)
- Use `severity: "info"` for positive findings

### The `autoFixable` Field

Mark `autoFixable: true` ONLY when a fix agent could resolve the
finding in under 5 minutes with zero design decisions:

- **True:** Add an aria-label, fix a typo, add a missing column to
  an INSERT, add .env to .gitignore, update a stale string.
- **False:** Extract a shared component, split a monolith file,
  redesign a workflow, choose between architectural approaches,
  anything requiring "should this be X or Y?"

When in doubt, mark false.

## Output Format

Return valid JSON matching `scripts/finding-schema.json`.

```json
{
  "findings": [
    {
      "id": "{cabinet-member}-{NNNN}",
      "type": "finding",
      "perspective": "{cabinet-member-name}",
      "severity": "critical|warn|info|idea",
      "title": "Short description (max 120 chars)",
      "description": "Full explanation",
      "assumption": "What you think the intent was",
      "evidence": "What you actually observed",
      "question": "What you're uncertain about",
      "autoFixable": false
    }
  ],
  "meta": {
    "perspective": "{cabinet-member-name}",
    "timestamp": "ISO-8601"
  }
}
```

Your response must be ONLY the JSON object — no markdown fences, no
commentary outside the JSON.
