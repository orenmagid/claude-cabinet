# Cabinet — Claude Cabinet

## Active Cabinet Members

All 20 generic cabinet members are installed. Most relevant for this project:

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

Via `/audit` for full sweeps, `/pulse` for quick checks, or composed into
`/plan` critique. The audit module is installed.
