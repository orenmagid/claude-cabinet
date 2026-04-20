-- Process-in-a-Box reference data layer
-- Local SQLite database for work tracking and audit findings.
-- This is the default persistence layer. Projects that outgrow it
-- override via phase files (pointing to their own API, DB, or service).
--
-- Initialize: node scripts/pib-db.mjs init
-- Query:      node scripts/pib-db.mjs query "SELECT ..."

CREATE TABLE IF NOT EXISTS projects (
  fid                TEXT PRIMARY KEY CHECK(fid GLOB 'prj:*'),
  name               TEXT NOT NULL,
  area               TEXT,
  status             TEXT NOT NULL DEFAULT 'active'
                       CHECK(status IN ('active','paused','done','dropped','someday')),
  notes              TEXT NOT NULL DEFAULT '',
  created            TEXT NOT NULL CHECK(created GLOB '????-??-??'),
  completed_at       TEXT,
  due                TEXT,
  deleted_at         TEXT,
  trigger_condition  TEXT
);

CREATE TABLE IF NOT EXISTS actions (
  fid                TEXT PRIMARY KEY CHECK(fid GLOB 'act:*'),
  text               TEXT NOT NULL,
  area               TEXT,
  project_fid        TEXT REFERENCES projects(fid) ON DELETE SET NULL,
  due                TEXT,
  flagged            INTEGER NOT NULL DEFAULT 0 CHECK(flagged IN (0, 1)),
  completed          INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
  completed_at       TEXT,
  status             TEXT NOT NULL DEFAULT 'open'
                       CHECK(status IN ('open','in-progress','blocked','deferred','done')),
  tags               TEXT NOT NULL DEFAULT '',
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created            TEXT NOT NULL CHECK(created GLOB '????-??-??'),
  notes              TEXT NOT NULL DEFAULT '',
  deleted_at         TEXT,
  trigger_condition  TEXT
);

CREATE TABLE IF NOT EXISTS audit_runs (
  id            TEXT PRIMARY KEY,
  date          TEXT NOT NULL,
  timestamp     TEXT NOT NULL,
  trigger       TEXT NOT NULL,
  finding_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_findings (
  id                  TEXT PRIMARY KEY,
  run_id              TEXT NOT NULL REFERENCES audit_runs(id),
  cabinet_member      TEXT NOT NULL,  -- renamed from 'perspective' in v0.7; migration: ALTER TABLE audit_findings RENAME COLUMN perspective TO cabinet_member
  severity            TEXT NOT NULL CHECK(severity IN ('critical','warn','info','idea')),
  title               TEXT NOT NULL,
  description         TEXT,
  assumption          TEXT,
  evidence            TEXT,
  question            TEXT,
  file                TEXT,
  line                INTEGER,
  suggested_fix       TEXT,
  auto_fixable        INTEGER DEFAULT 0,
  type                TEXT DEFAULT 'finding' CHECK(type IN ('finding','positive')),
  triage_status       TEXT DEFAULT 'open'
                        CHECK(triage_status IN ('open','approved','rejected','deferred','fixed','archived')),
  triage_notes        TEXT,
  triaged_at          TEXT,
  fix_description     TEXT
);

-- Append-only history of trigger-condition evaluations.
-- No foreign key to actions/projects: if the target row is later deleted,
-- we want the historical record preserved (orphan rows are acceptable).
CREATE TABLE IF NOT EXISTS trigger_checks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  target_table  TEXT NOT NULL CHECK(target_table IN ('actions','projects')),
  target_fid    TEXT NOT NULL,
  checked_at    TEXT NOT NULL,
  result        TEXT NOT NULL CHECK(result IN ('triggered','still-waiting','needs-info','condition-obsolete')),
  notes         TEXT
);
CREATE INDEX IF NOT EXISTS idx_trigger_checks_fid ON trigger_checks(target_fid);
