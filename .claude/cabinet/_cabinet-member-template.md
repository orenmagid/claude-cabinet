# Cabinet Member Template

Use this template when creating new cabinet members via `/seed` or
manually. Every section is required unless marked optional. The structure
ensures consistent quality across the cabinet and enables validation.

## Reference Implementation

See `cabinet-security/SKILL.md` for a fully upgraded example showing
all sections in practice.

---

## Required Frontmatter

```yaml
---
name: cabinet-{name}
description: >
  One sentence: what this member evaluates and why it matters.
  Start with a role noun ("Security engineer who...", "Performance
  analyst who...", "Data coherence analyst who...").
user-invocable: false
briefing:
  - _briefing-identity.md
  # Add other briefing files relevant to this member's domain
  # Common: _briefing-architecture.md, _briefing-jurisdictions.md, _briefing-api.md
standing-mandate: audit
  # Add plan, execute, orient, debrief if this member should activate
  # in those contexts. Most members are audit-only.
tools:
  # List every external tool/command this member uses.
  # Format: "tool-name (scope -- what it does)"
  # Examples:
  #   - npm audit (Node projects -- dependency vulnerabilities)
  #   - sqlite3 (SQLite projects -- index coverage, EXPLAIN QUERY PLAN)
  #   - grep patterns (all projects -- dead code detection)
  # Use "tools: []" for pure-reasoning members with no tool stage.
directives:
  # Only if standing-mandate includes plan, execute, orient, or debrief.
  # Each directive is a one-sentence focused task for that context.
  # plan: >
  #   What to evaluate when reviewing a plan.
  # execute: >
  #   What to watch for during code execution.
---
```

## Required Sections (in order)

### 1. Identity

Who this expert is. What they care about. What threat model or quality
dimension they evaluate. One role, bounded scope, specific to the
project's actual risk profile.

Include:
- The expert's perspective in **bold** ("You are a **security engineer**
  thinking about...")
- The bounded threat model or quality dimension
- What this is NOT about (calibrate expectations)

### 2. Convening Criteria

When this member activates:
- `standing-mandate` contexts
- File patterns that trigger activation
- Topic keywords
- Any mandatory-for triggers (e.g., "all plans that add API endpoints")

### 3. Investigation Protocol

**Two stages: measure first, then reason.**

#### Stage 1: Instrument

Concrete commands to run. Each tool is optional — include an explicit
fallback for when the tool is unavailable:

```markdown
**1a. [Check name]**

\`\`\`bash
# The command to run
tool-name --flags 2>/dev/null
\`\`\`

Parse output and flag [specific conditions]. If [tool] is unavailable:
[manual fallback — what to grep, read, or check instead].
```

Rules:
- Every tool reference MUST have an "if unavailable" fallback
- Fallbacks should be grep patterns, file reading, or manual checklists
- The member must produce useful findings with zero tools available
- Include a "Stage 1 results" summary template

#### Stage 2: Analyze

Manual code reading and reasoning informed by Stage 1 results. This is
where domain expertise matters — tools find candidates, analysis
confirms and contextualizes them.

Group analysis areas with clear labels (2a, 2b, 2c...). Reference
relevant standards by number where applicable (OWASP, WCAG, etc.).

### 4. Scan Scope

What files and directories to examine. Reference `_briefing.md` for
project-specific paths. Use comments to tell consuming projects where
to customize.

### 5. Portfolio Boundaries

What this member does NOT own. Name the other cabinet member responsible
for each excluded area. This prevents overlap and scope creep.

Format: "X concerns (that's {other-member})"

### 6. Calibration Examples

2-4 examples at different severities showing what a finding looks like.
Include at least one "not a finding" and one "wrong portfolio" example
to anchor the boundaries.

### 7. Historically Problematic Patterns

Two-file overlay:

```markdown
## Historically Problematic Patterns

Two sources — read both and merge at runtime:

1. **This section** (upstream, CC-owned) — universal patterns that apply to
   any project. Grows when consuming projects promote recurring findings
   via field-feedback.
2. **`patterns-project.md`** in this skill's directory — project-specific
   patterns discovered during audits of this particular project. Project-
   owned, never overwritten by CC upgrades.

If `patterns-project.md` exists, read it alongside this section. Both
inform your analysis equally.

**How patterns get here:** A consuming project's audit finds a real issue.
If the same pattern recurs across projects, it gets promoted upstream via
field-feedback. The CC maintainer adds it to this section. Project-specific
patterns that don't generalize stay in `patterns-project.md`.

<!-- Universal patterns below this line -->
```

This section starts empty for new members. It accumulates from real
findings over time — never pre-fill with hypothetical patterns.

## Optional Sections

- **directives** (frontmatter) — only if the member activates in
  non-audit contexts
- **activation** (frontmatter) — file patterns and topic keywords,
  if different from convening criteria
- **Knowledge Sources** — if the member uses MCP servers, WebSearch,
  or framework documentation
- **interactive-only** (frontmatter) — set to `true` if the member
  requires preview tools or a running dev server
