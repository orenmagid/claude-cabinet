---
type: field-feedback
source: article-rewriter (de[sic]ify)
date: 2026-04-17
component: CC templates / scaffolding scope
---

## Consider packaging a "user accounts + sessions" template (opt-in)

**Friction:** de[sic]ify built a substantial auth/session layer on top
of FastAPI Users — `normalize_auth_error` envelope helper, split
invite-vs-reset token lifetimes (7d / 1h), password reuse prevention,
admin router with custom invite messages, email-backend factory
(Console/SMTP/Resend with templates), per-user IDOR-scoped sessions +
results DB, reload-during-rewrite recovery. Frontend equivalent:
LoginPage with branched error UX (Mantine Alert, clear-on-type,
normalize_auth_error shared across EnvelopeRoute + global handler),
ForgotPassword, AdminUsers with Create User modal (invite message
field), useAuth, useSessionRecovery, 401 auto-redirect in useStream.
~10 commits, real testing, real decisions baked in. If a second CC
project needs auth, we'd reimplement all of this from scratch.

**Suggestion:** Follow the pib-db packaging model — templates live in
CC, installer copies them in, `cc-upgrade` refreshes. No library
versioning overhead. Opt-in at the project level (projects without a
webapp don't adopt it) AND opt-in per layer (backend and frontend
independently adoptable, so a project on a different frontend stack
can still use the Python backend, or vice versa).

Proposed structure:
- `templates/webapp/auth-backend/` — FastAPI Users layer (user_manager,
  auth_envelope with normalize_auth_error, admin_users router, email
  factory, invite.html / forgot-password.html templates, token
  lifetime config)
- `templates/webapp/auth-frontend/` — LoginPage, ForgotPassword,
  AdminUsers, useAuth, useSessionRecovery, 401-redirect pattern
  (Mantine v8 + React; a shadcn or Chakra variant could come later)
- Schema migration for `auth.db`
- Optional: MCP tool for user management parallel to pib-db's MCP

**Don't extract yet — wait for project #2.** Extracting after one use
bakes in de[sic]ify-specific decisions. Extracting after two reveals
the intersection. In the meantime, de[sic]ify will keep a "pattern
doc" capturing non-obvious decisions (token lifetimes, envelope
helper placement, reload-during-rewrite fix) so eventual extraction
is mechanical.

**Scope caveat:** This expands CC's surface area. pib-db is generic
(any project tracks work); auth is only relevant to projects with a
webapp. Worth CC deciding whether it wants to own "the blessed
webapp-auth pattern" the way it owns "the blessed work-tracking
pattern." If yes, the opt-in structure above limits the spread cost.

**Session context:** Orient-quick for de[sic]ify. User asked whether
the user/session system they just shipped (FastAPI Users migration,
admin flow, invite emails, session recovery) should be abstracted
for reuse in future CC projects.
