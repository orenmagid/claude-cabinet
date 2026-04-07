# Cabinet — Claude Cabinet

## Active Cabinet Members

All 27 generic cabinet members are installed. Most relevant for this project:

- **architecture** — CLI structure, module boundaries, template/runtime separation
- **workflow-cop** — the meta-process layer (CC's own session loop, onboarding flow)
- **record-keeper** — README accuracy, skill SKILL.md quality, phase file clarity
- **usability** — CLI UX, onboard interview quality, error messages
- **roster-check** — whether the skill set covers the project's actual needs
- **anti-confirmation** — challenge assumptions about the methodology itself

Reference `committees.yaml` (upstream) and `committees-project.yaml` (project
customizations) for canonical grouping. Run `node scripts/resolve-committees.cjs`
to see the merged result.

## Portfolio Rules

Standard portfolio rules apply. Each cabinet member stays in its domain. When a
cabinet member notices something outside its portfolio, it flags it for the
relevant cabinet member rather than developing the observation itself. The one
exception is anti-confirmation, which intentionally crosses portfolios because
its domain (reasoning quality) touches everything.

## How Cabinet Members Are Invoked

Via `/audit` for full sweeps, `/pulse` for quick checks, `/plan` critique,
or automatically via standing mandates. Members declare which contexts they
activate in (orient, debrief, plan, execute, investigate, seed) via
frontmatter `standing-mandate` and provide scoped `directives` for each
context. The skill index (`.claude/skills/_index.json`) enables fast
lookup. Use `/cabinet` to browse members or consult one directly.

**Project-level directive overlay:** `.claude/cabinet/directives-project.yaml`
extends upstream member definitions with project-specific mandates and
directives. Lets consuming projects customize member behavior without modifying
upstream files. Merged at runtime alongside `committees-project.yaml`.
