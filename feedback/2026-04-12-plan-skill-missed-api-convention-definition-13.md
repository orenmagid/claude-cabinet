> **NOTE (moved to outbox 2026-04-17):** This feedback was originally
> written to `.claude/memory/feedback/` in article-rewriter — a
> location the current orient skill flags as a wrong-write for CC
> upstream feedback. It was authored 2026-04-12 or 2026-04-13 (see
> frontmatter `date` below) but never delivered upstream because
> the assistant at that time could not invoke `/cc-feedback`. It's
> being moved to the global outbox now so CC can pick it up. **It may
> already have been addressed** in the 4–5 days since it was written;
> CC should verify current state before acting.

---

---
type: feedback
date: 2026-04-12
skills:
  - plan
  - cabinet-architecture
severity: moderate
---

# Plan Skill Missed API Convention Definition

## What Happened

During web app planning (prj:88b9992a), the /plan skill produced a
detailed implementation plan with endpoints, request/response models,
and acceptance criteria — but never defined a response envelope
convention. Each action's notes showed different response formats
(some bare dicts, some with `{"detail": "..."}`, some with custom
structures). The user caught this and correctly identified it as a
"wild west" problem.

The cabinet-architecture member also missed this. When reviewing the
plan, the architect evaluated endpoint design, caching strategy, and
deployment topology — but didn't flag the absence of a response
convention. This is a CTO-level concern that the architect should
have caught.

## Root Cause

The /plan skill's completeness check (Phase 6) verifies:
- Feature completeness (does the plan deliver a working feature?)
- Surface area completeness (are all files listed?)
- AC testability (are criteria pass/fail?)
- Cold-start readiness (can a session execute without re-investigating?)

None of these checks ask: **"Does the plan define conventions that
prevent inconsistency across multiple implementers/sessions?"** The
plan can be "complete" in that every endpoint is specified, while still
leaving the *format* of those endpoints unspecified — which means N
sessions implementing N endpoints will invent N response formats.

## Suggested Fixes

### /plan skill — add convention check to Phase 6

Add to the completeness check: "If the plan defines multiple endpoints,
APIs, or interfaces, does it define a shared convention for response
format, error handling, and naming? If not, add a Phase 0 action that
defines conventions before implementation begins."

This is a subset of the cold-start readiness check but specific enough
to catch the API convention gap.

### cabinet-architecture — add to directives.plan

The architect's plan directive should include: "Check whether the plan
defines shared conventions (response format, error codes, naming) for
any multi-endpoint or multi-component system. Flag missing conventions
as a CONDITIONAL concern."
