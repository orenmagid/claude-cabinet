# Execute Decisions

Define how to apply approved mutations to pib-db.

**Default (absent/empty):** Direct pib_* MCP calls (or CLI fallback):
- **close:** `pib_complete_action` or update project status
- **archive:** `pib_update_action` with status change to someday/dropped
- **merge:** Update surviving item's notes, delete the duplicate
- **split:** `pib_create_project`, then `pib_update_action` to reparent
- **reparent:** `pib_update_action` with new `project_fid`
- **create-project:** `pib_create_project`

## Safeguards

All mutations are logged to the conversation. No bulk deletes — each
deletion is individually approved. Project status changes (active →
dropped) require explicit confirmation even in batch mode.
