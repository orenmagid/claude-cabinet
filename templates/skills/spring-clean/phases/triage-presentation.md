# Triage Presentation

Define how to present spring-clean recommendations to the user.

**Default (absent/empty):** Inline conversation. Recommendations are
presented in decision-cost order directly in the chat. Each batch
shows the items, proposed mutations, and asks for approve/defer/reject.

## Alternative: Review UI

For large backlogs (20+ recommendations), the review UI may be less
fatiguing than inline conversation:

```markdown
presentation: review-ui
port: 3459
verdict_labels:
  approve: "Apply"
  defer: "Later"
  reject: "Dismiss"
```

The skill starts `node scripts/review-server.mjs`, posts recommendations
as review items, and processes verdicts after the user submits.
