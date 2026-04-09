# Work Tracking — Claude Cabinet

How this project tracks planned work. Skills that manage work items
(/plan, /execute, /orient, /debrief) reference this file.

## Work Item Storage

SQLite database at `./pib.db`. Schema defined in `scripts/pib-db-schema.sql`.
Initialize with `node scripts/pib-db.mjs init`.

Tables:
- `projects` — bounded deliverables (fid, name, area, status, deleted_at)
- `actions` — tasks within projects (fid, text, project_fid, status, due, flagged, completed, notes, deleted_at)
- `audit_runs` — audit execution records
- `audit_findings` — findings from audit runs

## Query Interface

CLI: `node scripts/pib-db.mjs <command>`

**Convenience commands:**
- `list-projects` — active projects
- `list-actions` — open actions (supports `--status X`, `--project X`)
- `triage-history` — suppression list as JSON

**Direct SQL:**
- `node scripts/pib-db.mjs query "SELECT fid, text, status FROM actions WHERE completed = 0 AND deleted_at IS NULL ORDER BY project_fid, sort_order"`
- `node scripts/pib-db.mjs query "SELECT fid, name, status FROM projects WHERE deleted_at IS NULL"`
- `node scripts/pib-db.mjs query "SELECT fid, text, due FROM actions WHERE flagged = 1 AND completed = 0 AND deleted_at IS NULL"`

## Mutation Interface

**Convenience commands:**
- `create-project "name" [--area X]`
- `create-action "text" [--area X] [--project prj:xxx]`
- `update-action <fid> [--status X] [--text X] [--tags X] [--notes X]`
- `complete-action <fid>`

**Audit-specific:**
- `ingest-findings <run-dir>` — ingest findings from an audit run directory
- `triage <finding-id> <status>` — triage a finding (approved/rejected/deferred/fixed)

**Direct SQL:** `node scripts/pib-db.mjs query "UPDATE ..."`
