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
date: 2026-04-13
skills:
  - plan
  - cabinet-security
severity: info
scope: process
---

# Cabinet critique during /plan caught auth security gaps early

## What Happened

Before implementing the multi-password auth system, the user ran
`/plan` which engaged cabinet-security in the critique phase. The
critique identified three issues before any code was written:

1. **JWT revocation gap** — shared JWTs live past password revocation.
   Led to the 2h expiry mitigation decision.
2. **Label validation** — without regex constraints, labels could
   contain injection-friendly characters. Led to the Pydantic
   `Field(pattern=r'^[a-zA-Z0-9_-]{1,64}$')` constraint.
3. **Rate limiting on login** — brute-force vector on the login
   endpoint. Noted as a deployment-time concern (Railway rate
   limiting or middleware).

All three would have been harder to address after implementation.

## Takeaway

The plan-then-critique workflow earns its overhead on security-
sensitive features. For pure UI work (MorphText, KnobDisplay), the
critique adds less value. The pattern to reinforce: always run
`/plan` with cabinet critique before implementing auth, data storage,
or any feature that touches trust boundaries.
