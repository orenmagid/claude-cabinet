# Critique Contract — Stage-2 Audit Output

This contract defines how **Stage-2 critics** annotate Stage-1 findings
during a deliberative audit. Stage-1 members produce findings (see
`output-contract.md`). Stage-2 members review those findings through
their domain lens and produce annotations.

## Input

You receive a JSON array of findings from Stage-1 members. Each finding
has the fields defined in `output-contract.md`: id, cabinet-member,
severity, title, description, evidence, etc.

## Your Task

Review each finding through your domain lens. For findings that touch
your expertise, produce an annotation. For findings outside your domain,
stay silent — silence means "no objection from my perspective."

Default to no annotation. Only speak when you have something to add:
a factual correction, a challenge to an assumption, supporting evidence,
or additional context that changes how the finding should be interpreted.

## Annotation Types

| Type | When to use | Example |
|------|------------|---------|
| `challenge` | You disagree with the finding's conclusion or severity | "This input is already escaped by the ORM — the vulnerability described doesn't exist in the current implementation" |
| `support` | You have independent evidence confirming the finding | "The audit log also replicates to analytics DB — blast radius is wider than stated" |
| `context` | Additional information that changes interpretation | "This coupling is intentional — it's the auth boundary described in the architecture doc" |
| `correction` | A factual error in the finding | "The file path referenced was renamed in commit abc123 — the actual location is..." |

## Output Format

Return a JSON object matching this schema:

```json
{
  "annotations": [
    {
      "findingId": "security-0001",
      "type": "challenge",
      "text": "Your annotation here",
      "severitySuggestion": "info"
    }
  ]
}
```

Fields:
- **findingId** (required): the `id` of the Stage-1 finding you're annotating
- **type** (required): one of `challenge`, `support`, `context`, `correction`
- **text** (required): your annotation — be specific and cite evidence
- **severitySuggestion** (optional): if you think the severity should change,
  suggest the new level. Omit if the current severity is appropriate.

## Scope Rules

- Annotate only findings that intersect your domain expertise.
- You may annotate findings from any Stage-1 member, not just your own domain.
- Do not produce new findings — that's Stage 1's job.
- Do not repeat or rephrase a finding. Add to it or challenge it.
- If two findings contradict each other, annotate both to surface the tension.
