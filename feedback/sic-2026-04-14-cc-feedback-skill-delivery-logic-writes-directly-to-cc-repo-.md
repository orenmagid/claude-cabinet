# cc-feedback skill delivery logic writes directly to CC repo instead of outbox

**Source:** sic  
**Date:** 2026-04-14  
**Component:** skills/cc-feedback

The cc-feedback skill's delivery logic (step 3) checks the cc-registry.json for a local CC repo path and then writes feedback files directly to that repo's feedback/ directory. This is wrong — consuming projects should not write directly into the CC source repo. The outbox mechanism (~/.claude/cc-feedback-outbox.json) exists precisely to decouple feedback collection from delivery. The skill should always write to the outbox from consuming projects, and let orient's feedback pipeline flush handle delivery. Direct writes to the CC repo bypass any review step and dirty the CC repo's working tree unexpectedly.

Suggestion: The skill's step 3 should use the outbox for ALL non-CC-source-repo cases. The 'linked' check that writes directly to the CC feedback/ dir should be removed or changed to also use the outbox. Only the dogfood case (this IS the CC repo) should write directly to feedback/.

Session context: Filed feedback about a hook failure during [sic] web app debrief. The skill wrote directly to /Users/orenmagid/claude-cabinet/feedback/ instead of the outbox.
