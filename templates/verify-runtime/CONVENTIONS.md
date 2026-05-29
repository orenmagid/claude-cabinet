# cabinet-verify conventions

This document is the frozen contract referenced by Phases 1–7 of the
`prj:c98f18bb` extraction. Every section below defines a shape that
downstream code, tests, and skills assume. **Changes here ripple
through every phase — do not edit lightly.**

The conventions are split into two groups:

- **Core sections** (8): runtime-internal shapes the TS package depends on.
- **Plan-level sections** (3): cross-phase conventions surfaced during QA
  review that don't fit cleanly into the runtime but must be frozen
  alongside it.

---

## Verdict Ledger Schema

Each verdict written to `reports/<runId>.jsonl` is a single JSON object
with this exact shape:

```ts
interface VerdictRow {
  runId: string;            // e.g., "run-2026-05-04T14-38-56-475Z"
  runStartedAt: string;     // ISO 8601 timestamp
  gitSha: string;           // full SHA, "unknown" if outside a git repo
  scenarioFile: string;     // relative to e2e/, e.g. "features/01-desktop.feature"
  scenarioTitle: string;    // Cucumber scenario name
  stepText: string;         // full step text (Given/When/Then…)
  checkId: string;          // leading NN.NN token from stepText
  pathHash: string;         // 16-char hex; see pathHash Spec section
  acItemId: string | null;  // optional mapping → external review-UI item ID
  verdict: string;          // 'auto:pass' | 'auto:fail' | 'human:P' | 'human:I' | 'human:S' | 'human:N'
  source: 'auto' | 'human';
  screenshotPath: string | null;
  notes: string | null;
  durationMs: number;
  role: string;             // 'user' | 'admin' | 'fresh' | …
  costUsd: number | null;
}
```

This is the same shape as de[sic]ify's `VerdictRow`
(`e2e/support/verdict-recorder.ts:12–28`) **except the new field
`pathHash: string` is added** between `checkId` and `acItemId`.

Old ledger rows (pre-upgrade) without `pathHash` are tolerated by the
fresh-pass cache loader, which computes the hash lazily from the row's
`scenarioFile + stepText` and skips the row if parsing fails. Intentional
invalidation on schema change.

`pathHash` may be the empty string for `source: 'auto'` rows — auto-checks
don't gate on human verdict freshness, so the field is informational
only for them. For `source: 'human'` rows, the human-verdict call site
ensures a non-empty hash.

## Verdict Chars

A human verdict is a single character followed by optional free-text
notes. Four valid chars:

| Char | Meaning | Filing rule |
|---|---|---|
| `P` | Pass | Notes are FYI / context. **Do not file as an action.** |
| `I` | Issues | The user flagged a real problem. **File as a pib-db action.** |
| `S` | Skip | The check didn't apply (no fixture, wrong viewport, etc.). No action. |
| `N` | Pass with observation | Forward-looking observation, not a defect. **File only if explicitly requested.** |

**Verdict-char-over-note-tone rule.** A worried-sounding note attached to
a `P` is still a pass. The user wrote it as context, not as a complaint.
Triage tools (`cabinet-verify-report-last`) surface `I` and `auto:fail`
first; `P`/`N` notes are printed but visually de-emphasised so the
operator's attention goes to real problems.

Auto-fail rows (`verdict: 'auto:fail'`) are always actionable — either
a regression or a stale selector.

## Cost Tags

Scenarios carry a single cost tag that drives which `npm run verify:*`
script picks them up:

- `@free` — no external API cost
- `@api-small` — small cost (e.g., ~$0.05–0.15 per run)
- `@api-large` — large cost (e.g., ~$2–5 per run)

Projects extend with their own scale (e.g., `@api-xlarge`,
`@gpu-burn`) as needed. The runtime treats unknown tags as
project-specific and passes them through unchanged.

## Role Tags

Scenarios declare the user role they exercise with one of:

- `@as-user` — signed-in regular user
- `@as-admin` — admin role
- `@as-fresh` — invited-but-not-yet-signed-in user (account creation flow)

Projects extend (e.g., `@as-billing-manager`, `@as-readonly`). Role
parsing happens in `world.ts`'s Before hook; the auth helper signs in
as the right role via env-var-driven credentials.

## Env-Var Prefix

All cabinet-verify runtime env vars use the prefix `CABINET_VERIFY_`.
Renames during extraction from de[sic]ify:

| Old name | New name |
|---|---|
| `DESICIFY_E2E_SKIP_FRESH_PASSES` | `CABINET_VERIFY_SKIP_FRESH_PASSES` |
| `DESICIFY_E2E_AUTO_SKIP_HUMAN` | `CABINET_VERIFY_AUTO_SKIP_HUMAN` |
| `DESICIFY_E2E_AUTO_OPEN_SCREENSHOTS` | `CABINET_VERIFY_AUTO_OPEN_SCREENSHOTS` |
| `DESICIFY_E2E_AUTOFUND` | `CABINET_VERIFY_AUTOFUND` |
| `DESICIFY_E2E_USER_EMAIL` / `_PASSWORD` | `CABINET_VERIFY_USER_EMAIL` / `_PASSWORD` |
| `DESICIFY_E2E_ADMIN_EMAIL` / `_PASSWORD` | `CABINET_VERIFY_ADMIN_EMAIL` / `_PASSWORD` |
| `DESICIFY_E2E_FRESH_EMAIL` / `_PASSWORD` | `CABINET_VERIFY_FRESH_EMAIL` / `_PASSWORD` |

`CABINET_VERIFY_DEV_URL` is the new env var consuming projects use to
point the preflight check at their local dev stack
(`http://localhost:5173`, etc.).

`HEADLESS=1` (no prefix) controls Playwright's browser-launch headedness
to match Playwright's own convention. `SLOW_MO=<ms>` (no prefix) controls
the human-pace delay knob on Playwright actions.

Consuming projects may keep their own prefixed env vars for
project-specific concerns (e.g., `DESICIFY_DEV_URL` for the dev stack
URL, then pass it to cabinet-verify's `CABINET_VERIFY_DEV_URL` in their
own preflight wrapper).

## Demo Mode Env Vars

Demo mode makes a visible (`HEADLESS=0`) run presentable for an
audience and inspectable during iterative debugging. The flags are
composable — set individually for fine control, or use the `DEMO`
profile shortcut to enable all of them.

| Env var | Effect |
|---|---|
| `CABINET_VERIFY_DEMO=1` | Profile shortcut — enables all demo behaviors below; forces `HEADLESS=0`; defaults `SLOW_MO=500` when unset |
| `CABINET_VERIFY_PAUSE_ON_FAIL=1` | On step failure: screenshot, print error, prompt `[C]ontinue / [A]bort` (TTY only; auto-continues non-TTY) |
| `CABINET_VERIFY_NARRATE=1` | Print a bold human-readable description before each step |
| `CABINET_VERIFY_TRACE=1` | Record a Playwright trace per scenario to `traces/<name>-<ts>.zip` |

Each individual flag also activates when `CABINET_VERIFY_DEMO=1`. So
`CABINET_VERIFY_PAUSE_ON_FAIL` is true when either its own var is `1`
OR demo mode is on.

**Trace artifacts.** When `CABINET_VERIFY_TRACE=1` (or demo mode), each
scenario produces `traces/<scenario-slug>-<timestamp>.zip`. Open with:

```bash
npx playwright show-trace traces/<file>.zip
```

Or upload to https://trace.playwright.dev (no local Node required —
useful for clients). The trace viewer provides timeline scrubbing, DOM
snapshots at every action, a network panel, and source mapping.

**Element highlighting.** In step definitions, call
`this.spotlight(locator)` before interacting with an element to briefly
outline it for the viewer. No-op when demo flags are off — calls
Playwright's built-in `locator.highlight()` (transient overlay, no DOM
mutation, no layout shift).

`traces/` is gitignored by `install.sh`.

## pathHash Spec

Each human verdict is keyed by a content-aware hash of the path through
the scenario that led the operator to that moment:

```
input  = step_text[0] + "\n" + step_text[1] + "\n" + ... + step_text[k]
where k is the index of the target check's step within its scenario,
inclusive, ordered as they appear in the .feature file.

algorithm = SHA-256
encoding = UTF-8
hash     = sha256(input).digest('hex').slice(0, 16)
```

- Step text means the full step line including the leading keyword and
  any quoted arguments (`Then check "1.01 workspace-heading-visible" the
  workspace heading is visible`). Background steps are NOT included.
  Rationale: Background changes invalidate every scenario that uses
  it, which is too broad a blast radius for the cache; excluding
  Background keeps re-verdict scope tight to the affected scenario.
- Scenario outlines: the example row is substituted into placeholders
  before hashing (each example produces a distinct pathHash).
- Tags do not contribute to the hash.
- Step argument blocks (DocString, DataTable) DO contribute — they are
  appended to the step text with `\n` separators in the order Gherkin
  emits them.

**Conservative-over-fine.** Editing step 2 invalidates the hash for
every step ≥ 2 in the same scenario. False invalidations cost a
re-verdict; false hits cost a missed regression.

## Install Dir

The runtime installs to:

```
~/.claude-cabinet/verify/<semver-version>/dist/cabinet-verify-<semver-version>.tgz
```

Multiple versions coexist. The CC installer also writes a pointer file
to the latest installed version (used by Phase 4's install.sh — see
the Version Resolution section below):

```
~/.claude-cabinet/verify/current/VERSION
```

`VERSION` contains the semver string on a single line (no trailing
newline — files matching `cat $HOME/.claude-cabinet/verify/current/VERSION`
must equal the version string exactly).

**`current/VERSION` is a fallback pointer, not authoritative for
consuming projects.** Consuming projects are pinned to a specific
version via `.ccrc.json` (set at install time). See **Version
Resolution** for the lookup order — project-pin always wins.

## Tarball Install Pattern

The CC installer's `lib/verify-setup.js` (Phase 6) produces the tarball:

1. Read version from `templates/verify-runtime/package.json`.
2. `mkdir -p ~/.claude-cabinet/verify/<version>/dist/`
3. Run `npm pack` inside `templates/verify-runtime/` — produces
   `cabinet-verify-<version>.tgz` in CWD.
4. Move the tarball to `~/.claude-cabinet/verify/<version>/dist/`.
5. Write `~/.claude-cabinet/verify/current/VERSION` with the version
   string.

Consuming projects' `e2e/package.json` references via:

```json
{
  "dependencies": {
    "cabinet-verify": "file:~/.claude-cabinet/verify/0.1.0/dist/cabinet-verify-0.1.0.tgz"
  }
}
```

The literal `~` is expanded by npm when resolving the path. Because npm
hashes tarball *content* (not path) for the `integrity` field in
`package-lock.json`, two consumers on different machines see identical
lockfile entries as long as they have the same version installed — the
spike in `docs/verify-runtime-d1-spike.md` validates this.

If the tarball is missing at install time (e.g., consuming project
moved machines without re-running the CC installer), `npm install`
fails with a clear "tarball not found" error. The fix is to re-run
`npx create-claude-cabinet --modules verify`.

---

## Plan-Level Conventions

The following three sections were surfaced during QA review of the
extraction plan. They don't fit cleanly into the runtime contract but
are referenced by Phases 4–7 and must be frozen alongside the runtime
shape.

## npm Scripts (consuming project)

Phase 4's `install.sh` writes a consuming-project `e2e/package.json`
with these exact 9 script entries:

```json
{
  "scripts": {
    "preflight": "cabinet-verify-preflight",
    "verify": "npm run preflight && NODE_OPTIONS='--import tsx/esm' cucumber-js --tags '@free and not @manual'",
    "verify:cheap": "npm run preflight && NODE_OPTIONS='--import tsx/esm' cucumber-js --tags '(@free or @api-small) and not @manual'",
    "verify:full": "npm run preflight && NODE_OPTIONS='--import tsx/esm' cucumber-js --tags 'not @manual'",
    "verify:manual": "npm run preflight && NODE_OPTIONS='--import tsx/esm' cucumber-js --tags '@manual'",
    "verify:scenario": "npm run preflight && NODE_OPTIONS='--import tsx/esm' cucumber-js",
    "report:last": "cabinet-verify-report-last",
    "report:status": "cabinet-verify-report-status",
    "install:browsers": "playwright install chromium"
  }
}
```

Phase 7's AC for the second-project seed test invokes `npm run verify`,
`npm run verify:scenario`, `npm run report:last`. The script names are
frozen — renaming requires updating Phase 4 install.sh, Phase 7 AC
commands, and consuming-project docs together.

## CheckId / Step-ID Convention

Each check is identified by a `NN.NN` token. In the de[sic]ify source,
the token is the **leading non-whitespace token of a quoted argument**
passed to `check` or `ask the human` steps. The runtime accepts either
this quoted-argument form or a bare-leading-token form — the parser
falls back from quoted-arg to bare-token.

Real Gherkin from the de[sic]ify source (the canonical pattern):

```gherkin
Scenario: Desktop end-to-end rewrite (Sonnet, short fixture)
  When I navigate to "/app"
  Then check "1.01 workspace-heading-visible" the workspace heading is visible
  And check "1.02 navbar-rewrite-link" the navbar has a Rewrite link
  And ask the human "1.04 first-impression-feels-clean: does the workspace look right?"
```

For these steps, the checkIds are `1.01`, `1.02`, and `1.04`. The parser
extracts the quoted argument from the step, then takes its leading
non-whitespace token.

Equivalent bare-token form (also valid):

```gherkin
  Given 1.01 the user signs in
  When 1.02 they paste an article
```

The parser tries the quoted form first, then the bare form. Step text
fed into pathHash is the FULL step including the quoted argument — see
pathHash Spec.

**Multi-token tolerance at the call boundary.** Callers (step
definitions) may pass either the bare `NN.NN` token OR a multi-token
form like `"2.04 history-list-feels-readable"` (e.g., the `ask the
human` step shape that includes a kebab slug before the colon-delimited
description). `computePathHash` normalizes the input to its leading
non-whitespace token before matching, so both forms resolve to the same
scenario step. The recorded ledger row's `checkId` field preserves
whatever the caller passed — display-side affordance — but the
content-aware invariant only depends on the leading token.

Numbering schemes are project-driven (scenario-major.step-minor is the
de[sic]ify convention; other projects may use 3-part or alphabetic
schemes). The runtime only requires that the leading token of the
quoted arg (or step body) is a unique identifier within its scenario.

## Version Resolution (for install.sh)

Phase 4's install.sh must resolve which cabinet-verify version is
installed to embed in the consuming project's `e2e/package.json`. The
resolution order is:

1. **`.ccrc.json` lookup** — if the consuming project has been through
   the CC installer, `.ccrc.json` records the installed cabinet-verify
   version in its `modules.verify.version` field. Prefer this when
   present (it pins the consuming project to the exact version it was
   installed with).
2. **`~/.claude-cabinet/verify/current/VERSION` fallback** — read the
   single-line VERSION file written by Phase 6's verify-setup.js. Used
   when `.ccrc.json` lacks the version (fresh install, or install.sh
   invoked manually).
3. **Error** — if neither source is available, abort with: "Cannot
   resolve cabinet-verify version. Run `npx create-claude-cabinet
   --modules verify` first."

install.sh embeds the resolved version literally into `e2e/package.json`:

```json
{ "dependencies": { "cabinet-verify": "file:~/.claude-cabinet/verify/0.1.0/dist/cabinet-verify-0.1.0.tgz" } }
```

NOT a `current/` symlink — that would silently shift the consuming
project across CC upgrades, which is precisely the version-skew risk
cabinet-architecture flagged for D1. Pin explicitly.
