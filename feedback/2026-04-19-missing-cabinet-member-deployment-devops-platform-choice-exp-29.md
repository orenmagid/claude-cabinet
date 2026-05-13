---
type: field-feedback
source: desicify
date: 2026-04-19
component: cabinet / upstream templates
---

## Missing cabinet member: deployment/DevOps/platform-choice expertise

**Friction:** The CC cabinet (28 members at time of writing) has no
deployment expert. When a project hits first deploy — Railway, Fly.io,
Vercel, Cloud Run, etc. — there's no consultant to weigh architectural
options (single-service vs split, Dockerfile vs nixpacks vs buildpack,
volume persistence strategy, webhook URL sync, env-var handling across
environments). `cabinet-architecture` thinks about system fit at the
code level but doesn't bring platform-specific expertise. The practical
result: first-deploy sessions become half-day ad-hoc research + debug
cycles instead of a 30-minute consulted plan + 30-minute execute.

**Evidence from the field:** Flow (also a user project) has
project-specific `deploy` and `verify-deploy` SKILL files — but they're
procedural runbooks for Flow's specific stack (Express + React in a
Dockerfile with git-at-runtime for markdown pulls). They execute
deploys; they don't consult on architecture. When de[sic]ify hit
first-deploy prep, Flow's skills couldn't answer "what shape should
this deploy take?" — because that's not what they're for. The gap is
at the cabinet layer, not the skill layer.

**Suggestion:** Add a `cabinet-deployment` (or `cabinet-devops`) member
to the CC templates. Scope:

- Tier-1 deep expertise: Railway, Fly.io (the two most common for
  personal-tool scale + AI-friendly CLIs)
- Tier-2 working knowledge: Render, Cloud Run, Modal
- Tier-3 awareness: Vercel / Netlify (for frontend-only splits), PaaS
  alternatives, self-hosted VPS
- Activates during: /plan (before deploy setup), /execute (during
  first deploy), /investigate (when deploy fails unexpectedly)
- Output shape: architectural recommendation (topology, build strategy,
  volume/persistence needs, env-var plan, webhook URLs, cost estimate)
  + concrete deploy config file (Dockerfile / nixpacks.toml / railway.toml /
  fly.toml) — NOT a procedural runbook (that's a skill's job)
- Plays well with: `cabinet-architecture` (system fit), `cabinet-security`
  (secrets + auth surface at deploy time), `cabinet-speed-freak`
  (performance implications of platform choice)
- Criteria for platform "AI-friendliness" as part of the evaluation:
  deterministic CLI + structured output, Dockerfile-first (not opaque
  buildpacks), streamable build logs, CLI env-var management, webhook
  hooks for deploy/health events

**Immediate plan for desicify:** I'm building `cabinet-deployment`
locally in desicify's `.claude/skills/` first (action filed), using it
to /plan the Railway deploy, then proposing /cc-extract to upstream once
it proves useful. Happy to file that as the canonical example when the
time comes.

**Session context:** desicify was prepping pre-invite polish (finished
a batch of 8 user-facing actions); Railway deploy was next on the list.
Discovery of the gap happened while user was asking "do we already have
a Railway expert somewhere?"
