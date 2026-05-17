# /verify learn — Generate phase

Default behavior: after `phases/calibrate.md` confirms the scenario set,
write `.feature` files + step-definition stubs to disk.

This phase has no interactive surface — it's the final mechanical step
of the learn flow. Calibrate has already collected every input the
generator needs.

## Inputs

- The calibrated `DraftReport` from `phases/draft.md` + edits from
  `phases/calibrate.md`
- The scenario template in `phases/scenario-template.md`

## Outputs

For each scenario in the calibrated DraftReport:

1. `e2e/features/{NN}-{slug}.feature` — Gherkin file rendered from the
   scenario template, with substitutions filled from the
   DraftReport (cost tag, persona tag, scenario name, journey steps).
2. `e2e/steps/scenario-{NN}.ts` — step-definition stub with the
   generic Given/When/Then handlers from `phases/scenario-template.md`'s
   "Generated step-definition stub shape" section. The assertion
   bodies are throw-stubs the user fills in.

Number of files generated = `2 × DraftReport.scenarios.length`.

## Routing shape

The discovery report (`discover.md` "Routing shape" section) carries a
`routingShape: "path" | "hash"` field. When rendering `When I navigate
to "..."` lines:

- `path` (default): emit `When I navigate to "/forecast"`
- `hash`: emit `When I navigate to "#forecast"`

A hash-routing project that gets `/forecast` features fails at every
navigate step — Flow's cold-start hit this. The discover phase probes
for hash routing specifically to prevent it.

## Pre-write checks

Before writing:

1. **Ensure `e2e/` exists.** If not, run `install.sh` first (with
   `--dry-run` removed). This scaffolds package.json, tsconfig,
   cucumber.js, .env.local.example, and the directory tree.
2. **Check for collisions.** For each planned output path, if a file
   already exists, ask the user: "overwrite, skip, or pick a new name?".
   Don't silently clobber existing scenarios — they may have been
   hand-edited.
3. **Validate checkId uniqueness.** Within a scenario, each step's
   checkId (`NN.NN`) must be unique. Across scenarios, the first
   number should be the scenario index (e.g., `1.01`–`1.30` in
   scenario 1, `2.01`–`2.25` in scenario 2). Per CONVENTIONS.md, the
   pathHash algorithm requires intra-scenario uniqueness; cross-scenario
   collisions throw at compute time.

## Post-write summary

After writing, print a summary the user can paste into commit messages:

> Generated N scenarios:
>   features/01-{name}.feature  ({persona} {cost})  + steps/scenario-01.ts
>   features/02-{name}.feature  ({persona} {cost})  + steps/scenario-02.ts
>
> Next:
>   cd e2e
>   npm install              # if first run, picks up the cabinet-verify dep
>   npm run install:browsers # if first run, downloads chromium
>   npm run verify           # smoke (free scenarios only)

Do NOT auto-run the verify step — first-run scenarios will fail
(assertion stubs throw `not implemented`). The user runs verify, fills
in the assertions as they go.

## Idempotency

Re-running `/verify learn` should be safe. If scenarios already exist,
calibrate offers to extend rather than regenerate. If the user
explicitly says "regenerate", this phase warns about collisions
per the Pre-write checks section.
