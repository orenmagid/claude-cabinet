#!/usr/bin/env node
// Process-in-a-Box reference data layer
//
// Local SQLite database for work tracking and audit findings.
// This is the default persistence layer — projects that outgrow it
// override via phase files (pointing to their own API, DB, or service).
//
// Usage:
//   node scripts/pib-db.js init                        # Create/migrate DB
//   node scripts/pib-db.js query "SELECT * FROM ..."   # Run a query
//   node scripts/pib-db.js create-action "Do the thing" --area dev
//   node scripts/pib-db.js list-actions [--status X]   # Open actions (or filtered)
//   node scripts/pib-db.js update-action act:abc --status in-progress
//   node scripts/pib-db.js complete-action act:abc123
//   node scripts/pib-db.js create-project "My Project" --area dev
//   node scripts/pib-db.js list-projects               # Active projects
//   node scripts/pib-db.js ingest-findings <run-dir>   # Ingest audit findings
//   node scripts/pib-db.js triage <finding-id> <status> [notes]
//   node scripts/pib-db.js triage-history              # Suppression list JSON
//
// Environment:
//   PIB_DB_PATH  — path to SQLite file (default: ./pib.db)

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.PIB_DB_PATH || join(process.cwd(), 'pib.db');

// ---------------------------------------------------------------------------
// SQLite setup — try better-sqlite3, fall back to node:sqlite if available
// ---------------------------------------------------------------------------
let db;

function getDb() {
  if (db) return db;
  try {
    const require = createRequire(import.meta.url);
    const Database = require('better-sqlite3');
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    return db;
  } catch {
    console.error('Error: better-sqlite3 not found. Install it:');
    console.error('  npm install better-sqlite3');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Init — create tables from schema
// ---------------------------------------------------------------------------
function init() {
  const d = getDb();
  const schemaPath = join(__dirname, 'pib-db-schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  d.exec(schema);

  // Migrate existing DBs — add columns that may not exist yet
  const migrations = [
    { table: 'actions', column: 'status', sql: "ALTER TABLE actions ADD COLUMN status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in-progress','blocked','deferred','done'))" },
    { table: 'actions', column: 'tags', sql: "ALTER TABLE actions ADD COLUMN tags TEXT NOT NULL DEFAULT ''" },
  ];
  for (const m of migrations) {
    const cols = d.prepare(`PRAGMA table_info(${m.table})`).all();
    if (!cols.some(c => c.name === m.column)) {
      try { d.exec(m.sql); } catch { /* column may already exist */ }
    }
  }

  console.log(`Database initialized at ${DB_PATH}`);
}

// ---------------------------------------------------------------------------
// Query — run arbitrary SQL
// ---------------------------------------------------------------------------
function query(sql) {
  const d = getDb();
  if (sql.trim().toUpperCase().startsWith('SELECT')) {
    const rows = d.prepare(sql).all();
    console.log(JSON.stringify(rows, null, 2));
  } else {
    const result = d.exec(sql);
    console.log('Done.');
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
function generateFid(prefix) {
  return `${prefix}:${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function createAction(text, { area, projectFid, due, notes } = {}) {
  const d = getDb();
  const fid = generateFid('act');
  d.prepare(`
    INSERT INTO actions (fid, text, area, project_fid, due, notes, created)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(fid, text, area || null, projectFid || null, due || null, notes || '', today());
  console.log(`Created action ${fid}: ${text}`);
  return fid;
}

function listActions({ status, project } = {}) {
  const d = getDb();
  const conditions = ['a.deleted_at IS NULL'];
  const params = [];

  if (status) {
    conditions.push('a.status = ?');
    params.push(status);
  } else {
    conditions.push('a.completed = 0');
  }
  if (project) {
    conditions.push('a.project_fid = ?');
    params.push(project);
  }

  const rows = d.prepare(`
    SELECT a.fid, a.text, a.area, a.due, a.flagged, a.status, a.tags, p.name as project
    FROM actions a
    LEFT JOIN projects p ON a.project_fid = p.fid
    WHERE ${conditions.join(' AND ')}
    ORDER BY
      CASE WHEN a.due IS NOT NULL AND a.due <= date('now') THEN 0 ELSE 1 END,
      a.due,
      a.flagged DESC,
      a.created DESC
  `).all(...params);
  console.log(JSON.stringify(rows, null, 2));
  return rows;
}

function updateAction(fid, { status, text, tags, notes, due, flagged } = {}) {
  const d = getDb();
  const sets = [];
  const params = [];

  if (status !== undefined) { sets.push('status = ?'); params.push(status); }
  if (text !== undefined) { sets.push('text = ?'); params.push(text); }
  if (tags !== undefined) { sets.push('tags = ?'); params.push(tags); }
  if (notes !== undefined) { sets.push('notes = ?'); params.push(notes); }
  if (due !== undefined) { sets.push('due = ?'); params.push(due); }
  if (flagged !== undefined) { sets.push('flagged = ?'); params.push(flagged === 'true' || flagged === '1' ? 1 : 0); }

  // If marking done, also set completed fields
  if (status === 'done') {
    sets.push('completed = 1', 'completed_at = ?');
    params.push(new Date().toISOString());
  }

  if (sets.length === 0) {
    console.error('No fields to update. Use --status, --text, --tags, --notes, --due, or --flagged');
    process.exit(1);
  }

  params.push(fid);
  d.prepare(`UPDATE actions SET ${sets.join(', ')} WHERE fid = ?`).run(...params);
  console.log(`Updated ${fid}`);
}

function completeAction(fid) {
  const d = getDb();
  d.prepare(`
    UPDATE actions SET completed = 1, completed_at = ?, status = 'done' WHERE fid = ?
  `).run(new Date().toISOString(), fid);
  console.log(`Completed ${fid}`);
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
function createProject(name, { area, notes, due } = {}) {
  const d = getDb();
  const fid = generateFid('prj');
  d.prepare(`
    INSERT INTO projects (fid, name, area, notes, due, created)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(fid, name, area || null, notes || '', due || null, today());
  console.log(`Created project ${fid}: ${name}`);
  return fid;
}

function listProjects() {
  const d = getDb();
  const rows = d.prepare(`
    SELECT p.fid, p.name, p.area, p.status, p.due,
      (SELECT COUNT(*) FROM actions a WHERE a.project_fid = p.fid AND a.completed = 0 AND a.deleted_at IS NULL) as open_actions
    FROM projects p
    WHERE p.status = 'active' AND p.deleted_at IS NULL
    ORDER BY p.created DESC
  `).all();
  console.log(JSON.stringify(rows, null, 2));
  return rows;
}

// ---------------------------------------------------------------------------
// Audit — ingest findings from a run directory
// ---------------------------------------------------------------------------
function ingestFindings(runDir) {
  const d = getDb();
  const summaryPath = join(runDir, 'run-summary.json');
  if (!existsSync(summaryPath)) {
    console.error(`No run-summary.json found in ${runDir}`);
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(summaryPath, 'utf-8'));
  const runId = data.meta?.runId || `run-${Date.now()}`;
  const timestamp = data.meta?.timestamp || new Date().toISOString();
  const dateStr = timestamp.slice(0, 10);

  d.prepare(`
    INSERT OR REPLACE INTO audit_runs (id, date, timestamp, trigger, finding_count)
    VALUES (?, ?, ?, ?, ?)
  `).run(runId, dateStr, timestamp, data.meta?.trigger || 'manual', data.findings?.length || 0);

  const insert = d.prepare(`
    INSERT OR REPLACE INTO audit_findings
      (id, run_id, cabinet_member, severity, title, description, assumption,
       evidence, question, file, line, suggested_fix, auto_fixable, type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const f of (data.findings || [])) {
    insert.run(
      f.id, runId, f['cabinet-member'], f.severity, f.title,
      f.description || null, f.assumption || null, f.evidence || null,
      f.question || null, f.file || null, f.line || null,
      f.suggestedFix || null, f.autoFixable ? 1 : 0, f.type || 'finding'
    );
    count++;
  }
  console.log(`Ingested ${count} findings from ${runDir} (run: ${runId})`);
}

// ---------------------------------------------------------------------------
// Triage
// ---------------------------------------------------------------------------
function triageFinding(findingId, status, notes) {
  const d = getDb();
  d.prepare(`
    UPDATE audit_findings
    SET triage_status = ?, triage_notes = ?, triaged_at = ?
    WHERE id = ?
  `).run(status, notes || null, new Date().toISOString(), findingId);
  console.log(`Triaged ${findingId} → ${status}`);
}

function triageHistory() {
  const d = getDb();

  const rejected = d.prepare(`
    SELECT id, cabinet_member, title FROM audit_findings
    WHERE triage_status = 'rejected'
  `).all();

  const deferred = d.prepare(`
    SELECT id, cabinet_member, title FROM audit_findings
    WHERE triage_status = 'deferred'
  `).all();

  const result = {
    rejectedIds: rejected.map(r => r.id),
    rejectedFingerprints: rejected.map(r => ({ 'cabinet-member': r.cabinet_member, title: r.title })),
    deferredIds: deferred.map(r => r.id),
    deferredFingerprints: deferred.map(r => ({ 'cabinet-member': r.cabinet_member, title: r.title })),
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const [,, command, ...args] = process.argv;

function parseFlags(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      flags[key] = args[i + 1] || true;
      i++;
    } else {
      positional.push(args[i]);
    }
  }
  return { flags, positional };
}

switch (command) {
  case 'init':
    init();
    break;
  case 'query':
    query(args.join(' '));
    break;
  case 'create-action': {
    const { flags, positional } = parseFlags(args);
    createAction(positional[0], flags);
    break;
  }
  case 'list-actions': {
    const { flags } = parseFlags(args);
    listActions(flags);
    break;
  }
  case 'update-action': {
    const { flags, positional } = parseFlags(args);
    updateAction(positional[0], flags);
    break;
  }
  case 'complete-action':
    completeAction(args[0]);
    break;
  case 'create-project': {
    const { flags, positional } = parseFlags(args);
    createProject(positional[0], flags);
    break;
  }
  case 'list-projects':
    listProjects();
    break;
  case 'ingest-findings':
    ingestFindings(args[0]);
    break;
  case 'triage':
    triageFinding(args[0], args[1], args.slice(2).join(' ') || undefined);
    break;
  case 'triage-history':
    triageHistory();
    break;
  default:
    console.log(`Usage: pib-db.js <command>

Commands:
  init                              Create/migrate the database
  query "SQL"                       Run a SQL query
  create-action "text" [--area X]   Create an action
  list-actions [--status X] [--project X]  List actions (default: open)
  update-action <fid> [--status X] [--text X] [--tags X] [--notes X]
  complete-action <fid>             Mark action complete (status=done)
  create-project "name" [--area X]  Create a project
  list-projects                     List active projects
  ingest-findings <run-dir>         Ingest audit findings from a run directory
  triage <finding-id> <status>      Triage a finding (approved/rejected/deferred/fixed)
  triage-history                    Output suppression list as JSON

Environment:
  PIB_DB_PATH   Path to SQLite file (default: ./pib.db)`);
    if (command) process.exit(1);
}
