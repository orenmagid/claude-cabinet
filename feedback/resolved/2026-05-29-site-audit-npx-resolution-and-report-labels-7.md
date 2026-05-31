---
type: field-feedback
source: claudeconsult-maginnis
date: 2026-05-29
component: site-audit-runtime (check modules + report)
---

## Check modules use npx which ignores PATH augmentation; report uses generic labels

**Friction 1 — npx ignores PATH:** All check modules call `executor.spawn('npx', ['<tool>', ...])`. The `realExecutor()` in orchestrator.mjs prepends the runtime's `node_modules/.bin` to PATH, but `npx` does its own binary resolution and ignores PATH for local packages. The binaries exist and work when called directly (`node_modules/.bin/linkinator --version` succeeds), but `npx linkinator --version` fails because npx looks in the wrong place. Fix: check modules should spawn the binary directly instead of via npx — either `executor.spawn('linkinator', ...)` (relying on PATH) or resolve the full path via `node_modules/.bin/<tool>`.

**Friction 2 — skip reasons unhelpful:** When detect() fails, the skip reason is just "<tool name> not available" with no diagnostic detail. Should include: what command was tried, what the exit code was, what stderr said.

**Friction 3 — generic "Site A / Site B" labels:** The comparison report uses "Site A" and "Site B" throughout. Should use the actual URLs (or at least hostnames) as labels so the reader knows which site is which without cross-referencing the title.

**Session context:** Third comparison run on Maginnis (feeshame.com vs staging). Report generated successfully (v0.1.3 crash fixed). 6 of 15 tools still show "not available" despite binaries being installed.
