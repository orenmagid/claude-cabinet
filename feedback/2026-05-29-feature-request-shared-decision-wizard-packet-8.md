---
type: field-feedback
source: claudeconsult-maginnis
date: 2026-05-29
component: new-module-request
---

## Feature request: Shared Decision Wizard ("Packet")

**Friction:** CC has no tool for structured client collaboration — sharing checklists with dependency trees, collecting answers with progressive disclosure, threaded per-item discussions, and secure credential handoff. In a consulting engagement with a law firm, we hit this gap hard: 30+ go-live items where downstream questions depend on upstream decisions, credentials need secure transfer, and both sides need async conversation per item. Google Docs lacks structure/progressive-disclosure; spreadsheets lack conversation; project management tools add friction for non-technical clients.

**Suggestion:** A standalone hosted app (not embedded in any project) — "Packet" — with: (1) progressive disclosure (downstream items appear/reframe based on upstream answers), (2) auto-save without submit, (3) threaded per-item conversations (consultant + client), (4) one-time encrypted credential envelopes (Web Crypto client-side encryption, server stores ciphertext only, first-view-deletes), (5) multi-tenant (one deployment, many clients/projects), (6) MCP server as primary Claude interface + web UI for clients, (7) CC skill (`/packet`) to create and manage packets conversationally. Stack: Node.js + React + Mantine, SQLite/Postgres, deployable to Railway.

**Full plan with cabinet critique:** `.claude/plans/shared-decision-wizard.md` in `claudeconsult-maginnis` repo. Key findings from architecture, security, and QA critique:
- Credential items must use encrypted envelopes (Web Crypto AES-GCM, key in URL fragment, server stores ciphertext, first-view-deletes) — never store plaintext secrets
- Resolver needs transitive visibility (if B is hidden, C depending on B must also be hidden even with stale answer_value)
- Auto-save needs AbortController race protection (debounce + blur can fire concurrent PATCHes)
- JSONB validation on visibility/reframe/options schemas (silent typo = invisible items)
- Public endpoint strong params: only answer/answer_value — never status or author
- Token lifecycle: expires_at, archived packets 404, rate limiting on /shared/ routes
- API serializer must separate choice values from credential values

**Session context:** First paid ClaudeConsult engagement — building a mass-arbitration platform for a law firm. Needed to send the client a structured go-live checklist and realized nothing in CC handles consultant-client structured collaboration.
