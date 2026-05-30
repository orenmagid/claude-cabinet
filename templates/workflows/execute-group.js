export const meta = {
  name: 'execute-group',
  description: 'Run a generated parallel plan group: cabinet CP1 → parallel worktree implementation → sequential merge with per-plan CP3 → integration → group CP3 → completion report',
  phases: [
    { title: 'CP1', detail: 'Pre-implementation cabinet review (group + per-plan)' },
    { title: 'Implement', detail: 'One worktree agent per plan, in parallel' },
    { title: 'Merge', detail: 'Sequential merge into main + per-plan CP3' },
    { title: 'Integration', detail: 'Full validate + breadcrumb audit' },
    { title: 'GroupCP3', detail: 'Informed final cabinet review' },
    { title: 'Completion', detail: 'Manual ACs → actions; completion report' },
  ],
}

// Workflow scripts have NO filesystem/git/shell access — they only spawn
// agents and process the structured results. Every concrete action (git
// merge, /validate, breadcrumb writes, pib-db mutations) happens inside an
// agent() call. This script is pure orchestration.

// The Workflow tool may deliver args as a JSON string — parse if needed.
const a = typeof args === 'string' ? JSON.parse(args) : (args || {})

// --- Schemas ---

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['verdict'],
  properties: {
    verdict: { type: 'string', enum: ['continue', 'pause', 'stop'] },
    concerns: {
      type: 'array',
      items: {
        type: 'object',
        required: ['description'],
        properties: {
          description: { type: 'string' },
          evidence: { type: 'string' },
          severity: { type: 'string', enum: ['blocking', 'advisory'] },
        },
      },
    },
  },
}

const IMPL_SCHEMA = {
  type: 'object',
  required: ['fid', 'status'],
  properties: {
    fid: { type: 'string' },
    status: { type: 'string', enum: ['implemented', 'failed-impl', 'noop'] },
    branch: { type: 'string' },
    auto_ac: {
      type: 'object',
      properties: {
        total: { type: 'integer' },
        passed: { type: 'integer' },
        failed: { type: 'integer' },
      },
    },
    manual_ac_deferred: { type: 'array', items: { type: 'string' } },
    scenarios_updated: { type: 'array', items: { type: 'string' } },
    deviations: { type: 'array', items: { type: 'string' } },
  },
}

const MERGE_SCHEMA = {
  type: 'object',
  required: ['fid', 'merged'],
  properties: {
    fid: { type: 'string' },
    merged: { type: 'boolean' },
    already_merged: { type: 'boolean' },
    validate: { type: 'string', enum: ['pass', 'fail', 'skipped'] },
    reverted: { type: 'boolean' },
    note: { type: 'string' },
  },
}

// --- Escalation (mirrors cabinet/checkpoint-protocol.md Step 4) ---

function escalate(verdicts) {
  const raw = verdicts || []
  const v = raw.filter(Boolean)
  // Total review failure: reviewers were spawned but NONE returned a usable
  // verdict (all errored). Do not silently proceed — a checkpoint that could
  // not run is not a checkpoint that passed. Treat as a halt so the operator
  // decides, rather than degrading an outage into an unconditional green light.
  if (raw.length > 0 && v.length === 0) {
    return { decision: 'halt', reason: 'all cabinet reviewers failed to return a verdict — the review did not actually run', offenders: [] }
  }
  const stops = v.filter(x => x.verdict === 'stop')
  const pauses = v.filter(x => x.verdict === 'pause')
  if (stops.length > 0) return { decision: 'halt', reason: 'a cabinet member returned stop', offenders: stops }
  if (pauses.length >= 3) return { decision: 'halt', reason: '3+ cabinet members returned pause', offenders: pauses }
  if (pauses.length > 0) return { decision: 'proceed-with-concerns', offenders: pauses }
  return { decision: 'proceed' }
}

// Spawn one cabinet agent per member for a given scope. Each agent reads
// the checkpoint protocol + its own SKILL.md and returns a VERDICT.
function reviewScope({ members, scopeLabel, scopeInstruction, phaseTitle }) {
  return parallel(members.map(m => () =>
    agent(
      [
        `You are the cabinet member "${m.key}" performing a checkpoint review.`,
        `Read the checkpoint protocol and follow it: ${a.checkpointProtocolPath}`,
        `Read your own expertise/profile: ${m.path}`,
        a.briefingPath ? `Read the project briefing: ${a.briefingPath}` : '',
        m.directive ? `Your execute directive: ${m.directive}` : '',
        ``,
        `Checkpoint scope: ${scopeLabel}.`,
        scopeInstruction,
        ``,
        `You have Bash/Read/Grep/Glob — inspect the actual code and diffs yourself.`,
        `Return a verdict object: { verdict: continue|pause|stop, concerns: [...] }.`,
      ].filter(Boolean).join('\n'),
      { agentType: m.agentType || undefined, label: `${phaseTitle}:${m.key}`, phase: phaseTitle, schema: VERDICT_SCHEMA }
    )
  ))
}

// --- Preconditions ---

const plans = (a.plans || []).filter(Boolean)
const members = a.cabinetMembers || []
const isGroup = plans.length > 1

if (plans.length === 0) {
  // 0-plan group (e.g. every plan drifted out during the staleness guard).
  log(`Group "${a.label}" has 0 runnable plans — skipped. Re-run /generate-plan-groups.`)
  return {
    plans_executed: '0 of 0',
    per_plan: [],
    checkpoints: {},
    loose_ends: ['Group skipped: no runnable plans (all drifted or filtered).'],
  }
}

log(`Executing group "${a.label}": ${plans.length} plan(s), ${members.length} cabinet member(s)`)

// === Phase: CP1 — Pre-Implementation Review ===
phase('CP1')

const cp1 = { group: null, perPlan: [] }

if (members.length > 0) {
  // Group-level CP1 only meaningful for 2+ plans (combination concerns).
  if (isGroup) {
    const aggregateSurface = plans.map(p => `- ${p.fid} ${p.text}\n${p.surfaceArea || '(surface area in notes)'}`).join('\n')
    const groupVerdicts = await reviewScope({
      members,
      scopeLabel: `group aggregate — these ${plans.length} plans will run in parallel`,
      scopeInstruction: `Review the COMBINATION. Any concern about these plans running together (shared assumptions, ordering, cross-plan interactions)?\n\nPlans:\n${aggregateSurface}`,
      phaseTitle: 'CP1',
    })
    const e = escalate(groupVerdicts)
    cp1.group = { verdict: e.decision === 'halt' ? 'stop' : 'continue', detail: e }
    if (e.decision === 'halt') {
      return haltReport('CP1 group review', e, plans, { cp1 })
    }
  }

  // Per-plan CP1 (parallel across plans; each plan's members in parallel too).
  const perPlanResults = await parallel(plans.map(p => () =>
    reviewScope({
      members,
      scopeLabel: `pre-impl review of plan ${p.fid}`,
      scopeInstruction: `Is this plan safe to start? Review its approach and surface area.\n\nPlan ${p.fid}: ${p.text}\n\n${p.notes || p.surfaceArea || ''}`,
      phaseTitle: 'CP1',
    }).then(verdicts => ({ fid: p.fid, escalation: escalate(verdicts), verdicts }))
  ))

  for (const r of perPlanResults.filter(Boolean)) {
    cp1.perPlan.push({ fid: r.fid, verdict: r.escalation.decision === 'halt' ? 'stop' : 'continue' })
    if (r.escalation.decision === 'halt') {
      return haltReport(`CP1 per-plan review (${r.fid})`, r.escalation, plans, { cp1 })
    }
  }
}

// === Phase: Implement — Parallel Worktree Agents ===
phase('Implement')

const implResults = (await parallel(plans.map(p => () =>
  agent(
    [
      `Implement this plan inside your isolated git worktree, then report a structured result.`,
      `The plan IS your spec — follow its implementation steps and acceptance criteria.`,
      `Defer to the worktree's CLAUDE.md for project conventions; do not invent process.`,
      ``,
      `Steps you MUST perform, in order:`,
      `1. Write the verification breadcrumb .claude/verification/${p.fid}.json with spec_read:true.`,
      `2. Implement the plan.`,
      `3. Run /validate inside the worktree. If it fails, fix before continuing.`,
      `4. Verify every [auto] acceptance criterion. Record total/passed/failed.`,
      `   - Zero [auto] ACs → auto_ac all zero, ac_verified is vacuously satisfied.`,
      `   - List every [manual] AC you could not verify in manual_ac_deferred.`,
      `5. If your changes affect Cucumber .feature files under e2e/features/, update`,
      `   the affected scenarios. List touched files in scenarios_updated (else []).`,
      `6. Update the breadcrumb with ac_verified + a one-line summary + deviations.`,
      `7. Commit in the worktree with a clear message. Report your branch name.`,
      ``,
      `If you cannot complete implementation, return status "failed-impl" with the`,
      `reason in deviations. If the plan's changes already exist on main, return`,
      `status "noop" and no branch.`,
      ``,
      `Plan ${p.fid}: ${p.text}`,
      ``,
      p.notes || p.surfaceArea || '',
    ].filter(Boolean).join('\n'),
    { isolation: 'worktree', label: `impl:${p.fid}`, phase: 'Implement', schema: IMPL_SCHEMA }
  ).then(r => (r ? { ...r, fid: p.fid } : null))  // p.fid is authoritative, not the agent's self-report
))).filter(Boolean)

const implemented = implResults.filter(r => r.status === 'implemented' && r.branch)
const implementedNoBranch = implResults.filter(r => r.status === 'implemented' && !r.branch)
const failedImpl = implResults.filter(r => r.status === 'failed-impl')
const noops = implResults.filter(r => r.status === 'noop')
const missingAgents = plans.filter(p => !implResults.some(r => r.fid === p.fid))

log(`Implementation: ${implemented.length} implemented, ${failedImpl.length} failed, ${noops.length} noop, ${missingAgents.length} no-result`)

// === Phase: Merge & Per-Plan CP3 — Sequential ===
phase('Merge')

const mergeOutcomes = []
const cp3PerPlan = []

// Sequential: never parallelize merges into main.
for (const r of implemented) {
  // Idempotency + branch-existence are enforced by the merge agent, which
  // also runs /validate and reverts on failure — all of which need git/shell.
  const m = await agent(
    [
      `You are merging one worktree branch into main for a parallel plan group.`,
      `Plan ${r.fid}, branch: ${r.branch}.`,
      ``,
      `Do this carefully, reporting a structured result:`,
      `1. Idempotency: if this branch's commits are ALREADY on main`,
      `   (git branch --merged, or the diff is empty), set already_merged:true,`,
      `   merged:true, validate:"skipped" and stop — do not re-merge.`,
      `2. Branch-existence: if branch "${r.branch}" does not exist, set`,
      `   merged:false, note the missing branch, and stop.`,
      `3. Merge the branch into main.`,
      `4. Run /validate on main. If it FAILS: revert the merge`,
      `   (git reset --hard / git revert as appropriate), set reverted:true,`,
      `   merged:false, validate:"fail", and note what broke.`,
      `5. On success: merged:true, validate:"pass".`,
    ].join('\n'),
    { label: `merge:${r.fid}`, phase: 'Merge', schema: MERGE_SCHEMA }
  )
  const outcome = m || { merged: false, note: 'merge agent returned no result' }
  outcome.fid = r.fid  // authoritative from the loop, not the agent's self-report
  mergeOutcomes.push(outcome)

  // Per-plan CP3 only if the merge actually landed new code on main.
  if (members.length > 0 && outcome.merged && !outcome.already_merged) {
    const verdicts = await reviewScope({
      members,
      scopeLabel: `post-merge review of plan ${r.fid}`,
      scopeInstruction: `This plan was just merged into main. Review its merged diff (run \`git diff HEAD~1\` yourself). Any concern now that it's integrated?`,
      phaseTitle: 'Merge',
    })
    const e = escalate(verdicts)
    cp3PerPlan.push({ fid: r.fid, verdict: e.decision === 'halt' ? 'stop' : 'continue' })
    if (e.decision === 'halt') {
      // Revert this plan's merge — CP3 rejected it post-merge. Get a
      // STRUCTURED result: a revert we can't confirm must not be trusted.
      const rev = await agent(
        `Cabinet CP3 rejected plan ${r.fid} after merge. Revert its merge from main (git revert/reset as appropriate) and park branch ${r.branch}. Then report honestly whether main is clean and /validate passes.`,
        { label: `revert:${r.fid}`, phase: 'Merge', schema: {
          type: 'object', required: ['reverted', 'main_clean'],
          properties: {
            reverted: { type: 'boolean' },
            main_clean: { type: 'boolean' },
            validate: { type: 'string', enum: ['pass', 'fail'] },
            note: { type: 'string' },
          },
        } }
      )
      outcome.merged = false
      outcome.reverted = !!(rev && rev.reverted)
      outcome.note = (outcome.note ? outcome.note + '; ' : '') + `CP3 stop → revert ${outcome.reverted ? 'ok' : 'UNCONFIRMED'}`
      // If the revert did not provably restore a clean, valid main, HALT the
      // whole loop — merging the next plan onto a dirty/broken base is worse
      // than stopping. The operator untangles it from a known state.
      if (!rev || !rev.reverted || rev.main_clean === false || rev.validate === 'fail') {
        return haltReport(
          `post-merge revert of ${r.fid} (CP3 stop)`,
          { reason: 'revert after CP3 stop did not provably restore a clean main — halting before any further merges', offenders: e.offenders },
          plans,
          { cp1, cp3_per_plan: cp3PerPlan, merges_so_far: mergeOutcomes }
        )
      }
    }
  } else if (members.length > 0) {
    cp3PerPlan.push({ fid: r.fid, verdict: 'skipped' })
  }
}

const merged = mergeOutcomes.filter(o => o.merged)

// === Phase: Final Integration ===
phase('Integration')

const integration = await agent(
  [
    `Final integration check for plan group "${a.label}" after ${merged.length} merge(s).`,
    `Perform and report:`,
    `1. Run a full /validate on main. Report pass/fail.`,
    `2. Breadcrumb audit: for each of these merged plans, confirm`,
    `   .claude/verification/<fid>.json exists with spec_read:true and`,
    `   ac_verified:true (vacuous if zero auto ACs) and a scenarios_updated field.`,
    `   Merged plans: ${merged.map(o => o.fid).join(', ') || '(none)'}`,
    `3. List any missing/invalid breadcrumbs.`,
    `Return JSON: { validate: "pass"|"fail", breadcrumbs: "valid"|"invalid", missing: [fid,...], notes: "..." }`,
  ].join('\n'),
  {
    label: 'integration', phase: 'Integration',
    schema: {
      type: 'object',
      required: ['validate', 'breadcrumbs'],
      properties: {
        validate: { type: 'string', enum: ['pass', 'fail'] },
        breadcrumbs: { type: 'string', enum: ['valid', 'invalid'] },
        missing: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
      },
    },
  }
) || { validate: 'fail', breadcrumbs: 'invalid', notes: 'integration agent returned no result' }

// === Phase: Group CP3 — Informed Final Review ===
phase('GroupCP3')

let groupCp3 = { verdict: 'skipped' }
if (members.length > 0 && isGroup && merged.length > 0) {
  const qaPicture = [
    `Group: ${a.label}`,
    `Merged: ${merged.map(o => o.fid).join(', ')}`,
    `Validate: ${integration.validate}; Breadcrumbs: ${integration.breadcrumbs}`,
    `Per-plan CP3 verdicts: ${JSON.stringify(cp3PerPlan)}`,
    `Implementation deviations: ${JSON.stringify(implemented.map(r => ({ fid: r.fid, deviations: r.deviations || [] })))}`,
  ].join('\n')
  const verdicts = await reviewScope({
    members,
    scopeLabel: `group aggregate, informed final review`,
    scopeInstruction: `Everything is merged. Review the full aggregate diff on main (run \`git diff\` against the group's start) plus this QA picture. Ship-ready?\n\n${qaPicture}`,
    phaseTitle: 'GroupCP3',
  })
  const e = escalate(verdicts)
  groupCp3 = { verdict: e.decision === 'halt' ? 'stop' : 'continue', detail: e }
}

// === Phase: Completion ===
phase('Completion')

// Completion gate: never auto-mark plans done on a broken main, and never
// override a Group CP3 stop (the protocol requires explicit user override
// for a stop). When blocked, leave plans OPEN and surface for the operator.
const completionBlocked =
  integration.validate !== 'pass' ? 'final /validate did not pass' :
  groupCp3.verdict === 'stop' ? 'group CP3 returned stop (requires explicit user override)' :
  null

let completion = {
  completed: [],
  manual_ac_actions: [],
  notes: completionBlocked ? `auto-completion skipped: ${completionBlocked} — plans left open for review` : '',
}

if (completionBlocked) {
  log(`Completion gated: ${completionBlocked}. Merged plans left OPEN for operator review.`)
} else {
// Manual ACs → new pib-db actions (one per unverified manual AC), then mark
// merged plans done. Breadcrumb-gated completion is enforced by the
// action-completion-gate.sh hook (Piece 4) — this agent just performs the
// MCP/CLI calls and reports what it created/completed.
completion = await agent(
  [
    `Close out plan group "${a.label}".`,
    `For each merged plan with manual ACs that were deferred, create one pib-db`,
    `action per unverified manual AC (so they are trackable work, not lost).`,
    `Then mark each successfully-merged-and-reviewed plan done via pib_complete_action.`,
    `Do NOT complete plans that were parked, reverted, or failed.`,
    ``,
    `Merged plans and their deferred manual ACs:`,
    JSON.stringify(implemented
      .filter(r => merged.some(o => o.fid === r.fid))
      .map(r => ({ fid: r.fid, manual_ac_deferred: r.manual_ac_deferred || [] })), null, 2),
    ``,
    `Return JSON: { completed: [fid,...], manual_ac_actions: [{plan: fid, action: fid}], notes: "..." }`,
  ].join('\n'),
  {
    label: 'completion', phase: 'Completion',
    schema: {
      type: 'object',
      properties: {
        completed: { type: 'array', items: { type: 'string' } },
        manual_ac_actions: { type: 'array', items: { type: 'object' } },
        notes: { type: 'string' },
      },
    },
  }
) || { completed: [], manual_ac_actions: [], notes: 'completion agent returned no result' }
}

// === Completion Report (final workflow output) ===

const manualActionsByPlan = {}
for (const a of (completion.manual_ac_actions || [])) {
  if (!a || !a.plan) continue
  ;(manualActionsByPlan[a.plan] ||= []).push(a.action)
}

const perPlan = plans.map(p => {
  const impl = implResults.find(r => r.fid === p.fid)
  const mrg = mergeOutcomes.find(o => o.fid === p.fid)
  const cp3 = cp3PerPlan.find(c => c.fid === p.fid)
  let status = 'failed-impl'
  if (mrg && mrg.merged) status = 'merged'
  else if (mrg && (mrg.reverted || mrg.merged === false)) status = 'parked'
  else if (impl && impl.status === 'noop') status = 'noop'
  else if (impl && impl.status === 'implemented') status = 'parked'
  return {
    fid: p.fid,
    text: p.text,
    status,
    auto_ac: (impl && impl.auto_ac) || { total: 0, passed: 0, failed: 0 },
    manual_ac_actions: manualActionsByPlan[p.fid] || [],
    scenarios_updated: (impl && impl.scenarios_updated) || [],
    deviations: (impl && impl.deviations) || [],
    cp3_verdict: (cp3 && cp3.verdict) || 'n/a',
  }
})

const looseEnds = []
for (const o of mergeOutcomes) if (!o.merged) looseEnds.push(`Plan ${o.fid} not merged: ${o.note || 'see CP3/validate'}`)
for (const r of failedImpl) looseEnds.push(`Plan ${r.fid} failed implementation: ${(r.deviations || []).join('; ')}`)
for (const r of implementedNoBranch) looseEnds.push(`Plan ${r.fid} reported implemented but returned no branch — cannot merge (parked, no diff to integrate)`)
for (const p of missingAgents) looseEnds.push(`Plan ${p.fid} produced no implementation result`)
if (integration.validate !== 'pass') looseEnds.push(`Final /validate did not pass: ${integration.notes || ''}`)
if (integration.breadcrumbs !== 'valid') looseEnds.push(`Breadcrumb audit invalid; missing: ${(integration.missing || []).join(', ')}`)
if (groupCp3.verdict === 'stop') looseEnds.push(`Group CP3 returned stop — review before shipping`)

const report = {
  plans_executed: `${merged.length} of ${plans.length}`,
  per_plan: perPlan,
  checkpoints: {
    cp1_group: cp1.group ? cp1.group.verdict : 'n/a',
    cp1_per_plan: cp1.perPlan,
    cp3_per_plan: cp3PerPlan,
    cp3_group: groupCp3.verdict,
    integration: { validate: integration.validate, breadcrumbs: integration.breadcrumbs },
  },
  loose_ends: looseEnds,
}

// Persist the report to disk BEFORE any pib_complete_action calls. The
// action-completion-gate.sh reads this file; if it doesn't exist, the gate
// permanently blocks grp:-tagged plans. The workflow has no fs access, so
// this must happen inside an agent. Order: write report → then mark done.
await agent(
  [
    `Write the following JSON to .claude/verification/group-${a.label}-report.json (create the directory if needed):`,
    ``,
    '```json',
    JSON.stringify(report, null, 2),
    '```',
    ``,
    `Then confirm: report written.`,
  ].join('\n'),
  { label: 'persist-report', phase: 'Completion' }
)

log(`Group "${a.label}" done: ${report.plans_executed} merged. ${looseEnds.length} loose end(s).`)
return report

// --- helpers ---

// Early-halt report: a checkpoint stopped the run before/within implementation.
function haltReport(where, escalation, allPlans, checkpoints) {
  log(`HALTED at ${where}: ${escalation.reason}`)
  return {
    plans_executed: `0 of ${allPlans.length}`,
    halted_at: where,
    reason: escalation.reason,
    offenders: escalation.offenders,
    // per_plan is intentionally empty on a halt — the run stopped before
    // producing per-plan outcomes. See checkpoints + loose_ends for state.
    // (On a mid-loop merge halt, partial merge state is under checkpoints.)
    per_plan: [],
    checkpoints,
    loose_ends: [`Run halted at ${where} — ${escalation.reason}.`],
  }
}
