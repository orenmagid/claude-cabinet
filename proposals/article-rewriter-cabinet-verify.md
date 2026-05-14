# Extraction Proposal: cabinet-verify

## Source

- **Project:** article-rewriter (de[sic]ify) — `/Users/orenmagid/article-rewriter`
- **Artifact:** `e2e/` directory + `docs/e2e-walkthrough-verification-plan.md`
- **Type:** skill (skeleton) + runtime package + plan/execute hooks
- **Created:** 2026-04-26 (planning), 2026-05-04/05 (Phase A + B begin) — `act:451e31b3`, `prj:8d0acd7a`
- **First real-world use:** 2026-05-04/05 Phase A shipped end-to-end, drove three product fixes (`act:fcbd3841`, `act:24155551`, `act:0ac07d6f`)
- **Proposal filed:** 2026-05-14

## What It Does

A re-runnable verification harness built on Cucumber + Playwright that drives a human-watched bot through user-flow walkthroughs of the product, replacing flat manual review-UI sessions. Each `.feature` file in `e2e/features/` describes one user-flow scenario in plain Gherkin (e.g., "desktop end-to-end rewrite", "browse history", "iPhone first impression"). Step definitions drive Playwright through the flow against a local dev stack. Most checks are automated DOM/state assertions; subjective checks ("does this feel right?") trigger a **human-verdict pause** — screenshot to disk + terminal-clickable link + stdin prompt for `P`(ass) / `I`(ssues) / `S`(kip) / `N`(ote — pass with observation) plus free-text notes. Verdicts persist to `reports/<runId>.summary.json`; `npm run report:last` surfaces I-verdicts and auto-fails first.

After ~2 weeks of real use it has settled a set of conventions worth preserving: the **verdict-char convention** ("trust the verdict char over the note tone" — a worried-sounding note attached to a `P` is still a pass, context not complaint), the **skip-fresh-passes** flag (`DESICIFY_E2E_SKIP_FRESH_PASSES=1` auto-skips checks whose last verdict was P/N — re-runs after a fix don't re-ask items that already passed), the **`SLOW_MO` knob** ("250 = thoughtful clicker, 500 = real-time narrator, 1000 = explaining to dad") that delays actions but not reads, and the **runId-keyed reports/screenshots/downloads** scheme. These all generalize.

**Known bug to fix during extraction — content-aware cache keys.** The current de[sic]ify cache is keyed by `(scenarioFile, checkId)`. That key is too narrow: a check's prior verdict is only valid if the *path that led the human to that moment* hasn't changed. Removing a UI element in scenario step 4 silently invalidates the human's verdict on step 15 — same checkId, different verifying-experience. The current de[sic]ify workaround is to tell the user to rotate `e2e/reports/*.jsonl`, which is a bandaid. The upstreamed version must include a content signature:

```
key = (scenarioFile, checkId, pathHash)
pathHash = sha256(joined Gherkin steps from scenario start through this check)
```

Computed from the parsed `.feature` AST at run time. When a feature file changes, downstream pathHashes change automatically, prior verdicts no longer match the lookup, skip-fresh-passes naturally misses them. The ledger entries aren't deleted (history preserved); they just stop applying. Zero user action required.

The conservative-vs-fine tradeoff: a typo fix in step 3 invalidates everything downstream of it. False invalidations cost a re-verdict; false hits cost a missed regression. Conservative is right. This also composes with the plan/execute integration: when `/execute` writes a feature edit alongside a code change, the pathHash naturally invalidates the downstream cache, so the next `/verify` re-verdicts exactly the surfaces the change affected.

The novel value over plain Playwright is the human-in-the-loop pause: most production-tier walkthrough tools assume "fully automated or fully manual." The pause acknowledges that subjective UX judgments ("does this feel responsive?", "is the toast clear?") still need a human watching, but the *mechanical* checks (navigation, DOM assertions, downloads, API state) shouldn't.

## Why It's Generic

**Every product with a UI eventually needs walkthrough verification.** The pattern de[sic]ify hit — "a flat list of 122 atomic acceptance criteria is overwhelming and gets verified once, then never again" — recurs in any project that ships multi-PR umbrellas. Scenarios grouped by user flow (not by component or AC ID) are how a human actually verifies software; the abstraction of "scenario = user-flow walkthrough" is medium-agnostic.

**The integration with `/plan` and `/execute` is where the value compounds.** Today, the de[sic]ify harness has a structural gap: scenarios drift from the product as fixes ship in parallel sessions. A fix to the FirstLoginBanner referent landed in main without the matching scenario step being updated. The proposed integration — `/plan` emits feature-file edits as ACs alongside code edits, `/execute` writes them, `/debrief` flags coverage gaps — closes that loop. This is a generic CC concern, not a de[sic]ify concern: every project that adopts the harness will hit the same drift.

**The "scenarios are journeys, code changes are moments in journeys" framing is the load-bearing insight.** Surface-area mapping (which file does this touch? which feature covers that file?) is the wrong abstraction; the right one is judgment over a small set of narrative user flows. That framing is what makes the LLM-driven update reliable instead of mechanical-and-noisy.

**Adjacent cabinet members do not cover this:**
- `cabinet-qa` brings judgment about what *should* be tested (acceptance criteria during plan, active verification during execute), but it does not own a runnable harness or a re-run convention.
- `cabinet-information-design` and `cabinet-usability` evaluate UI design quality, not whether a shipped feature actually works end-to-end.
- `validate` runs structural validation (typecheck, lint, schema gates) — orthogonal to walkthrough verification.

The portfolio boundary: **`/verify` owns the runnable walkthrough harness + the journey-level abstraction; `cabinet-qa` owns the "is this testable, and how?" judgment that feeds it.** Clean seam.

**Concrete generalizability evidence:**
- The human-verdict pause is product-agnostic. So is the verdict ledger.
- The `SLOW_MO`, `SKIP_FRESH_PASSES`, and `--start-maximized` knobs are re-run patterns, not product patterns.
- Three product fixes already shipped *through* the harness in 2 weeks of use (act:fcbd3841 LoginPage back-button, act:24155551 document.title flip, act:0ac07d6f download path) — meaning it has caught real issues in a real flow, not just laboratory-clean ones.

## Suggested Generalized Form

**Three artifacts ship to CC:**

### 1. `/verify` skeleton skill

Mirrors `/orient` and `/debrief`: generic orchestration, phase files for project customization. Subcommands:

- **`/verify`** — runs the suite (replaces direct `npm run verify`)
- **`/verify learn`** — bootstrap or extend. Discover → draft → calibrate → generate. Re-runnable; same flow for zero scenarios and incremental extension.
- **`/verify update <action-fid|diff|free-text>`** — read all features, propose edits to the relevant step(s), or escalate to `learn` if no scenario fits.

**Discovery in `learn` mode is autonomous-first, interview-second** (same pattern as `/onboard` and `/seed`). The skill reads routes, components, CLAUDE.md, omega memory ("key flows" decisions), pib-db (shipped projects), recent git, and optionally drives Playwright to crawl the live UI. It produces a *draft* scenario set. Then it asks the user only the questions discovery couldn't answer — "I see admin routes but only one admin user; real persona or fold into desktop?"

**Phase files** (skeleton has reasonable defaults; project customizes):
- `phases/discover.md` — what to scan (routes, components, persona signals)
- `phases/draft.md` — how to group surfaces into scenarios (defaults: one per user persona, one per major flow)
- `phases/calibrate.md` — what questions to ask, in what order
- `phases/update.md` — how a change description maps to feature edits

**Plan/execute integration** ships as skill files in the corresponding CC skeletons:
- `/plan/phases/verify-plan.md` — phase that emits "Verify Plan" section with feature-file edits as ACs
- `/execute/phases/verify-emit.md` — phase that writes the proposed feature edits alongside code edits
- `/debrief/phases/verify-coverage.md` — phase that flags shipped acts with no covering scenario change

### 2. `@claude-cabinet/verify` runtime package

Vendored npm package installed once at `~/.claude-cabinet/verify/` (mirroring how `omega-venv` ships the omega runtime). Ships:

- Cucumber + Playwright as pinned deps
- **Generic step library** — `Given/When/Then` helpers for human-verdict pause, screenshot capture, verdict recording, fresh-pass skip
- **Verdict ledger writer** — append-only JSON ledger, keyed by `(scenario, checkId)`, persistent across runs
- **Reports module** — `report:last`, `report-status`, JSON aggregator
- **Preflight checks** — dev stack reachability, browser install, fixture freshness
- **SLOW_MO machinery** — wraps Playwright actions only (not reads)
- **runId conventions** — `run-<ISO-timestamp>` keying for reports/screenshots/downloads

Each project's `e2e/package.json` adds `@claude-cabinet/verify` as a dep; `cucumber.js` is generated to point at both the Cabinet step library and the project's own steps. Re-runnable via `npx @claude-cabinet/verify` or the skill.

### 3. Plan/execute hooks

Documented in the skill SKILL.md and surfaced in the `/plan` + `/execute` + `/debrief` skeletons as phase files. The integration contract:

- **`/plan` output convention**: "Verify Plan" section listing feature-file paths + proposed edits (new step, modified step, new scenario). Same shape as the current ACs section.
- **`/execute` behavior**: when shipping the code change, also write the feature-file edit. Failure to write the edit fails the AC.
- **`/debrief` behavior**: at session close, list shipped acts; for each, check whether a feature-file edit landed in the same window. If not, warn.

## What Stays Project-Specific

After extraction, the consuming project's `e2e/` directory contains only what is irreducibly project-shaped:

- **`e2e/features/*.feature`** — the scenarios themselves (the project's user journeys, in Gherkin)
- **`e2e/steps/scenario-*.ts`** — project-specific step glue (imports `Given/When/Then` helpers from `@claude-cabinet/verify`)
- **`e2e/support/selectors.ts`** — DOM selectors for the project's UI
- **`e2e/support/auth.ts`** — project's auth flow (login, token handling)
- **`e2e/fixtures/`** — sample articles, test data
- **`e2e/.env.local.example`** — project-specific config (API base URL, test user credentials)
- **`e2e/cucumber.js`** — generated by the skill, but project-owned (it may pin custom step paths)
- **`e2e/scripts/debug-*.mjs`** and **`scripts/seed-test-users.py`** — project debugging artifacts

**What gets extracted out of de[sic]ify's `e2e/` during migration:**
- `support/human-verdict.ts` (174 lines) → package
- `support/verdict-recorder.ts` (303 lines) → package
- `support/fresh-pass-cache.ts` (157 lines) → package
- `support/auto-check.ts` (56 lines) → package
- `support/output.ts` (177 lines, terminal polish) → package
- `support/manual-runner.ts` (237 lines) → package
- `support/fixture-loader.ts` (71 lines) → package
- `support/preflight.ts` (114 lines) → partly extracted, partly stays (project-specific dev-stack URL checks)
- `support/world.ts` (204 lines) → partly extracted (Playwright lifecycle generic; project-specific context stays)
- `scripts/report-last.mjs`, `scripts/preflight.mjs`, `scripts/report-status.mjs` → package CLI

Roughly **~1,500 lines** of de[sic]ify's `e2e/support/` is generic and should move; **~500 lines** is project-specific and stays.

## Assessment

- **Generalizability: strong.** The walkthrough-verification pattern recurs in every UI-bearing project; the human-verdict pause + skip-fresh-passes + runId conventions are medium-agnostic; the plan/execute integration solves a class of problems (test drift in parallel-session work) not a de[sic]ify problem.
- **Maturity: proven for the harness; early for the plan/execute integration.** 17 scenarios live, ~2 weeks of real use, 3 product fixes driven through it, conventions have settled. The plan/execute hooks are designed but not yet wired — the proposal includes them because the harness alone is half the value; without the hooks, scenarios drift.
- **Complexity: medium.** Skill SKILL.md + 4 phase files + npm package containing ~1,500 lines of TS + 3 phase files added to `/plan`, `/execute`, `/debrief`. The runtime is a clean lift (cucumber + playwright are already vendored-style in de[sic]ify's e2e/). The plan/execute hooks require careful contract design — the "Verify Plan" section in plan output is a new convention that has to slot into the existing plan template without disruption.

## Acceptance Criterion

Following the `cabinet-deployment` precedent: prove generalizability by seeding a second project (Flow, or a fresh app) with `/verify learn` from scratch. If the discover→draft→calibrate→generate loop produces a usable scenario set in <30 min of calibration *without* manual feature-file authoring, the extraction is real. Bonus criterion: `/plan` in that second project emits a Verify Plan section on a new feature, `/execute` writes the feature edit, and `npm run verify` of the new scenario passes against the shipped code on first run.

## Source Artifact Content

The full design contract lives in the source project at:

- **`docs/e2e-walkthrough-verification-plan.md`** — the planning doc (Why this exists / The pattern / Architecture / Phasing). This is the load-bearing doc for understanding the design intent.
- **`e2e/README.md`** — the runtime contract (Quick start / How it works / Verdict-char convention / SLOW_MO / SKIP_FRESH_PASSES). This is what a project owner reads when they sit down to verify.
- **`e2e/features/*.feature`** — 17 live scenarios. Useful as concrete examples of the Gherkin conventions that settled.
- **`e2e/support/human-verdict.ts`, `verdict-recorder.ts`, `fresh-pass-cache.ts`** — the three load-bearing files for the human-in-the-loop pattern. Read these to understand the verdict ledger format and the skip-fresh-passes machinery.
- **`e2e/scripts/report-last.mjs`** — the post-run review CLI that codifies "trust the verdict char over the note tone."

The CC repo evaluating this proposal should pull these five files in addition to reading this proposal — the proposal describes the *shape* of the extraction, but the source files carry the conventions that have settled and shouldn't be reinvented during generalization.
