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

## Stage comments

The scenarios use `# ── Stage name ────────────` comments to separate
logical phases of the journey. These don't affect execution; they
give the operator visual landmarks during the run.

## Generated step-definition stub shape

For each scenario, generate `e2e/steps/scenario-{N}.ts` with:

```ts
import { Given, When, Then } from '@cucumber/cucumber';
import { autoCheck, askHumanVerdict } from 'cabinet-verify';
import { CabinetVerifyWorld } from 'cabinet-verify';

When('I navigate to {string}', async function (this: CabinetVerifyWorld, route: string) {
  await this.page.goto(this.baseUrl + route);
});

Then('check {string} {}', async function (this: CabinetVerifyWorld, idAndSlug: string, _rest: string) {
  await autoCheck(this, idAndSlug, async () => {
    // TODO: replace with the real assertion. The step text after the
    // quoted arg ('the workspace heading is visible' etc) is in _rest.
    throw new Error('not implemented');
  });
});

Then('ask the human {string}', async function (this: CabinetVerifyWorld, idAndDescription: string) {
  const space = idAndDescription.indexOf(' ');
  const checkId = space >= 0 ? idAndDescription.slice(0, space) : idAndDescription;
  const description = space >= 0 ? idAndDescription.slice(space + 1) : '';
  await askHumanVerdict(this.page, checkId, description);
});
```

The stubs throw on the auto-check assertion bodies. The user fills
them in as they verdict the scenario for the first time — typical
workflow is "run it, see what fails, write the assertion, repeat".
This is faster than guessing assertions upfront.
