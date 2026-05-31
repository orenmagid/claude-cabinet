---
type: field-feedback
source: claudeconsult-maginnis
date: 2026-05-29
component: verify (SKILL.md Mode E + cabinet-verify launch-options)
---

## /verify run --demo: browser fills screen, progress invisible, failures swallowed

**Friction:** Three related issues with the demo-mode experience when
orchestrated via file IPC:

1. **Window size.** `resolveLaunchOptions` hardcodes
   `args: ['--window-size=1500,1000']` — effectively full-screen on a
   laptop. The user can't see their terminal alongside the browser.
   Demo mode should default to ~75% screen size positioned upper-left
   (e.g. `--window-size=1100,750 --window-position=0,0`).

2. **Progress invisible.** The skill runs cucumber via `run_in_background`
   and only monitors `.verdict-pending.json`. All check-pass output
   (scenario headers, check lines, timing) goes to the background task's
   output file — the user sees nothing between verdict prompts. Should
   stream progress via Monitor on the output in parallel with verdict
   polling.

3. **Failures swallowed mid-run.** Check 1.12 failed during the run
   (with trace captured), but the verdict-only monitoring missed it.
   The user only learns about it at the end summary. In demo mode
   especially, failures should surface immediately — either via a
   progress file event or by the skill reading interim output.

**Suggestion:** (1) Add `DEMO_WINDOW_SIZE` / `DEMO_WINDOW_POSITION`
env vars to cabinet-verify with sensible defaults. (2) Update SKILL.md
Mode E step 6 to use Monitor on the background output stream alongside
verdict file polling. (3) Have the runtime write failures to a
`.verify-failure.json` file (like verdict IPC) so the skill can surface
them immediately.

**Session context:** First real `/verify run --demo` on the Maginnis
platform (5 scenarios, demo for client Saturday). Browser opened but
user couldn't see terminal; had to read background output file manually
to see what passed.
