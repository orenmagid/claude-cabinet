---
type: field-feedback
source: article-rewriter
date: 2026-04-21
component: plan + execute skills (AC routing handoff)
---

## /execute doesn't route unverified [manual] AC to a new ticket

**Friction:** When an implementation action ships with a mix of [auto]
and [manual] AC, /execute's Phase 7 auto-verifies what it can and
writes a breadcrumb, then marks the implementation action done — but
it leaves unverified [manual] AC stranded. In this session /plan
produced 10 AC (1 auto + 9 manual), /execute auto-verified 3, and the
remaining 7 had no designated home. I ended up updating a pre-existing
catch-all verification ticket in place, then the user clarified they
wanted close-and-replace: "If the work is done but the AC aren't
verified, then a new ticket to verify makes sense to me." Ended the
session with a one-off close of the old ticket and a fresh one filed.
The handoff between /plan (which authors AC) and /execute (which
verifies what it can) is missing an explicit verification-ticket
routing step for the survivors.

**Suggestion:**
1. /plan should require [auto] vs [manual] tags on every AC (the
   project already uses this convention — making it a plan-template
   requirement would lock it in).
2. /execute Phase 7, after auto-verification, should detect any
   remaining [manual] AC and offer to file them as a new
   verification-only action, auto-populated with just the unverified
   items. User approves before filing; the implementation action
   closes cleanly.
3. Verification tickets should be fresh-at-close, not long-lived
   catch-alls that accumulate AC from multiple sources over time.
   Close-and-replace beats update-in-place.

**Session context:** Shipping cross-tab run liveness fix
(act:1f3d9820) — 10 AC, automated verification of 3, left to
manually reconcile routing for the other 7.
