# /debrief integration with cabinet-verify — verify-coverage phase

**Contract: v0.x soft — may change before v1.0.** This phase enables
the `/verify` integration with `/debrief`. It is a customization phase
(opt-in), copied into your project only when the `verify` module is
selected during `npx create-claude-cabinet`.

## What this phase does

At session close, scan the acts shipped during the session window.
For each act that touched UI code, check whether a feature-file edit
landed in the same git commit window. If not, warn — drift risk:
the product changed but the scenarios didn't.

This is the safety net for the `/plan` + `/execute` integration. The
upstream phases TRY to keep features in sync during the session;
this phase catches the cases where they failed or weren't invoked.

## No-op guard

The phase should exit silently if the project has no `e2e/features/`
directory.

```bash
test -d e2e/features
```

Without the runtime installed, there's nothing to be out of sync with.

## When this phase runs

Position: during `/debrief`'s inventory phase, after acts have been
enumerated, before the briefing is presented to the user. The warning
appears in the **Attention Items** section of the debrief output.

## Detection algorithm

1. **Establish the session window.** The session-start git sha is
   captured at orient (or, lacking that, the most recent commit
   before the first session action). HEAD is the end of the window.
2. **List feature-file edits in the window.**
   ```bash
   git diff --name-only <session-start-sha>..HEAD | grep '\.feature$'
   ```
3. **List shipped acts.** Query pib-db for actions completed during
   the session:
   ```bash
   node scripts/pib-db.mjs query "SELECT fid, text, notes FROM actions WHERE completed = 1 AND completed_at >= '<session-start-iso>'"
   ```
4. **For each shipped act, decide whether it was UI-touching.** Look
   at the act's notes' Surface Area section. If the surface includes
   any of:
   - `webapp/frontend/`, `app/`, `pages/`, `components/`
   - paths matching project-specific UI conventions (read
     `phases/ui-paths.md` if defined; otherwise use the default
     heuristic above)

   then it's UI-touching.
5. **For each UI-touching act, check if any feature file in the
   diff overlaps with the act's surface area or description.** If
   not, the act is "uncovered."

## Warning format

For each uncovered UI act, emit one Attention Items entry:

> **Act <fid> shipped without a feature-file update — drift risk.**
> The act touched [paths] but no `.feature` file changed in the same
> session window. Consider:
>   - `/verify update <fid>` to propose the matching scenario edits
>   - Or accept the drift if the change isn't user-visible enough to
>     warrant a scenario update.

Advisory only — debrief still completes. The user decides whether to
run `/verify update` immediately or defer.

## Tuning to reduce false positives

The default heuristic over-warns. Two common refinements:

1. **Path filter.** Project-specific UI paths in `phases/ui-paths.md`
   (if defined) override the default heuristic. For example, a project
   where `app/` is the framework's app dir (server-side rendering)
   but `webapp/frontend/` is the SPA might only count the latter.
2. **Per-act opt-out.** An act can declare in its notes that it's a
   "no-feature-edit-needed" act:
   ```
   ## Verify Coverage
   Skip: this change is internal — no UI behavior changed.
   ```
   The phase reads this and skips the act.

## What this phase does NOT do

- It does not file an action for the uncovered act. The user runs
  `/verify update` (or chooses to ignore) at their discretion.
- It does not block debrief. Even with 10 uncovered acts, debrief
  completes — the warnings just accumulate in the Attention Items
  section.
- It does not run the verification suite (`npm run verify`). That's
  the user's call after they decide whether to update scenarios.
