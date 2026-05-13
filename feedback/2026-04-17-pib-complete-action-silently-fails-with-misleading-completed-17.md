---
type: field-feedback
source: article-rewriter (de[sic]ify)
date: 2026-04-17
component: pib-db MCP server / pib_complete_action tool
---

## pib_complete_action silently fails with misleading "Completed undefined"

**Friction:** Multiple calls to `pib_complete_action(action_fid='...', completionNote='...')` returned the literal string `{"message": "Completed undefined"}`. Looked like successful completion — "Completed X" is the healthy response pattern, and "undefined" appeared to be a cosmetic issue with the action-text field being undefined in the response. Moved on assuming the actions were closed.

Much later, during `/debrief`, a `SELECT` on those 5 actions revealed they all had `completed = 0` with `completed_at = NULL`. Completions had not persisted.

Confirmed workaround: run `pib_query` with a direct SQL `UPDATE actions SET completed = 1, completed_at = date('now') WHERE fid IN (...)` — worked immediately, followed up with `SELECT` to verify.

**Affected FIDs this session:** act:5ca7df16, act:6815553b, act:5c71c2c6, act:f4e31221, act:d3c7043a (all five exhibited the same pattern).

**Possible causes:**
1. The MCP tool's parameter name may have drifted. I used `action_fid` and `completionNote`; the server may expect different keys now and the failure isn't surfaced.
2. Something in the server's completion code path raises but is swallowed, leaving the response builder outputting a template with undefined values.
3. Schema mismatch (the `completed_at` column might want a different format; the server silently no-ops instead of raising).

**Suggestions:**
1. **Never return "Completed undefined".** If the action text can't be resolved, the completion probably didn't happen — return an error, not a success message with undefined fields.
2. **Validate and return the completed action's fid + text on success.** A successful completion should round-trip the fid for caller confirmation.
3. **Raise on unknown parameter names** (e.g., if the server expects `fid` not `action_fid`, reject the call with a clear message).
4. **Document parameter names in the tool description** so callers know the expected shape.

**Session context:** Running `/debrief` at the end of a long session (medico-legal extension Phase 1 + 2). Five actions had been "closed" via `pib_complete_action` across different points in the session, all silently failed, only caught because debrief explicitly verified via SELECT. If debrief hadn't verified, next orient would have shown these actions as still open with stale state.
