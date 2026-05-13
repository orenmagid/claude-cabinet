---
type: field-feedback
source: flow
date: 2026-04-17
component: CC scope / cross-project infrastructure patterns
---

# Proposal: CC should own cross-project AI/LLM infrastructure patterns (parallel to pib-db)

## 1. Context & triggering events

This proposal crystallized during a 2026-04-17 session on Flow, triggered by a Cloudflare marketing email about "Agents Week" (2026-04-13 announcement of Cloudflare's "Agent Cloud" stack: Workers AI, AI Gateway, Durable Objects / Agents SDK, Workflows, Vectorize).

The user's existing context includes:
- `act:9fb95b0f` (Flow): "Evaluate local LLM (Ollama) for routine classification and smart titles" — deferred, triggers when Claude API costs exceed $20/mo OR local instant inference needed.
- `act:71370f90` (Flow): "Save toward Mac Mini M4 Pro 64GB (~$2,200) as dedicated Flow compute + inference node." Quarterly check.
- `act:7404cc75` (Flow): "Evaluate dedicated machine or cloud burst for meeting post-processing."
- Current transcription stack: AssemblyAI ($50 free tier) for non-clinical, MLX-Whisper + whisperX + pyannote locally for clinical.
- Cloudflare already in the stack: R2 for attachments (Flow), Email Workers for inbox@ capture (Flow), Workers general-purpose.

The user's prompt evolved from "is Agents Week relevant to Flow's local-LLM thinking?" to "does this apply to de[sic]ify and anywhere we need intelligence but cheaper than Anthropic?" to "where does this infrastructure live?" The answer converged on CC, and this proposal is the result.

The user explicitly chose to file a single comprehensive proposal rather than a Flow project + Flow idea + CC proposal trio, because project-level filings would front-run CC's scope decisions and become stale if CC goes a different direction. This document is meant to be the canonical artifact — a future CC session (potentially weeks or months from now) should be able to execute on it without re-deriving anything.

## 2. The structural insight

One of Flow's guiding principles is **"intelligence over regex"** — prefer structured LLM reasoning over brittle pattern matching. Historically this has been aspirational, not universal, for a specific reason: the floor cost of intelligence was too high to use it for everything. Calling Claude for "is this email a receipt or a request?" felt wasteful when a regex on the subject was free. So Flow and sibling projects settled into a pragmatic compromise: regex for high-volume cheap tasks, LLM only for high-value reasoning.

Cloudflare Workers AI, especially with smaller models (Llama 3.2 1B/3B), prices short-prompt inference at roughly $0.000005 per call. At those prices, the economic argument against using intelligence for routine classification evaporates. Add AI Gateway's deterministic caching on top — same input, cached response, free forever until TTL — and the floor drops further for any task with repeat patterns.

**This is not primarily a cost-savings story.** The projects aren't currently spending enough on LLM calls for dollar savings to matter much. The structural shift is: intelligence becomes a commodity to pour on any problem, not a scarce resource to ration. The intelligence-over-regex principle can finally be implemented universally rather than selectively.

That shift raises a question about where the new infrastructure lives. The claim of this proposal is that the answer belongs in CC, because the knowledge and patterns scale across projects in exactly the same way pib-db's work-tracking pattern does.

## 3. Proposed three-layer architecture

After working through several options, the architecture that falls out naturally:

- **Layer 1 — The pattern** (skills, templates, routing policy, conventions) → **Claude Cabinet**
- **Layer 2 — The shared runtime** (smart-router Worker, when it earns its keep) → **its own repo** (e.g., `orenmagid/ai-router`)
- **Layer 3 — CF account as infrastructure-as-code** → **same repo as Layer 2**

Plus per-project consumption via a thin CC-distributed client wrapper.

The three layers have different lifecycles and audiences, which is why unifying them is wrong. CC evolves via npm publication and `cc-upgrade`. A Worker evolves via `wrangler deploy`. CF account config evolves via API calls. Forcing these into one home makes any of them harder to iterate on.

## 4. Layer 1: What CC would own

This is the pib-db pattern applied to a new domain. Proposed surface:

```
claude-cabinet/
├── templates/ai-client/
│   ├── ai-client.ts                # thin wrapper: base URL, metadata headers, retry
│   ├── ai-client.test.ts           # minimal contract tests
│   └── README.md                   # integration guide for new projects
├── skills/ai-gateway-setup/
│   ├── SKILL.md                    # "set up AI Gateway for this project"
│   └── phases/
│       ├── cf-account-check.md     # verify CF account, capture credentials to .env
│       ├── gateway-create.md       # create gateway via CF API
│       ├── project-wiring.md       # wire ai-client.ts into project source
│       └── smoke-test.md           # verify one end-to-end call
├── rules/llm-routing.md            # policy: which tasks → which model tier
├── rules/ai-observability.md       # metadata-header conventions (x-skill, x-user, x-project)
├── rules/ai-cost-attribution.md    # how projects tag calls for Gateway dashboards
├── cabinet/ai-infrastructure/
│   └── _briefing.md                # cabinet member for LLM-infra concerns
└── feedback/                       # where refinements land over time
```

The `ai-gateway-setup` skill is invoked during `/onboard` when a new project adopts CC, or manually via `/ai-gateway-setup` in existing projects. The skill:
1. Confirms a Cloudflare account is configured
2. Creates a Gateway instance named after the project
3. Writes `CF_GATEWAY_URL` and `CF_AI_API_KEY` stubs to `.env`
4. Copies `ai-client.ts` into the project (installer-style)
5. Sets up a minimal call site for smoke-testing
6. Records in the project's CLAUDE.md that AI Gateway is configured, with which metadata conventions apply

When CC learns a new routing pattern — say, "fidelity checks work great on Llama 3 70B via Workers AI, ~10x cheaper than Haiku" — that learning updates `rules/llm-routing.md`, and `cc-upgrade` propagates it to every consuming project. Same way pib-db bug fixes and schema improvements reach projects today.

**Why this belongs in CC specifically:**
- CC is already "the tool for cross-project patterns that need to stay synchronized"
- The pib-db precedent establishes CC's willingness to own operational knowledge, not just Claude-Code-specific skills
- Without a canonical home, the knowledge lives in Oren's head and fails Flow's own anti-entropy principle
- Every project reinventing routing policy creates silent drift — fix a prompt bug in Flow, de[sic]ify keeps the buggy version forever

**Why NOT a given consuming project:**
- No one project is the "owner" of a cross-project concern
- Pattern updates would require manual propagation to sibling projects
- New projects adopting CC have no way to inherit the pattern

**Why NOT a separate `ai-patterns` npm package:**
- That's essentially what CC already is, scoped to a different domain
- Creates another versioning story for Oren to manage
- Fragments the "where does meta-infrastructure live?" answer

## 5. Layer 2: The shared router gets its own repo

**When this exists (not day one, probably not month one either).** When 3+ projects are doing nontrivial Workers AI routing — classification, embedding, transcription — the client-side routing logic starts to duplicate across project codebases. At that point a shared router Worker earns its maintenance cost. Before that, it's premature abstraction.

**Why it can't live in CC:**
- CC is npm-published templates, not a deployed service
- CC consumers don't run CC; they copy from it. A router would need to be always-on.
- The router's lifecycle (deploy on push to main, test in staging, version independently) doesn't fit CC's model

**Why it can't live in a consuming project:**
- Multiple projects use it; no single project "owns" it
- Mixing a shared service into a consuming project's repo creates awkward boundary issues (what if Flow's CI needs to deploy the router?)

**Proposed shape (for when it exists):**

```
orenmagid/ai-router/
├── src/
│   ├── index.ts                    # Worker entry: POST /route, /classify, /embed, /transcribe
│   ├── routing/
│   │   ├── policy.ts               # core routing logic (mirrors CC's llm-routing.md rules)
│   │   └── prompts.ts              # shared prompt templates per task
│   ├── auth.ts                     # per-project HMAC auth, or CF service binding
│   ├── observability.ts            # metadata headers for Gateway dashboards
│   └── model-clients/              # wrappers for each downstream (Anthropic, Workers AI, OpenAI)
├── infra/
│   ├── gateways.ts                 # IaC for flow-prod, desicify-prod, etc.
│   └── account.ts                  # account-level CF config
├── wrangler.toml                   # deploy config
├── tests/
│   ├── routing.test.ts
│   └── integration.test.ts
└── README.md
```

Call pattern from a consuming project:

```typescript
await ai.call({
  task: "classify-email",
  input: { subject, body, from },
  project: "flow",
  user: "oren",
})
```

Router inspects `task`, picks appropriate model (Workers AI 1B for classification), calls through Flow's gateway with metadata headers, returns result.

**Migration from client-side routing:** day one, consuming projects call Gateway directly via the CC-distributed `ai-client.ts`. Routing logic lives in the project. When the router repo exists, `ai-client.ts` gains a new mode: "call ai-router instead of Gateway directly." Projects opt in by flipping a flag. No forced migration.

## 6. Layer 3: CF account as code

Cloudflare account configuration (gateways, Workers, Queues, Vectorize indexes, rate limits, custom domains) should be reproducible from git. If the account is compromised or deleted, everything should redeploy from a repo.

**Where this lives:**
- **Before the shared router exists:** small standalone `cf-infra` repo, or inline as setup scripts in CC's `skills/ai-gateway-setup/`
- **Once the router exists:** lives next to it in `ai-router/infra/`

Tooling: `wrangler` for Worker deployment; direct CF API calls (or `cloudflare` npm library) for gateway and account-level config. Both in TypeScript so the whole stack shares a language.

## 7. Task-to-model map across projects

This is the concrete evidence that the pattern is worth CC owning. The fungible / non-fungible split is the key analytic move.

### Flow

| Task | Currently | Proposed | Fungible? |
|---|---|---|---|
| Email classification by sender domain | Rule-based domain mapping | Workers AI 1B on content + sender + context | Yes |
| Inbox triage routing suggestions | Manual | Workers AI semantic routing | Yes |
| Meeting summarization (actions, decisions) | Claude | Claude (interpretation) + Workers AI (structure extraction) | Split |
| Non-clinical meeting transcription | AssemblyAI | Workers AI Whisper (see §8) | Yes |
| Clinical meeting transcription | Local MLX-Whisper | **Unchanged** (privacy) | N/A |
| Voice memo → thread routing | Manual | Workers AI semantic match against thread descriptions | Yes |
| D2L HTML module parsing | CSS selectors | Workers AI extracts structured data (robust to DOM changes) | Yes |
| Smart titles for inbox items | None | Workers AI 1B | Yes |
| Articulation question generation | Claude | Claude (quality matters) | No |
| Prep scout research summaries | Claude | Claude (reasoning-heavy) | No |
| Comment classification (question / feedback / bug) | None | Workers AI | Yes |
| Meeting participant name resolution | String match + fuzzy | Workers AI semantic match | Yes |

### de[sic]ify (article-rewriter)

| Task | Currently | Proposed | Fungible? |
|---|---|---|---|
| Core rewrite (academic → plain) | Claude Sonnet | **Stays on Claude** (quality is the product) | No |
| Fidelity check (meaning preserved?) | Claude or not yet built | Workers AI 70B | Yes |
| Section chunking | Regex / heuristics | Workers AI 1B (robust to weird inputs) | Yes |
| Glossary extraction | Not productized | Workers AI 70B | Yes |
| Title / short summary | Claude | Haiku or Workers AI | Yes |
| Streaming re-rewrites | Claude | **Gateway caching** — same input, cached output | N/A |

### Research threads (IFS critique, model genealogy, etc.)

| Task | Currently | Proposed | Fungible? |
|---|---|---|---|
| Source analyses (philosophical close reading) | Claude via research-analyze | **Stays on Claude** | No |
| Voice-script dialogue generation | Claude | **Stays on Claude** | No |
| Source chunking | Manual | Workers AI | Yes |
| Semantic search over captures | Not built | Workers AI BGE embeddings + Vectorize | Yes |

### Comic pipeline

| Task | Currently | Proposed | Fungible? |
|---|---|---|---|
| Panel caption generation | Claude | **Stays on Claude** (creative, low volume) | No |
| Image generation | Leonardo AI / Nano Banana 2 | Unchanged | N/A |
| Animation | Kling via fal.ai | Unchanged | N/A |

**Pattern:** Claude stays for interpretation, creativity, and anywhere quality is the product. Workers AI for classification, extraction, structural transforms, embeddings. Gateway in front of both, always. This split is stable enough to codify as a CC rule.

## 8. The transcription case specifically

Non-clinical transcription is the single clearest, highest-confidence migration in the proposal.

**Current:** AssemblyAI Universal-3-Pro, ~$0.37/hour. Free tier $50 (~133 hours). Diarization included via integrated pyannote-backed speaker recognition.

**Proposed:** Workers AI Whisper Large v3, ~$0.001/audio-minute = ~$0.06/hour. ~6x cheaper. Quality is equivalent — what AssemblyAI runs under the hood is itself Whisper-family.

**The gap:** Workers AI doesn't currently bundle speaker diarization. For meetings (the main use case), diarization matters. Flow's local clinical pipeline already solves diarization with pyannote; porting that to a Worker is feasible but non-trivial.

**Three-option strategy:**

1. **Workers AI for non-meeting transcription** (voice memos, single-speaker audio): immediate swap, zero diarization loss.
2. **Workers AI for bulk re-transcription** (older meetings reprocessed cheaply): diarization already resolved in the original pass; re-transcribing just the words is cheap.
3. **Hybrid for new meetings:** Workers AI transcribes, Python / pyannote diarizes against the audio in parallel, results merged. Or keep AssemblyAI for diarized meetings specifically and use Workers AI everywhere else. Decision point is when quality-attributed cost savings outweigh integration complexity.

**Architectural payoff:** audio already flows through R2 (Flow's attachment layer). A Worker can trigger on R2 events, call Workers AI Whisper, write results back to Flow's DB. All inside Cloudflare, bandwidth-free. No LaunchAgent needed for the cloud path.

## 9. AI Gateway as universal front-door

Separable claim from Workers AI: **every Claude API call across every project should go through AI Gateway, full stop.**

What Gateway provides, independent of model choice:

- **Deterministic caching.** Same prompt → cached response. Cache hit rate of 20-90% depending on task. For de[sic]ify, users re-run rewrites constantly during iteration — first paid, subsequent calls free. For Flow classification, once an email is classified, re-classifications are free until TTL expires.
- **Per-project / per-skill / per-user cost attribution** via metadata headers (`x-project`, `x-skill`, `x-user`). Gateway dashboard slices by any combination. Finally answers: "how much did Flow spend last week vs. de[sic]ify vs. research threads?" That visibility doesn't exist today.
- **Fallback routing.** Claude down → OpenAI. Quota exhausted → Workers AI. Configured at Gateway level, zero code change.
- **Rate limiting.** Protects against runaway users (de[sic]ify) and loops in scripts (all projects).
- **Request / response logging.** Debugging "why did that classification fail?" becomes scriptable.
- **One key to rotate.** API keys managed at Gateway; projects use Gateway URL + Gateway auth. Anthropic key rotation doesn't touch project code.

Migration cost for Phase 1 (Gateway-only, no Workers AI): **change the base URL in each project's Anthropic client.** That's it. Zero refactor. Instant benefits. This is why Phase 1 is the right first step regardless of whether Workers AI adoption ever happens.

## 10. Separation from local LLM (Mac Mini path)

Flow's existing plan to buy an M4 Pro Mac Mini serves constraints Cloudflare cannot address:

1. **Clinical meeting confidentiality** — HIPAA-sensitive audio cannot traverse Cloudflare any more than Anthropic. Local-only is a hard constraint.
2. **Dedicated always-on compute for LaunchAgent pipelines** — meeting detector, voice capture, backup. OS-level concerns, not LLM concerns.

The Mac Mini plan and CF plan solve **different problems**. Don't try to unify them:

- **Cloud intelligence (CF):** CC pattern + shared router repo → serves all non-privacy-constrained work across all projects
- **Local intelligence (Mac Mini):** Flow-owned, because the privacy constraint is Flow-specific → serves clinical pipeline + any future local-compute needs

Different constraints, different homes. Keep them separate. The Mac Mini action in Flow should survive this proposal untouched.

## 11. Migration path

Four phases, each proving something before the next.

**Phase 1: Point-and-shoot (1 evening per project)**
- Sign up for CF AI Gateway (if not already)
- Create gateways per project: `flow-prod`, `desicify-prod`, `threads`
- Change Claude API base URL → Gateway URL in each project
- Deploy
- **Gained:** caching, observability, cost attribution, fallback capability
- **Risk:** near zero — Claude calls still go to Claude; Gateway is a transparent proxy

**Phase 2: One "intelligence over regex" experiment per project**
- Flow: email content classification beyond domain mapping. Workers AI 1B in shadow mode vs. rule-based, compare over a week.
- de[sic]ify: fidelity check with Workers AI 70B (was going to be a Claude call anyway — save the budget).
- Measure: quality against manual labels, latency, cost.
- **Gained:** evidence for or against Workers AI as a viable downgrade destination.

**Phase 3: Non-clinical transcription swap**
- Wire one meeting's transcription through Workers AI Whisper
- Compare against AssemblyAI on the same audio
- If quality holds: swap. If diarization is missing: keep AssemblyAI for meetings, Workers AI for voice memos + re-transcription batches.
- **Gained:** confidence in Cloudflare for audio workloads; dramatic cost reduction.

**Phase 4: Shared smart-router Worker (only when 3+ projects are routing)**
- Build `ai-router` repo
- Migrate client-side routing logic from projects into router
- Projects opt in project-by-project
- **Gained:** single place to evolve routing policy across portfolio; centralized prompt library.

Each phase is independently valuable. Stopping after Phase 1 still captures most of the observability and caching benefits. Phase 4 is optional and explicitly gated.

## 12. Governance questions for CC to answer

This proposal takes positions on "what" and "why" but leaves CC to decide "whether" and "how." Key questions:

1. **Is AI infrastructure pib-db-scale, or lighter?** pib-db is comprehensive: schema, MCP server, skills, migrations, rules. AI infrastructure could be similar scope (template + skills + rules + optional MCP for routing) or much lighter (just a rules file and a README pointing at Cloudflare docs). Where on that spectrum does CC want to land?

2. **Naming conventions for gateways.** Proposed: `{project-slug}-{env}` (e.g., `flow-prod`, `desicify-dev`). CC to ratify or propose alternate.

3. **Prompt library versioning.** If shared prompts live in CC (say, a `classify-email` template), how do projects pin a prompt version? Does a prompt revision trigger a `cc-upgrade` opportunity, or does each project carry its own copy?

4. **Auth between projects and the eventual shared router.** HMAC per project? Cloudflare service bindings? Per-project API keys stored in CC-managed secrets? Decision affects the Layer 2 shape.

5. **Cost attribution metadata headers.** Proposed conventions: `x-project`, `x-skill`, `x-user-id-hash`. CC to ratify the set.

6. **What happens when a model deprecates?** Workers AI models evolve. If `@cf/meta/llama-3.1-70b-instruct` becomes `@cf/meta/llama-3.3-70b-instruct`, who updates routing rules — each project independently, or CC pushes the rule change via `cc-upgrade`?

7. **Does CC ship a cabinet member for AI infrastructure concerns?** Parallel to cabinet-security (catches security gaps during plan / execute), a `cabinet-ai-infra` member would flag LLM-usage questions: "should this really be a Claude call or a Workers AI call?"

## 13. Open design questions

Things this proposal does not answer:

- **Where does the shared prompt library actually live?** Inline in ai-router repo? Imported from CC? Separate npm package? Each has tradeoffs around versioning and synchronization.
- **How do projects test against the router without hitting real CF?** Need a mock mode. Stub Worker? Local `wrangler dev`? Shared fixture responses?
- **Budget alarms.** Gateway can rate-limit but does it alert on unusual spend? If not, a monitoring Worker could. Whose responsibility?
- **Prompt A/B testing.** If CC wants to evolve a `classify-email` prompt, how do projects participate in experiments safely?
- **Retry semantics across model fallbacks.** If Claude times out and Gateway falls back to Workers AI, does the project see that? Should it?
- **Handling of structured outputs.** Claude supports structured output natively; Workers AI models vary. How does the CC rule handle tasks that require JSON — route only to structured-output-capable models?
- **Privacy / data handling.** Even non-clinical projects might have data Oren prefers not to cache. TTL-0 per-call? Encrypted payload? Gateway has features here but policy needs to be explicit.

## 14. Starter surface if CC accepts

Minimal set of artifacts to ship v0:

1. `rules/llm-routing.md` — the policy doc derived from §7 (Task-to-model map). Ratified form of "Claude for interpretation, Workers AI for structure, Gateway in front of everything."
2. `rules/ai-observability.md` — metadata header conventions.
3. `templates/ai-client/ai-client.ts` — thin wrapper with base URL, headers, retry. 100-200 LoC.
4. `skills/ai-gateway-setup/SKILL.md` — conversational skill that creates a gateway for the current project, wires `.env`, copies the client, smoke-tests.
5. README on when to use Workers AI vs stay on Claude, with the §7 tables as evidence.

That's v0. Skills can grow later (`ai-workers-ai-adopt`, `ai-transcription-setup`, etc.). The cabinet member is nice-to-have. The shared prompt library is Phase 4 territory.

## 15. What doesn't depend on CC's decision

Some parts of this are zero-coupling and can proceed even if CC never formalizes the pattern:

- **Gateway adoption per project.** Changing a base URL needs no CC template. Projects can do this today, manually, and gain immediate observability + caching. CC adopting the pattern would just make future projects inherit it automatically.
- **Measuring AssemblyAI vs Workers AI Whisper on non-clinical audio.** Pure experiment, doesn't need CC involvement.
- **Signing up for a Cloudflare Pro account** if one isn't already active, to get higher Workers AI limits.

If CC rejects or drastically reshapes this proposal, these moves remain sensible. Flagged here so the user has the option to proceed opportunistically without waiting for CC's response, **but** filing them as Flow actions now (rather than in this CC proposal) would front-run CC's scope decisions. Better to wait for CC's response and then file downstream work appropriately.

## 16. Session context

This proposal emerged from a 2026-04-17 `/orient-quick` session on Flow. Conversation arc:

1. User ran `/orient-quick`; briefing surfaced standard Flow state.
2. User asked about a Cloudflare "Agents Week" email sitting in the inbox (`in:f88bd1cc`, 2026-04-13) — specifically whether it addressed Flow's local-LLM thinking.
3. Initial response distinguished Workers AI (relevant to routine classification tasks, reframes `act:9fb95b0f` Ollama-eval scope) from Agents SDK / Durable Objects (interesting but lower fit given Flow's deliberate local-first architecture) from the Mac Mini plan (separate privacy-driven constraint).
4. User extended: "does this apply to de[sic]ify and anywhere we need intelligence but cheaper than Anthropic?"
5. Response developed the fungible / non-fungible framework and task-to-model tables across projects, with attention to "intelligence over regex" being structurally unlocked.
6. User asked: "where does this setup live? CC? Something else shared between projects?"
7. Response proposed the three-layer architecture (CC pattern / shared router repo / IaC).
8. User pushed back incisively: filing a Flow project that assumes CC's eventual shape is front-running. If CC goes a different direction, the Flow project is stale. Better to consolidate everything into one comprehensive CC feedback item right now; defer project-level filings until CC responds.
9. This feedback is the result.

Worth noting for CC: Oren treats cross-project infrastructure decisions as pib-db-scale by default, and expects comprehensive documentation rather than lightweight tickets. The expectation is that a future session (potentially weeks or months from now) can execute on this proposal without re-deriving anything. Hence the length.
