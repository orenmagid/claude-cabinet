# omega auto_capture hook may not be firing during long sessions

**Source:** omega native hooks (settings.json auto_capture / assistant_capture)
**Observation:** A ~6-hour session landed 10 commits with significant architectural decisions (auth migration, R2 choice, rebrand, new projects filed). During debrief, cabinet-historian queried omega for 9 key decisions from the session — zero were in omega. All 9 had to be stored manually via omega_store during debrief.
**Possible explanations:**
  1. The hooks fired but the decisions weren't phrased in a way the classifier recognized.
  2. The hooks silently failed (permissions? python path? config drift?).
  3. The hooks only process recent turns and lose older context in long sessions.
**Diagnostic suggestion:** Add a verbose/debug mode to auto_capture that logs each classification decision (including "nothing worth capturing" outcomes) to a rotating file. Would make it easy to see whether hooks fire at all and, if they do, why they didn't capture anything.
**Discovered:** 2026-04-16 debrief. Would have lost ~9 load-bearing decisions to the next session if the historian hadn't rescued them.
