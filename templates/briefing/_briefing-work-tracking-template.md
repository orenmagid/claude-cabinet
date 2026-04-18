# Work Tracking — [Your Project Name]

How this project tracks planned work. Skills that manage work items
(/plan, /execute, /orient, /debrief) reference this file.

## Work Item Storage
*Where work items live.*
*Example: SQLite `tasks` table, or `backlog.md`, or GitHub Issues*

## Query Interface
*How to search open items.*
*Example: `sqlite3 project.db "SELECT * FROM tasks WHERE status != 'done'"`*
*Example: `gh issue list --state open --json number,title`*

## Mutation Interface
*How to create, update, and close items.*
*Example: `POST /api/tasks` with JSON body*
*Example: `gh issue create --title "..." --body "..."`*

## Deferring work

*When to defer plainly vs. attach a trigger condition.*

Plain deferral (`status='deferred'` on actions, `status='someday'`
on projects) is for work that's blocked by something else you're
already tracking. It sits quietly until you unblock it yourself.

**Trigger-gated deferral** is for work waiting on an identifiable
external condition — a dependency landing, a stack decision
finalizing, a referenced file appearing. Every session, orient
re-evaluates each trigger against the current session's context
and surfaces items whose conditions have fired. Use
`pib_defer_with_trigger` (or `defer-with-trigger` CLI). See
`cabinet/pib-db-triggers.md` for the full convention.

Rule of thumb: if you can write one sentence describing what would
have to be true for this item to matter again, that sentence is
the trigger.
