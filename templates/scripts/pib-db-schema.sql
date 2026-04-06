-- Process-in-a-Box reference data layer
-- Local SQLite database for work tracking and audit findings.
-- This is the default persistence layer. Projects that outgrow it
-- override via phase files (pointing to their own API, DB, or service).
--
-- Initialize: node scripts/pib-db.js init
-- Query:      node scripts/pib-db.js query "SELECT ..."

CREATE TABLE IF NOT EXISTS projects (
  fid           TEXT PRIMARY KEY CHECK(fid GLOB 'prj:*'),
  name          TEXT NOT NULL,
  area          TEXT,
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK(status IN ('active','paused','done','dropped','someday')),
  notes         TEXT NOT NULL DEFAULT '',
  created       TEXT NOT NULL CHECK(created GLOB '????-??-??'),
  completed_at  TEXT,
  due           TEXT,
  deleted_at    TEXT
);

CREATE TABLE IF NOT EXISTS actions (
  fid           TEXT PRIMARY KEY CHECK(fid GLOB 'act:*'),
  text          TEXT NOT NULL,
  area          TEXT,
  project_fid   TEXT REFERENCES projects(fid) ON DELETE SET NULL,
  due           TEXT,
  flagged       INTEGER NOT NULL DEFAULT 0 CHECK(flagged IN (0, 1)),
  completed     INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
  completed_at  TEXT,
  status        TEXT NOT NULL DEFAULT 'open'
                  CHECK(status IN ('open','in-progress','blocked','deferred','done')),
  tags          TEXT NOT NULL DEFAULT '',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created       TEXT NOT NULL CHECK(created GLOB '????-??-??'),
  notes         TEXT NOT NULL DEFAULT '',
  deleted_at    TEXT
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
