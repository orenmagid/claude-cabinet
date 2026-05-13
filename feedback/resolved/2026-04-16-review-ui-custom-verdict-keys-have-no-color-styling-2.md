# review-ui: custom verdict keys have no color styling

**Source:** scripts/review-ui.html (VERDICT_PRESETS + CSS)
**Impact:** When Claude POSTs a session with custom verdictLabels (e.g. `{"issue": "🚩 Flag issue", "skip": "Skip / fine"}`), the buttons render but clicking them shows no visual selected-state. User can't tell if their click registered.
**Why it happens:** CSS rules are keyed to specific verdict names:
  .verdict-btn.sel-approve, .verdict-btn.sel-fix { green }
  .verdict-btn.sel-modify { orange }
  .verdict-btn.sel-defer { gray }
  .verdict-btn.sel-reject { red }
  .verdict-btn.sel-question { blue }
Custom keys fall outside this map and get no .sel-* class styled.
**Possible fixes:**
  1. Document that custom keys should be one of the 6 existing presets.
  2. Generate colors from the key name (stable hash → HSL) so any custom key works.
  3. Accept a `color` field on each verdictLabels entry when labels are an object.
**Discovered:** 2026-04-16 session using a custom "issue"/"skip" pair for user-testing feedback. Worked around by re-mapping to "reject"/"defer".
