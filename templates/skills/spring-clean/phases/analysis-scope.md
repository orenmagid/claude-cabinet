# Analysis Scope

Define project-specific heuristics for the inventory & analysis step.

**Default (absent/empty):** Use standard heuristics:
- Stale: 14+ days since last completion with open actions
- Mega-project: 10+ open actions
- Duplicate: >70% text overlap between actions in the same project
- Completion candidate: active project with 0 open actions

## Customization examples

```markdown
# Exclude someday projects from staleness detection
exclude_from_stale: status = 'someday'

# Lower the mega-project threshold for this team
mega_project_threshold: 7

# These projects are intentionally long-running — don't flag as stale
always_skip:
  - prj:abc12345  # ongoing maintenance
  - prj:def67890  # quarterly review
```
