# Verification Rules

Define how to verify work-tracker items against the actual codebase.

**Default (absent/empty):** Skip codebase verification. Analysis
relies on pib-db state only (timestamps, counts, text).

## When to use

Enable codebase verification when you want the analysis agent to
check whether planned work was actually built. This catches items
that were implemented but never marked complete.

## Example

```markdown
# For each completion candidate, check if the described feature exists
verify_completion:
  - Check git log for commits mentioning the action fid
  - Check if files in the action's surface area exist
  - If evidence found, recommend "close" with verification note
```
