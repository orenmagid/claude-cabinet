# Extraction Proposal: cabinet-deployment

## Source

- **Project:** article-rewriter (de[sic]ify) — `/Users/orenmagid/article-rewriter`
- **Artifact:** `.claude/skills/cabinet-deployment/SKILL.md`
- **Type:** cabinet-member
- **Created:** 2026-04-19 (act:44b52fbe)
- **First real-world use:** 2026-04-20 Phase D Railway deploy (prj:ad6d5dd8), which shipped de[sic]ify live at https://desicify.com
- **Proposal filed:** 2026-04-21 (act:1a6d4aae)

## What It Does

A cabinet member specialized in platform / deployment decisions. Convened during `plan`, `execute`, and `investigate` passes to weigh in on:

1. **Integration surface** — when to use platform MCP vs. agent CLI vs. bare CLI (Railway-specific expertise; generalizes)
2. **Platform selection** — Railway / Fly.io (tier-1, deep), Render / Cloud Run / Modal (tier-2), Vercel / Netlify / VPS (tier-3 awareness)
3. **Topology** — single-service vs. split-frontend
4. **Build strategy** — Dockerfile vs. buildpacks; native-module compilation gotchas
5. **Persistence** — SQLite-on-volume vs. managed Postgres vs. object storage
6. **Env-var plan** — rotation rules between dev/prod; dev-to-prod secret coupling
7. **Webhook URL plan** — tunnel vs. prod endpoints; named-endpoint-per-environment pattern
8. **Deploy verification invariants** — "returns immediately, must poll"; "health endpoint is not deploy proof"; bundle-grep verification
9. **Cost floor and upgrade path**
10. **Rollback plan**

Brings deep Railway knowledge (including the agent-native surfaces Railway shipped on 2026-04-17 — Remote MCP, `railway agent` CLI, bare CLI) and evaluates **AI-workflow-friendliness as a first-class criterion**, not an afterthought. That lens is rare and load-bearing: "deploy friction for the agent equals deploy friction for the team."

Also maintains a "Historically Problematic Patterns" (HPP) section — 9 encoded patterns from real deploys, spanning:
- Object-storage IAM prefix mismatches (HPP-1)
- SPA catch-all swallowing `/api/*` 404s (HPP-2)
- Dockerfile `mkdir -p` for volume mount paths (HPP-3)
- `curl <glob>` shell-expansion false-greens in bundle verification (HPP-4)
- CDN proxy vs. Let's Encrypt ACME conflicts (HPP-5)
- Webhook last-write-wins between dev and prod (HPP-6)
- Framework content baked into image (cadence coupling) (HPP-7)
- JWT-secret-doubling-as-salt rotation coupling (HPP-8)
- Approval-gated MCP tools in auto-flows (HPP-9)

Ships with a `patterns-project.md` sibling-file convention: the SKILL.md carries *universal* HPPs; a project-local file carries *project-specific* ones. Both are read and merged at runtime. This split is itself a generalizable pattern worth preserving in the upstream template.

## Why It's Generic

**Every CC project deploys somewhere.** Almost every project eventually needs someone on the cabinet who can answer "should we be on Railway or Fly?", "is our Dockerfile doing the right thing?", "how do we verify this shipped?" — questions that have real tradeoffs and well-known traps.

The 10 reasoning areas are platform-agnostic. The tier-1/2/3 platform framework applies to any Python/Node web-service project. The AI-workflow-friendliness criteria (deterministic CLI, structured output, streamable build logs, CLI env-var management, first-party MCP/agent surface) are a general lens for evaluating any platform. The HPP section is a mix of SPA-specific and universal patterns, most of which recur across projects.

**No cabinet member in the current CC upstream covers this.** `cabinet-architecture` touches deploy-shaped decisions but at the code-architecture level ("does this topology fit the code's shape?"). `cabinet-deployment` takes the architecture decision and asks "does it map cleanly to the platform's affordances?" The portfolio boundary is already called out in the SKILL.md and works well in practice.

**Concrete evidence it works:** The Phase D Railway deploy (2026-04-20) was the first ever production deploy of this project, and hit five distinct traps that `cabinet-deployment` had pre-encoded or surfaced on the spot:
- `railway.toml` at repo root (not `webapp/`) — caught during plan
- `HTTPSRedirectMiddleware` 307'ing Railway's healthcheck — caught during execute
- `framework_public.py` shadowed by volume mount — caught during investigate
- `railway up --detach` returns immediately trap — pre-encoded invariant
- `/api/health` serving 200 from old container during deploy — pre-encoded invariant

## Suggested Generalized Form

### Skeleton (upstream-owned)

Copy `.claude/skills/cabinet-deployment/SKILL.md` with these edits:

1. **Strip de[sic]ify-specific paths** from the Investigation Protocol Stage 1a inventory commands (`/Users/orenmagid/article-rewriter/...` → `<repo root>/...` template, or move command bodies into a phase file — see below).

2. **Strip de[sic]ify-specific Scan Scope entries** (`webapp/backend/main.py`, `webapp/backend/config.py`, `webapp/backend/framework_public.py`). Keep the generic categories (backend entrypoint, config/env loader, build signals). These can move to a phase file `scan-scope.md` so consuming projects point at their own entrypoint paths.

3. **Keep Layer 4 "Prior Art as Reference, Not Ceiling"** but genericize the Flow-specific example. The underlying principle — "sibling projects' deploy patterns generalize on invariants, not commands, and patterns predating platform changes should be revisited not ported" — is the valuable part.

4. **Keep Calibration Examples** but rewrite the de[sic]ify-specific ones (Dockerfile FROM tag, 20+ min rewrite, specific deploy sequence) as generic-shape variants.

5. **Keep the `patterns-project.md` dual-file pattern**. Document it prominently in the skeleton's "Historically Problematic Patterns" section — this is how consuming projects accumulate local wisdom without diverging from the upstream.

### Phase files (project-owned)

- `scan-scope.md` — project-specific entrypoint paths, config file locations, CI workflow paths
- `patterns-project.md` — already a convention in the source; keep it unchanged
- (Optional) `investigation-commands.md` — if the Stage 1 bash commands need project-specific paths, move them here; otherwise the skeleton's commands (using relative paths) work fine

### Rough SKILL.md outline after genericization

```yaml
name: cabinet-deployment
description: Deployment architect who evaluates what platform, build
  strategy, persistence shape, and integration surfaces best serve an
  application's actual shape and lifecycle. Brings deep Railway and
  Fly.io expertise (tier-1), working knowledge of Render / Cloud Run /
  Modal (tier-2), and an AI-workflow-friendliness lens as a first-class
  evaluation criterion.
user-invocable: false
standing-mandate: plan, execute, investigate
directives:
  plan: …   (unchanged — all generic)
  execute: …  (unchanged — all generic)
  investigate: …  (unchanged — all generic)
```

Body structure (section-level, unchanged from source):
- Identity
- Convening Criteria (files + topics — generic, unchanged)
- Research Method: Layer 1 Railway agent-native surfaces (time-sensitive; re-fetch periodically) / Layer 2 Platform factsheets (generic) / Layer 3 AI-workflow-friendliness criteria (generic) / Layer 4 Prior art as reference not ceiling (genericize Flow reference)
- What to Reason About (10 areas — all generic, unchanged)
- Investigation Protocol (command bodies may move to phase file)
- Scan Scope (file list moves to phase file; topic list stays generic)
- Portfolio Boundaries (unchanged — generic cabinet-overlap reasoning)
- Calibration Examples (rewrite specifics)
- Historically Problematic Patterns (9 universal HPPs + `patterns-project.md` reference)

## What Stays Project-Specific

- The Scan Scope file-path list (moves to `phases/scan-scope.md`)
- The Investigation Protocol Stage 1 inventory commands (moves to `phases/investigation-commands.md` if paths vary; otherwise stays)
- `patterns-project.md` — a file this skill already reads, intentionally never upstreamed
- Specifics in Calibration Examples (20+ min rewrite, SQLite-on-volume choice, etc.) — replace with generic shapes

## Assessment

- **Generalizability:** **strong**. Platform expertise, reasoning framework, HPPs, and portfolio boundaries are all domain-agnostic. Project-specific bits are confined to file paths and are already structurally isolated.
- **Maturity:** **proven**. Used end-to-end on a first-ever production deploy that hit 5+ distinct traps; shipped successfully with pre-encoded invariants catching multiple issues. Stable for 48h of post-deploy verification work without surfacing issues.
- **Complexity:** **low**. Mostly copy-paste with scoped edits (strip paths, genericize examples, split scan-scope into a phase file). No architectural refactor needed.

## Related Upstream Work

- If accepted, Flow (`~/flow`) and other Railway-deployed CC-consuming projects can seed cabinet-deployment from the template. Flow's deploy patterns predate Railway's 2026-04-17 agent-native surfaces and would benefit from the Layer 1 knowledge.
- Acceptance criterion from source action (act:1a6d4aae): "A second project successfully seeds cabinet-deployment from the upstream template and finds it useful." Flow is the natural proving ground.

---

## Source Artifact Content

Full SKILL.md content is at `/Users/orenmagid/article-rewriter/.claude/skills/cabinet-deployment/SKILL.md` (630 lines). Not embedded inline to keep this proposal readable — read the source file directly when reviewing. Key sections to read in order for a fast evaluation:

1. **Frontmatter + Identity + Convening Criteria** (lines 1–95) — what it is and when it activates
2. **Research Method: Layer 1 Railway Agent-Native Surfaces** (lines 99–160) — the time-sensitive knowledge; evaluate whether this belongs in the upstream or should live as a phase file kept current by the CC maintainer
3. **What to Reason About: 10 areas** (lines 262–353) — the heart of what makes this useful; most of the genericizability argument lives here
4. **Historically Problematic Patterns** (lines 512–629) — the 9 HPPs plus the `patterns-project.md` dual-file convention
5. **Portfolio Boundaries** (lines 441–470) — overlap reasoning with `cabinet-architecture`, worth preserving

No redaction needed — the SKILL.md is already general-purpose prose with only a handful of de[sic]ify-specific path references.
