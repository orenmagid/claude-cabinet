---
type: field-feedback
source: article-rewriter (retrospective extraction)
date: 2026-04-20
component: skills/cabinet-qa
---

## cabinet-qa should flag auth implementations with no test pathway

**Friction:** In a 2026-04-13 article-rewriter debrief, the user noted
that verifying the then-current multi-password auth system required
knowing the master password, which was only stored as a bcrypt hash in
`.env`. There was no test mode, no seed script, no documented dev
credentials, and no `.env.test` equivalent. Testing required generating
a temporary hash, overriding the env var, starting a second server
instance, running the curl flow, and cleaning up. Clunky and error-prone.

The underlying auth system has since been replaced (FastAPI Users, per
article-rewriter CLAUDE.md line 62-65), so the specific instance is
obsolete — but the general pattern isn't. An auth implementation that
can't be verified without knowing production credentials is a testability
smell that cabinet-qa should catch during plan or execute review.

**Suggestion:** Add to cabinet-qa's evaluation criteria (either in
SKILL.md or in a reusable check): when reviewing auth or any
credential-gated flow, verify that a test pathway exists — either a
seed script, an `.env.test`, a documented dev credential, or a pytest
fixture that provisions a known hash. Surface the absence as a finding.

**Origin:** Extracted from a project-scoped feedback file
(`feedback-project-auth-testing-without-master-pw.md`) that was
cleaned up during the 2026-04-20 outbox/feedback audit. The file
described both a project-specific gripe (the multi-password system,
now removed) and a generalizable cabinet-qa gap — this report
captures the latter.
