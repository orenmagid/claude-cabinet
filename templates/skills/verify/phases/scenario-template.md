# /verify learn — Scenario template

Default Gherkin shape for generated `.feature` files. Customize this
file if your project uses a different checkId convention or tag set.

## Gherkin template

```gherkin
{{costTag}} {{personaTag}} {{platformTag?}}
Feature: {{scenarioName}}
  As a {{persona}}, I should be able to {{journey-summary}} —
  all without {{anti-failures}}.

  This is the {{scenarioName}} walkthrough.

  Background:
    Given the local dev stack is up
    {{#if persona === '@as-user'}}
    And I am signed in as the "user" role
    {{/if}}
    {{#if persona === '@as-admin'}}
    And I am signed in as the "admin" role
    {{/if}}
    {{#if persona === '@as-fresh'}}
    And I have just accepted an invite
    {{/if}}

  Scenario: {{scenarioName}}
    # ── {{Stage 1 name}} ─────────────────────────────────────
    When I navigate to "{{startRoute}}"
    Then check "{{N}}.01 {{slug}}" {{step description}}
    And check "{{N}}.02 {{slug}}" {{step description}}
    And ask the human "{{N}}.03 {{slug}}: {{subjective question}}?"

    # ── {{Stage 2 name}} ─────────────────────────────────────
    When {{action}}
    Then check "{{N}}.04 {{slug}}" {{step description}}
    ...
```

## CheckId convention

Per CONVENTIONS.md §CheckId/Step-ID Convention:

- Format: `<scenarioNum>.<stepNum>` (e.g., `1.01`, `1.02`, …, `1.30`)
- Quoted-arg form preferred: `check "1.01 slug-name" the workspace
  heading is visible`
- The `slug-name` immediately after the checkId is a short
  identifier for grep-ability and report-readability
- Step text after the closing quote is the assertion in plain English

Substeps (e.g., `1.10b`) are allowed for late additions that maintain
chronological position without renumbering everything below.

## Cost + persona + platform tags (top of file)

Required tags:
- Cost: `@free` / `@api-small` / `@api-large`
- Persona: `@as-user` / `@as-admin` / `@as-fresh`

Optional tags (projects extend):
- Platform: `@desktop` / `@ios` / `@android` (default `@desktop`)
- Modality: `@manual` (for non-Playwright scenarios driven by
  `walkManualChecklist` against a markdown file)

## Step types

Three step shapes the scenario uses:

1. **`When I navigate to "..."`** — Playwright `page.goto(url)`.
2. **`Then check "NN.NN slug" <assertion>`** — automated check via
   `autoCheck(this, 'NN.NN slug', async () => { /* assert */ })`.
3. **`And ask the human "NN.NN slug: <question>?"`** — human-verdict
   pause via `askHumanVerdict(this.page, 'NN.NN', '<description>')`.

Mix automated checks (most of the scenario) with human-verdict pauses
at moments that genuinely need subjective judgment. Don't pause for
mechanical checks — auto-check them. Don't auto-check things you
actually need to see ("does this layout feel right?") — pause.

## Per-step timeout override (Cucumber v11)

Pass an options object as the **second argument** to disable or change
the timeout for a single step:

```ts
Then('step text', { timeout: -1 }, async function () { ... })
```

`timeout: -1` disables the timeout entirely (used by `ask the human`
steps that wait for human input). Do NOT use the wrapping-object form
`Then({pattern, timeout}, fn)` — that is not valid Cucumber v11 API.

## Stage comments

The scenarios use `# ── Stage name ────────────` comments to separate
logical phases of the journey. These don't affect execution; they
give the operator visual landmarks during the run.

## Generated step-definition stub shape

The five baseline step handlers (`Given the local dev stack is up`,
`Given I am signed in as the "{role}" role`, `When I navigate to {string}`,
`Then check {string} {}`, `Then ask the human {string}`) are registered
by `cabinet-verify` itself when the World module is imported. Per-
scenario files contain **only** the scenario-specific assertion bodies,
registered by checkId via `registerCheck`.

For each scenario, generate `e2e/steps/scenario-{N}.ts` with:

```ts
import { registerCheck } from 'cabinet-verify';
import type { CabinetVerifyWorld } from 'cabinet-verify';

// One registerCheck call per `check "N.NN slug"` step in the feature
// file. The function body is the real assertion — fill in as you
// verdict the scenario for the first time.

registerCheck('N.01 slug-name', async (world: CabinetVerifyWorld) => {
  // TODO: replace with the real assertion against world.page.
  throw new Error('not implemented');
});

registerCheck('N.02 slug-name', async (world: CabinetVerifyWorld) => {
  throw new Error('not implemented');
});

// …one per check step in the scenario.
```

`ask the human "..."` steps need no per-id registration — the baseline
handler routes straight to `askHumanVerdict`. They only show up in the
`.feature` file.

### When an interaction is not driveable

If a step cannot be exercised by Playwright (drag-and-drop via
dnd-kit, transient file inputs, etc. — see `phases/recipes.md`),
DO NOT emit a `// Smoke no-op` body. That creates a passing scenario
that verifies nothing.

Two acceptable shapes instead:

1. **Skip until testable.** Throw with an explicit "skip" marker and
   file a finding against the consuming project for the test seam.

   ```ts
   registerCheck('N.07 dnd-reorder-applied', async (world) => {
     throw new Error('SKIP: dnd-kit drag is not driveable from Playwright — see recipes.md Recipe 1');
   });
   ```

2. **API surrogate.** Bypass the UI for the action; verify the result
   via the UI in the next step. This is the documented dnd-kit
   workaround in `recipes.md`.

In both cases, file the finding when you spot the gotcha — not later.
The recipes document records the pattern so the same time sink does
not recur on the next consumer.

The stubs throw on the auto-check assertion bodies. The user fills
them in as they verdict the scenario for the first time — typical
workflow is "run it, see what fails, write the assertion, repeat".
This is faster than guessing assertions upfront.
