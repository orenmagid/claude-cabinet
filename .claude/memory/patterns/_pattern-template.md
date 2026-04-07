# Pattern File Format Template

This documents the frontmatter schema for feedback patterns — the
reusable structure for any project's feedback-to-enforcement pipeline.

## How Patterns Work

Patterns consolidate recurring observations (friction, mistakes, things
that worked) into named rules with enforcement classification. They are
the intermediate step between raw feedback captures and enforced rules.

## The Schema

```yaml
---
name: pattern-descriptive-name
description: >
  One-line description of what this pattern captures. Should be specific
  enough to decide relevance without reading the full content.
type: pattern
sources:
  - feedback-observation-that-led-to-this.md
  - another-observation.md
  - a-third-observation.md
enforcement: guide | detect | prevent | document
promotion_candidates:
  - rule-or-hook-name-if-ready-for-promotion
---
```

## Fields

### `name`
Descriptive slug. Convention: `pattern-{domain}-{topic}` or just
`pattern-{topic}`.

### `description`
One-line summary. Used by orient/debrief to decide whether to load
the full pattern. Be specific — "deployment issues" is too vague;
"silent deployment failures and stale build log output" is useful.

### `type`
Always `pattern` for consolidated feedback patterns.

### `sources`
List of raw observation files that were consolidated into this pattern.
Preserves provenance — you can trace any rule back to the specific
incidents that motivated it.

### `enforcement`
How this pattern should be enforced. Determines promotion target:

| Value | Meaning | Compliance | Promotion Target |
|-------|---------|------------|-----------------|
| **guide** | Prompt context (CLAUDE.md or memory) | ~60-80% | Rules file or CLAUDE.md section |
| **detect** | Validation script or PostToolUse hook | ~80-90% | Validation script |
| **prevent** | PreToolUse hook or pre-commit hook | ~100% | Deterministic hook |
| **document** | Reference material, not a rule | N/A | Documentation |

### `promotion_candidates`
Specific rules within this pattern that are ready to move up the
compliance stack. Empty list `[]` if nothing is ready for promotion.

## Body Structure

After the frontmatter, the body follows this structure:

```markdown
## Principle

One paragraph: the core lesson this pattern encodes.

## Rules

- Concrete, actionable rules derived from the principle.
- Each rule should be testable — you can tell whether it was followed.

## When This Applies

When to apply these rules (triggers, file types, situations).
```

## Example

```yaml
---
name: pattern-deployment-verification
description: >
  Silent deployment failures and stale CLI output — always verify
  deployments through authoritative sources, not just CLI success messages.
type: pattern
sources:
  - feedback-railway-stale-logs.md
  - feedback-deploy-without-verify.md
  - feedback-silent-build-failure.md
enforcement: detect
promotion_candidates:
  - post-deploy-verification-hook
---

## Principle

Deployment tools report success based on submission, not outcome. The
CLI saying "deployed" means "I sent the request," not "it's running."
Always verify through the deployment platform's authoritative source.

## Rules

- After every deploy, verify the change is live (hit the endpoint,
  check the dashboard, read the build log from the platform itself).
- If the CLI build log is stale, use the web dashboard as fallback.
- Never assume a deploy worked because the command exited 0.

## When This Applies

Any deployment to a remote platform (Railway, Vercel, AWS, etc.).
Also applies to LaunchAgent restarts and any operation where the
success indicator is decoupled from the actual outcome.
```
