# Present — How and Where to Present the Plan

Define how to present the plan for user approval. The /plan skill reads
this file when presenting the finished plan.

When this file is absent or empty, the default behavior is: present the
full plan inline in conversation with cabinet critique summary,
design decisions, and uncertainties. Wait for explicit approval.

User approval is always required regardless of this file's content —
this phase customizes HOW the plan is presented, not WHETHER. Using
`skip: true` here skips the custom presentation but the skeleton still
presents the plan and waits for approval.

## What to Include

- **Presentation format** — how to structure the presentation
- **Required elements** — anything beyond the plan itself (cost, risk,
  effort estimates, stakeholder impact)
- **Medium** — where the plan is presented (conversation, document,
  review tool, external system)
- **Approval workflow** — who approves, how approval is captured

## Example Presentation Configurations

Uncomment and adapt these for your project:

<!--
### Standard Presentation
Present inline in conversation with:
1. The complete plan (all template sections)
2. Cabinet critique summary (concerns and verdicts)
3. Design decisions and alternatives considered
4. Open questions or uncertainties
5. Estimated effort (S/M/L)

Ask: "Does this plan look right? Anything to change before I file it?"

### Document-Based Presentation
For larger plans, write to a plan document:
```bash
# Write plan to a review file
Write plan to docs/plans/YYYY-MM-DD-plan-title.md
```
Then present a summary in conversation with a link to the full document.

### Review Tool Integration
Post the plan to the project's review system:
```bash
# Example: post to a review channel or tool
curl -X POST https://review-tool.example.com/api/plans \
  -H "Content-Type: application/json" \
  -d '{"title": "...", "body": "...", "author": "claude"}'
```
Present the link in conversation and wait for approval.

### Multi-Stakeholder Plans
For plans that affect multiple areas, present to each stakeholder
and collect approval. Note who approved and any conditions.
-->
