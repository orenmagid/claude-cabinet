---
type: field-feedback
source: claudeconsult-maginnis
date: 2026-05-31
component: execute-group workflow / cabinet CP1 checkpoint
---

## Cabinet CP1 group review halts on false positives — doesn't read plan text

**Friction:** The execute-group workflow's CP1 group review halted twice consecutively (800k+ tokens) on concerns that were explicitly addressed in the plan notes. Cabinet members pattern-match against codebase state ("this file has skip_before_action :authenticate_user!") rather than reading the plan text ("preview action lives in Admin::TargetsController with three-layered auth"). After amending the plans to make every concern even more explicit, the second run raised the same concerns again verbatim. Specific false positives: (1) "preview needs admin auth" — plan says Admin::TargetsController; (2) "both plans touch seeds.rb" — false, only one plan lists it in surface area; (3) "ActiveStorage hand-written" — plan says "do NOT hand-write, use generator"; (4) "MergeTemplatable XSS" — plan says "preserve ERB::Util.html_escape". The first run caught 4 real issues (PII encryption, KNOWN_VARIABLES asymmetry, missing data-testid, unscoped find); the second run caught zero new issues.

**Suggestion:** The CP1 review prompt should instruct cabinet agents to: (1) read the plan text FIRST, then check the codebase for gaps the plan doesn't address — not the reverse; (2) explicitly acknowledge when a concern is already addressed in the plan rather than re-raising it; (3) differentiate "the codebase has this risk" from "the plan doesn't mitigate this risk." Consider a two-phase CP1: fast plan-text review (does the plan address known risks?) then targeted codebase audit (what did the plan miss?). Also consider passing prior-run concerns + amendments to the second run so cabinet members can see what was already caught and fixed.

**Session context:** Executing a 2-plan parallel group (target preview button + e-sign data foundation) for a Rails 8 mass-arbitration platform.
