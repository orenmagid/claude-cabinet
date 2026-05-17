# cabinet-verify 0.2.0 — internal critique-edges record

**Session:** 2026-05-17 — four cabinet-verify extraction acts
(`act:f18c4fe1`, `28b23fb7`, `16861d81`, `8c31f99a`) shipped as
sequenced commits.

**Project context:** Flow's `/verify learn` cold-start surfaced a
stack of install-day blockers that every new consumer would hit.
The work in this session is the response — turning a working but
brittle scaffold into something that bootstraps in <30 minutes on
a fresh machine.

---

### Decision 1: Option A (cabinet-verify owns baseline steps via
auto-register) over Option B (install.sh emits `support/common-steps.ts`)

**Claim.** Move the five universal Cucumber step handlers into
`cabinet-verify`'s runtime and have them self-register via a
side-effect import from `index.ts`. Expose two extension points as
public API: `setSignInHandler(fn)` for project auth, `registerCheck(id, fn)`
for per-checkId assertions. Bump 0.1.0 → 0.2.0 to signal API growth.

**Evidence.** Every consumer (Flow, de[sic]ify) re-implemented the
same 3–5 handlers. cucumber-js throws on duplicate step definitions,
so the previous mitigation — putting handlers in `scenario-01.ts`
with a "do NOT redeclare" comment in `scenario-{02..05}.ts` — was
asymmetric and fragile. New contributors copying scenario-01 as a
template would reintroduce duplicates.

**Skeptic's critique.** "You just grew cabinet-verify's public API
by two functions and a side-effect import in service of a four-line
extraction. The registry pattern is overhead compared to a flat
`support/common-steps.ts` that doesn't change any public surface.
You also bound the registration mechanism to `import { CabinetVerifyWorld }`
which is implicit magic — a consumer reading their own
`support/world.ts` won't see baseline-steps mentioned anywhere."

**Counter.** Option B (common-steps.ts) keeps the same code in every
project, just relocated — it doesn't reduce the surface a future
breaking change has to migrate. The registry pattern explicitly
*declares* that per-checkId assertions are project-owned, decouples
them from the cucumber step handler, and gives the upstream a
single point to evolve (e.g., adding `registerCheck` options later
won't ripple into every consumer). The auto-register-on-World-import
side effect is the same pattern `world.ts` itself uses (its
`BeforeAll`/`AfterAll`/`Before` hooks are also side-effectful). The
asymmetry concern with Option B (project still owns 5 boilerplate
lines per scenario file) is exactly what Option A eliminates.

**Off-ramp.** If two future consumers find themselves needing to
override a baseline handler (e.g., a project where "I navigate to
{string}" needs custom waiting logic), the registry pattern doesn't
help — cucumber-js still rejects redeclaration. At that point,
swap to a strategy/visitor pattern where the World subclass can
override per-step behavior. The current registry pattern is the
right shape for the *current* observed need.

---

### Decision 2: `--env-file-if-exists` over `--env-file` in generated
e2e/package.json

**Claim.** Use `node --env-file-if-exists=.env.local` instead of
`--env-file=.env.local` in the verify and preflight scripts. Pin
`engines.node >= 20.12` in the generated package.json.

**Evidence.** A fresh clone before `cp .env.local.example .env.local`
fails `--env-file` with `ENOENT: no such file or directory` — a
confusing error compared to preflight's friendly "no URL specified."
cabinet-debugger surfaced this during the pre-impl checkpoint.

**Skeptic's critique.** "You're hiding a real configuration problem
behind permissive defaults. A missing `.env.local` is operator error;
ENOENT tells them exactly what to fix. `--env-file-if-exists`
swallows that and pushes the error one layer deeper."

**Counter.** The two failure modes have different audiences. ENOENT
on `.env.local` is a *fresh-install* error — the operator has never
seen the file and doesn't know to create it. The friendly "no URL
specified" error from preflight is correctly targeted ("pass --url
or set CABINET_VERIFY_DEV_URL") and points at the action they need
to take. ENOENT just says "file not found." The preflight error is
strictly more actionable for the same root cause.

**Off-ramp.** If preflight ever drops the "no URL specified" message,
or if we add other env-required steps that don't have equivalent
friendly errors, switch back to `--env-file` so the platform error
surfaces.

---

### Decision 3: Sequence the four acts rather than parallelize

**Claim.** Run the four cabinet-verify acts in series, with the user
approving sequencing upfront, single design discussion before plowing,
per-action commits with focused diffs.

**Evidence.** All four acts touched `install.sh`. Three touched
`SKILL.md`. Two touched `phases/calibrate.md` and `phases/generate.md`.
Parallel worktree-style execution would have produced constant
merge conflicts in the heredoc bodies — the exact files where the
bash apostrophe trap lives, which would have compounded the friction.

**Skeptic's critique.** "You spent ~3 hours sequentially on work that
could have been ~45 minutes if dispatched to four parallel worktree
agents. Per the platform memo, worktree agents are the right tool
for independent work; the 'these touch the same file' framing
underestimates how well git-merge handles disjoint changes within
the same file."

**Counter.** The four acts weren't disjoint within `install.sh` —
act 1 rewrote the PACKAGE_JSON heredoc, act 2 rewrote the AUTH_TS
heredoc, act 4 added the test-stack emission block. Parallel worktree
agents would have all branched from the same commit, each emitting
diffs against pre-act-1 `install.sh`. Merging them after the fact
requires running act 1's heredoc rewrite first, then re-rebasing
acts 2 and 4 onto that. The "spend 45 minutes parallelizing" claim
ignores the rebase cost. Sequencing also let cabinet-debugger's
catches in act 1 (`--env-file-if-exists`, engines pin) inform act 4
without re-derivation.

**Off-ramp.** For a batch where the surface areas are genuinely
disjoint (different files entirely, no shared heredocs), parallel
worktree dispatch is the right move. This is the heuristic captured
in `act:c77f451b` for promotion into execute/SKILL.md.

---

### Decision 4: Test-stack scaffold ships as a TEMPLATE with a TODO
marker, not a working script

**Claim.** Generated `e2e/start-test-stack.sh` substitutes calibrated
values (DB path, ports) but leaves the API server boot command as a
`TODO` with two example shapes inline (`node server.js`,
`npm run start:api`).

**Evidence.** Project boot commands vary too widely to generate one
that runs out of the box (Node, uvicorn, npm scripts, custom shells,
Docker compose). A wrong default would be worse than a clear TODO.

**Skeptic's critique.** "You're shipping an MVP that requires
project-specific handwork. AC #4 said 'a working start-test-stack.sh
that, when run, boots an isolated stack.' Your script exits 1. That's
not a passing AC."

**Counter.** Acknowledged in the breadcrumb deviation note. The
structural pieces — DB snapshot logic, ports, env-var contract,
README guidance — *do* run as-is. The single TODO is the smallest
knob the consumer must turn. Generating a wrong boot command and
having the script crash partway through would be a worse experience
than an explicit "fill this in" marker.

**Off-ramp.** If three+ consumers adopt the same boot shape (e.g.,
all use `npm run start:api`), detect that during calibrate (5th
question: "What's the API server boot command?") and generate it
inline. Until then, the TODO is calibrated to the actual variance
in the wild.
