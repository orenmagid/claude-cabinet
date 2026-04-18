# pib-db Access Protocol

How to interact with the process infrastructure database (pib-db).

## Preference Order

1. **MCP tools (preferred):** If `pib_*` MCP tools are available (check
   by attempting to use them), use them directly. They return structured
   JSON — no parsing needed.

2. **CLI fallback:** If MCP tools are not available, use the CLI:
   ```bash
   node scripts/pib-db.mjs <command> [args]
   ```

Skills should reference this document instead of embedding their own
fallback logic. The access method is determined once at the start of the
skill execution:

```
Check: are pib_* MCP tools available?
  YES → use pib_list_projects, pib_create_action, etc.
  NO  → use node scripts/pib-db.mjs list-projects, etc.
```

## Available Operations

| MCP Tool                   | CLI Equivalent                                  | Description                    |
| -------------------------- | ----------------------------------------------- | ------------------------------ |
| pib_create_project         | create-project "name" --area X                  | Create a project               |
| pib_list_projects          | list-projects                                   | List active projects           |
| pib_create_action          | create-action "text" --notes X                  | Create an action (work item)   |
| pib_list_actions           | list-actions [--status X]                       | List actions                   |
| pib_update_action          | update-action fid --status X                    | Update action fields           |
| pib_complete_action        | complete-action fid                             | Mark action done               |
| pib_defer_with_trigger     | defer-with-trigger fid --trigger "<text>"       | Defer with a return condition  |
| pib_list_triggered         | list-triggered [--include-done]                 | List items waiting on triggers |
| pib_mark_trigger_checked   | mark-trigger-checked fid --result <value>       | Record a trigger evaluation    |
| pib_ingest_findings        | ingest-findings run-dir                         | Ingest audit findings          |
| pib_triage                 | triage finding-id status [notes]                | Triage a finding               |
| pib_triage_history         | triage-history                                  | Get suppression list           |
| pib_query                  | query "SQL"                                     | Run arbitrary SQL              |

## Deferred triggers

When deferring an item that waits on a specific identifiable
condition — a dependency landing, a stack decision finalizing, a
referenced file appearing — use `pib_defer_with_trigger` instead of
plain `status='deferred'`. Orient re-evaluates each trigger every
session and surfaces items whose conditions have become true. See
[pib-db-triggers.md](pib-db-triggers.md) for the full convention:
result vocabulary, cascade semantics for projects, migration
guarantees, and known limitations.

## Surface Area Validation

`pib_create_action` (and the CLI `create-action`) require that notes
contain a `## Surface Area` section with at least one `- files:` or
`- dirs:` line. This ensures every action clearly defines what it
touches.

Example notes format:
```
Implement the new feature.

## Surface Area
- files: src/components/Widget.js
- files: src/utils/helpers.js
- dirs: tests/components/
```
