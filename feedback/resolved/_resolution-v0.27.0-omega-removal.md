# Resolution: v0.27.0 omega removal — bulk obsolete

## Context

CC v0.27.0 removes the omega-memory module entirely (see
`MIGRATION-0.27.md` at repo root and project `prj:efd10e1d` in
pib-db). Three field-feedback items filed during omega's deployment
become obsolete with the removal:

## Items resolved

### 2026-04-16-omega-auto-capture-hook-may-not-be-firing-during-long-sessio-3.md

**Obsoleted by removal.** The omega `auto_capture` hook is gone in
v0.27.0 — no longer a concern. The underlying failure mode it
described ("captured but not surfaced in same session") is reframed
as a general retrieval/injection problem in Phase 3b's debrief
lessons-applied-to-own-output scan; that's backend-agnostic.

### 2026-04-20-omega-protocol-errors-every-session-no-module-named-omega-protocol-33.md

**Obsoleted by removal.** `omega_protocol()` was an OMEGA Pro
function our open-source install couldn't reach. With omega gone in
v0.27.0, no more calls to it. Resolved as the broader "omega is
paywalled" finding that drove the migration decision (see
`MIGRATION-0.27.md` §Why the change?).

### 2026-04-17-memory-stored-in-debrief-not-applied-to-the-debrief-s-own-ou-20.md

**Partially superseded.** The memory-applied-to-own-output piece
ships in v0.27.0 as Phase 3b's rewritten
`templates/skills/debrief/phases/record-lessons.md` (see "Lessons-
Applied-to-Own-Output Scan" section). The companion pib-db action
`act:f6c4e3cc` is split: that piece marked complete; the BLOCKING
cabinet-consultations piece (item 19 from the same action) stays
open as a separate follow-up.

## Resolution date

2026-05-28
