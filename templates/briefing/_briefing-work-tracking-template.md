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
