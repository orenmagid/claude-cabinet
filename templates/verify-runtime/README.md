# cabinet-verify

Walkthrough verification runtime for Claude Cabinet. Cucumber + Playwright
scenarios driven through user-flow walkthroughs, with a human-in-the-loop
verdict pause for subjective checks. Originally lifted from de[sic]ify's
`e2e/support/` and generalized.

This package is the **runtime** half. The orchestration (skill files,
phase definitions, `/verify learn` bootstrap flow) lives in the
`templates/skills/verify/` upstream of Claude Cabinet. The runtime is
installed by the CC installer to `~/.claude-cabinet/verify/<version>/dist/`
and referenced by consuming projects via a `file:` dependency.

See `CONVENTIONS.md` for the frozen contracts:

- Verdict Ledger Schema (`VerdictRow`, JSONL ledger format)
- Verdict Chars (`P` / `I` / `S` / `N`)
- Cost Tags, Role Tags
- Env-Var Prefix (`CABINET_VERIFY_*`)
- pathHash Spec (content-aware cache key)
- Install Dir, Tarball Install Pattern
- npm Scripts (consuming project), CheckId Convention, Version Resolution

## Public API

```ts
import {
  startRun,
  endRun,
  recordVerdict,
  setScenarioContext,
  autoCheck,
  loadFixture,
  out,
  type VerdictRow,
  type RunSummary,
} from 'cabinet-verify';
```

(Additional exports — `askHumanVerdict`, `walkManualChecklist`, `preflight`,
`world` lifecycle hooks — land in Phases 2–3.)

## Build

```bash
npm install
npm run build
npm test
```

`npm test` runs the smoke test for the verdict recorder.

## Status

- Phase 1 — cleanly-generic lifts (verdict-recorder, output, auto-check,
  fixture-loader) ✓
- Phase 2 — pathHash + human-verdict + manual-runner + fresh-pass-cache
- Phase 3 — world lifecycle, preflight, CLI bins (report-last,
  report-status, preflight)
