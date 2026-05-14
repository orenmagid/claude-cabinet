# /plan integration with cabinet-verify — verify-plan phase

**Contract: v0.x soft — may change before v1.0.** This phase enables
the `/verify` integration with `/plan`. It is a customization phase
(opt-in), copied into your project only when the `verify` module is
selected during `npx create-claude-cabinet`.

## What this phase does

When `/plan` produces a plan involving UI changes, emit a
`## Verify Plan` section that lists feature-file paths plus proposed
edits. `/execute` reads this section and writes the feature-file
edits alongside the code change, so scenarios stay in sync with the
product.

## No-op guard

Before doing anything, this phase checks for `e2e/features/` in the
project root. **If the directory is absent, exit silently** — the
project hasn't installed the `/verify` runtime, and emitting a
Verify Plan section against scenarios that don't exist would be
noise.

Detection:

```bash
test -d e2e/features
```

If the test fails, skip this phase entirely. No warning, no log line.
The user installs `/verify` when they're ready; until then, `/plan`
behaves as if this phase isn't here.

## When to emit a Verify Plan section

Emit the section when the plan's surface area touches UI code. The
specific signals depend on project conventions; common patterns:

- Modified file path matches `webapp/frontend/src/`, `app/`, `pages/`,
  or `components/`
- Plan description mentions a route, a page, a modal, a UI flow
- Plan changes user-visible behavior (vs. internal refactor, schema
  migration, deploy config)

If unsure, ask the user during plan drafting: "Does this plan need a
Verify Plan section? (y/n)". Don't auto-emit on every plan — that
generates noise for backend-only changes.

## Section format

The `## Verify Plan` section sits alongside the existing
`## Acceptance Criteria` and `## Surface Area` sections. It lists
feature-file paths plus proposed edits:

```markdown
## Verify Plan

- features/01-desktop-rewrite.feature: ADD step after the existing
  "settings-bar-appears" check — verify the model picker is absent
  (1.10b model-picker-absent).
- features/03-multi-tab.feature: MODIFY the "active-run-banner-text"
  step to assert the new banner copy after Phase B.
- features/13-first-time-user.feature: NEW scenario — invite roundtrip
  + empty states for a freshly-signed-up user.
```

Edit verbs:
- **ADD step after `<anchor>`** — a new step inserted at a specific
  position
- **MODIFY step `<checkId>`** — change an existing step's assertion
- **NEW scenario** — a whole new `.feature` file
- **REMOVE step `<checkId>`** — for deprecations

Each entry begins with `- features/<file>.feature:` so the line is
machine-parseable for `/execute`'s `verify-emit` phase.

## Integration with acceptance criteria

The Verify Plan section is **treated like an AC**: if `/execute`
fails to write the feature-file edit, the corresponding AC is marked
unmet. This is enforced by the `verify-emit` phase in `/execute`.

You may explicitly tag a Verify Plan entry as deferred:

```markdown
- features/05-framework-smoke.feature: (deferred) ADD step for the
  new framework migration banner — requires the migration to land
  in webapp first.
```

Deferred entries are recorded but don't block execution.

## When the plan has no UI surface

Backend-only plans, schema migrations, and infrastructure changes
don't need a Verify Plan section. Emitting one for them generates
noise during `/execute`. Use judgment — when in doubt, ask the user.
