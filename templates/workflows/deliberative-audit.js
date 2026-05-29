export const meta = {
  name: 'deliberative-audit',
  description: 'Two-stage cabinet audit with cross-member critique',
  phases: [
    { title: 'Review', detail: 'Stage 1 members investigate codebase' },
    { title: 'Critique', detail: 'Stage 2 members review findings' },
    { title: 'Rebuttal', detail: 'Challenged members respond (opt-in)' },
    { title: 'Synthesize', detail: 'Merge into deliberation report' },
  ],
}

// --- Schemas for structured output (Stage 2, 3, 4 only) ---
// Stage 1 agents read output-contract.md + finding-schema.json from disk.

const CRITIQUE_SCHEMA = {
  type: 'object',
  required: ['annotations'],
  properties: {
    annotations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['findingId', 'type', 'text'],
        properties: {
          findingId: { type: 'string' },
          type: { type: 'string', enum: ['challenge', 'support', 'context', 'correction'] },
          text: { type: 'string' },
          severitySuggestion: { type: 'string', enum: ['critical', 'warn', 'info', 'idea'] }
        }
      }
    }
  }
}

const REBUTTAL_SCHEMA = {
  type: 'object',
  required: ['responses'],
  properties: {
    responses: {
      type: 'array',
      items: {
        type: 'object',
        required: ['findingId', 'response', 'comment'],
        properties: {
          findingId: { type: 'string' },
          response: { type: 'string', enum: ['withdraw', 'modify', 'defend'] },
          comment: { type: 'string' }
        }
      }
    }
  }
}

const REPORT_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'cabinet-member', 'severity', 'title', 'description', 'status', 'autoFixable'],
        properties: {
          id: { type: 'string' },
          'cabinet-member': { type: 'string' },
          severity: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          assumption: { type: 'string' },
          evidence: { type: 'string' },
          question: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'integer' },
          suggestedFix: { type: 'string' },
          type: { type: 'string' },
          autoFixable: { type: 'boolean' },
          status: { type: 'string' },
          annotations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                'cabinet-member': { type: 'string' },
                type: { type: 'string' },
                text: { type: 'string' },
                'severity-suggestion': { type: 'string' }
              }
            }
          },
          rebuttal: {
            type: 'object',
            properties: {
              response: { type: 'string' },
              comment: { type: 'string' }
            }
          }
        }
      }
    },
    droppedCount: { type: 'integer' },
    summary: { type: 'string' }
  }
}

// --- Stage 1: Review ---

phase('Review')
log(`Stage 1: ${args.stage1Members.length} members investigating`)

const stage1Results = await parallel(
  args.stage1Members.map(m => () =>
    agent(
      [
        `You are a cabinet member conducting an audit review.`,
        `Read your full investigation protocol: ${m.path}`,
        `Read the output contract: ${args.outputContractPath}`,
        `Read the project briefing: ${args.briefingPath}`,
        `Read the finding schema: ${args.findingSchemaPath}`,
        ``,
        m.directive ? `Your specific directive: ${m.directive}` : '',
        ``,
        args.suppression.length > 0
          ? `Skip findings matching these suppressed IDs: ${args.suppression.join(', ')}`
          : '',
        ``,
        `Follow your two-phase protocol: explore broadly, then rank and emit`,
        `your top 5-8 findings as JSON matching the finding schema.`,
        `Return ONLY the JSON object with "findings" and "meta" keys.`,
      ].filter(Boolean).join('\n'),
      {
        agentType: m.agentType || undefined,
        label: m.key,
        phase: 'Review',
      }
    )
  )
)

// Parse Stage 1 results — agents return text (no schema enforcement).
const allFindings = []
for (let i = 0; i < stage1Results.length; i++) {
  const raw = stage1Results[i]
  if (!raw) continue
  try {
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw)
    const jsonMatch = text.match(/\{[\s\S]*"findings"[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed.findings)) {
        allFindings.push(...parsed.findings)
      }
    }
  } catch {
    log(`Warning: could not parse findings from ${args.stage1Members[i].key}`)
  }
}

log(`Stage 1 complete: ${allFindings.length} findings from ${args.stage1Members.length} members`)

if (allFindings.length === 0) {
  return { findings: [], droppedCount: 0, summary: 'No findings produced by Stage 1 members.' }
}

// --- Stage 2: Critique ---

phase('Critique')
log(`Stage 2: ${args.stage2Members.length} critics reviewing ${allFindings.length} findings`)

const findingsJson = JSON.stringify(allFindings, null, 2)

const critiqueResults = await parallel(
  args.stage2Members.map(m => () =>
    agent(
      [
        `You are a Stage-2 critic in a deliberative audit.`,
        `Read your expertise profile: ${m.path}`,
        `Read the critique contract: ${args.critiqueContractPath}`,
        ``,
        `Review these ${allFindings.length} findings through your domain lens.`,
        `For each finding that touches your expertise, produce an annotation.`,
        `Stay silent on findings outside your domain.`,
        ``,
        `Findings to review:`,
        findingsJson,
      ].join('\n'),
      {
        agentType: m.agentType || undefined,
        label: `critique:${m.key}`,
        phase: 'Critique',
        schema: CRITIQUE_SCHEMA,
      }
    )
  )
)

// Attach annotations to findings.
const annotationsByFinding = {}
for (let i = 0; i < critiqueResults.length; i++) {
  const result = critiqueResults[i]
  if (!result || !result.annotations) continue
  const criticKey = args.stage2Members[i].key
  for (const ann of result.annotations) {
    if (!ann.findingId) continue
    if (!annotationsByFinding[ann.findingId]) annotationsByFinding[ann.findingId] = []
    annotationsByFinding[ann.findingId].push({
      'cabinet-member': criticKey,
      type: ann.type,
      text: ann.text,
      ...(ann.severitySuggestion ? { 'severity-suggestion': ann.severitySuggestion } : {}),
    })
  }
}

// Set status on each finding based on annotations.
for (const f of allFindings) {
  const anns = annotationsByFinding[f.id]
  if (anns && anns.length > 0) {
    f.annotations = anns
    f.status = anns.some(a => a.type === 'challenge') ? 'challenged' : 'upheld'
  } else {
    f.status = 'upheld'
  }
}

const challengedCount = allFindings.filter(f => f.status === 'challenged').length
log(`Stage 2 complete: ${challengedCount} challenged, ${allFindings.length - challengedCount} upheld`)

// --- Stage 3: Rebuttal (opt-in) ---

if (args.rebuttal && challengedCount > 0) {
  phase('Rebuttal')

  // Group challenges by original Stage-1 member for batching.
  const challengesByMember = {}
  for (const f of allFindings) {
    if (f.status !== 'challenged') continue
    const member = f['cabinet-member']
    if (!challengesByMember[member]) challengesByMember[member] = []
    challengesByMember[member].push({
      findingId: f.id,
      title: f.title,
      challenges: f.annotations.filter(a => a.type === 'challenge'),
    })
  }

  const membersToRebutt = Object.entries(challengesByMember)
  log(`Stage 3: ${membersToRebutt.length} members responding to challenges`)

  const rebuttalResults = await parallel(
    membersToRebutt.map(([memberKey, items]) => {
      const memberInfo = args.stage1Members.find(m => m.key === memberKey)
      return () => agent(
        [
          `You are ${memberKey}. ${items.length} of your audit findings were challenged by Stage-2 critics.`,
          `For each, respond: withdraw (you were wrong), modify (partially right), or defend (you stand by it).`,
          `Be honest — withdrawing a finding you can't defend is better than defending it poorly.`,
          ``,
          `Challenged findings:`,
          JSON.stringify(items, null, 2),
        ].join('\n'),
        {
          agentType: (memberInfo && memberInfo.agentType) || undefined,
          label: `rebuttal:${memberKey}`,
          phase: 'Rebuttal',
          schema: REBUTTAL_SCHEMA,
        }
      )
    })
  )

  // Attach rebuttals and update status.
  for (const result of rebuttalResults) {
    if (!result || !result.responses) continue
    for (const r of result.responses) {
      const finding = allFindings.find(f => f.id === r.findingId)
      if (!finding) continue
      finding.rebuttal = { response: r.response, comment: r.comment }
      if (r.response === 'withdraw') finding.status = 'withdrawn'
      else if (r.response === 'modify') finding.status = 'modified'
      else finding.status = 'rebutted'
    }
  }

  const withdrawn = allFindings.filter(f => f.status === 'withdrawn').length
  log(`Stage 3 complete: ${withdrawn} withdrawn, ${challengedCount - withdrawn} defended/modified`)
}

// --- Stage 4: Synthesize ---

phase('Synthesize')

const survivingFindings = allFindings.filter(f => f.status !== 'withdrawn')
log(`Synthesizing ${survivingFindings.length} findings (${allFindings.length - survivingFindings.length} withdrawn)`)

const report = await agent(
  [
    `You are the audit synthesizer. Produce a deliberation report from these findings.`,
    ``,
    `Each finding has: id, cabinet-member, severity, title, description, status,`,
    `optional annotations (Stage-2 critic responses), and optional rebuttal.`,
    ``,
    `Your job:`,
    `1. Preserve all finding fields exactly as given.`,
    `2. Rank findings: contested-critical first, then confirmed-critical,`,
    `   contested-warn, confirmed-warn, etc.`,
    `3. Write a 2-3 sentence summary of the overall audit outcome.`,
    `4. Report how many findings were dropped (withdrawn).`,
    ``,
    `Return the findings array with all fields preserved, plus droppedCount and summary.`,
    ``,
    `Findings:`,
    JSON.stringify(survivingFindings, null, 2),
  ].join('\n'),
  {
    label: 'synthesizer',
    phase: 'Synthesize',
    schema: REPORT_SCHEMA,
  }
)

if (report) {
  report.droppedCount = allFindings.length - survivingFindings.length
}

return report || { findings: survivingFindings, droppedCount: allFindings.length - survivingFindings.length, summary: 'Synthesis agent returned no result.' }
