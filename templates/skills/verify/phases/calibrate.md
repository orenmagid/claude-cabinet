# /verify learn — Calibrate phase

Default behavior: walk the user through the DraftReport one question at
a time. Each answer shapes the next question. Never batch.

## What calibrate is for

cabinet-qa proposed up to 5 scenarios in `draft.md`. The model knows
the surfaces; the user knows which ones matter for THIS release, which
personas are real, what the dev-stack URLs are, and what to call the
scenarios. Calibrate is where the user's knowledge fills in the gaps
the model couldn't fill from code alone.

## Question discipline

**One question at a time.** Project convention (CLAUDE.md global rule).
Each answer might invalidate a later question — batching wastes the
user's attention.

If a question can be inferred with high confidence, skip it and
proceed. If you're below 80% confidence, ask.

## Standard question order

The default flow asks these in order, skipping any with high-confidence
defaults from discovery:

### 1. Dev stack URL

> "What's the URL your dev stack runs on (the one Playwright will
> drive)? Default: http://localhost:5173"

Used to seed `CABINET_VERIFY_DEV_URL` in `.env.local.example` and
preflight. Confidence-high default: read `vite.config.{ts,js}` for the
configured port; if found, use it without asking.

### 2. Persona reality check

For each persona suggested by the DiscoveryReport (e.g., `@as-admin`,
`@as-fresh`), ask:

> "I see [persona signal — e.g., '/admin routes guarded by RequireAdmin'].
> Do you have a real admin user in your dev environment, or should I
> fold admin flows into the main user scenario for v0.1.0?"

The answer determines whether the persona's scenarios survive into the
generated set or fold into the main user scenario.

### 3. Cost tag interpretation

For each `@api-small` or `@api-large` scenario:

> "Scenario [name] is tagged @api-small (hits a paid API). What's the
> expected per-run cost? Default: \$0.05–0.15. Skip this scenario from
> `npm run verify:cheap` if cost exceeds your comfort threshold."

### 4. Leftover surface triage

For each item in `DraftReport.leftover`:

> "Surface [X] was discovered but not assigned to any scenario (reason:
> [Y]). Add a scenario for it, fold it into [nearest scenario], or
> defer for a future `/verify learn` run?"

Capped at 5 leftover-triage questions per session to avoid drowning
the user. If more than 5 leftovers exist, generate the first 5 +
note the rest for a follow-up `/verify learn` invocation.

### 5. Live UI crawl opt-in (if not already run)

If the dev stack is up and the user wants stronger coverage:

> "Want me to launch Playwright and crawl the dev stack to find UI
> surfaces I missed in the static scan? Adds ~30s + a screenshot
> dump. (y/n)"

If yes, re-run discovery with the crawl subagent enabled and
re-prompt cabinet-qa with the expanded surface set.

### 6. Scenario name confirmation

For each scenario in DraftReport.scenarios, show the proposed name +
1-line journey summary:

> "Scenario 1: [name] — [journey summary]. Keep this name, or
> rename?"

If a scenario name is ambiguous or de[sic]ify-coloured (e.g., still
references a domain term from the cabinet-qa pass), the user
overrides here.

### 7. Generate confirmation

Final summary before writing files:

> "Generating [N] scenarios:
> - features/01-[name].feature [persona] [cost]
> - features/02-[name].feature ...
>
> Step definitions will go in steps/. Selectors centralised in
> support/selectors.ts (you fill these in as scenarios fail). Proceed?
> (y/n)"

On yes, write the .feature files using `phases/scenario-template.md`
and step-definition stubs. Run `install.sh` first if `e2e/` doesn't
yet exist.

## Output

After calibrate completes, the next phase ("generate" — implicit in
the SKILL.md workflow) writes `e2e/features/NN-name.feature` and
matching `e2e/steps/scenario-NN.ts` stubs.

No separate phase file for generation — the template + the calibrated
DraftReport are sufficient inputs.
