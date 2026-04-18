// Process-in-a-Box shared library
//
// All database operations as importable functions.
// Both the CLI (pib-db.mjs) and MCP server (pib-db-mcp-server.mjs)
// import from here. Schema changes update one place.
//
// Every function takes (db, params) and returns a result object.
// None of them do console.log — callers decide how to present output.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateFid(prefix) {
  return `${prefix}:${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Migrations — gated by PRAGMA user_version
// ---------------------------------------------------------------------------
// SCHEMA_VERSION history:
//   1 — added actions.status CHECK constraint
//   2 — added actions.tags
//   3 — added trigger_condition on actions/projects + trigger_checks history
export const SCHEMA_VERSION = 3;

// Each entry: { version, sql }. A single version may have multiple SQL
// statements (e.g. column add + index). Statements run in array order;
// each is wrapped in try/catch so re-running on a DB that already has
// the column/table is a no-op. The user_version pragma is the primary
// gate — try/catch is a safety net for pre-pragma DBs.
const MIGRATIONS = [
  { version: 1, sql: "ALTER TABLE actions ADD COLUMN status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in-progress','blocked','deferred','done'))" },
  { version: 2, sql: "ALTER TABLE actions ADD COLUMN tags TEXT NOT NULL DEFAULT ''" },
  { version: 3, sql: "ALTER TABLE actions ADD COLUMN trigger_condition TEXT" },
  { version: 3, sql: "ALTER TABLE projects ADD COLUMN trigger_condition TEXT" },
  { version: 3, sql: `CREATE TABLE IF NOT EXISTS trigger_checks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    target_table  TEXT NOT NULL CHECK(target_table IN ('actions','projects')),
    target_fid    TEXT NOT NULL,
    checked_at    TEXT NOT NULL,
    result        TEXT NOT NULL CHECK(result IN ('triggered','still-waiting','needs-info','condition-obsolete')),
    notes         TEXT
  )` },
  { version: 3, sql: "CREATE INDEX IF NOT EXISTS idx_trigger_checks_fid ON trigger_checks(target_fid)" },
];

export function migrate(db) {
  const current = db.pragma('user_version', { simple: true });
  if (current >= SCHEMA_VERSION) return { from: current, to: current, applied: 0 };

  // Wrap in a transaction so a real mid-migration failure (disk full,
  // locked DB, constraint violation) rolls back user_version along with
  // the partial DDL. Only swallow "already exists" errors from legacy
  // pre-pragma DBs where columns may have been added before versioning.
  const tx = db.transaction(() => {
    let applied = 0;
    for (const m of MIGRATIONS) {
      if (m.version <= current) continue;
      try { db.exec(m.sql); applied++; }
      catch (e) {
        if (!/already exists|duplicate column/i.test(e.message || '')) throw e;
      }
    }
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
    return applied;
  });
  const applied = tx();
  return { from: current, to: SCHEMA_VERSION, applied };
}

// ---------------------------------------------------------------------------
// Init — create tables from schema, then migrate
// ---------------------------------------------------------------------------
export function init(db, { schemaPath }) {
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  migrate(db);
  return { message: `Database initialized` };
}

// ---------------------------------------------------------------------------
// Query — run arbitrary SQL
// ---------------------------------------------------------------------------
export function query(db, { sql }) {
  if (sql.trim().toUpperCase().startsWith('SELECT')) {
    const rows = db.prepare(sql).all();
    return { rows };
  } else {
    db.exec(sql);
    return { message: 'Done.' };
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Validate that notes contain a ## Surface Area section with at least one
 * - files: or - dirs: line. Returns null if valid, or an error object if not.
 */
function validateSurfaceArea(notes) {
  if (!notes) {
    return {
      error: 'missing_surface_area',
      message: 'Action notes must contain a ## Surface Area section.',
      suggestedFormat: [
        '## Surface Area',
        '- files: path/to/file.js',
        '- files: path/to/other.js',
        '- dirs: src/components/',
      ].join('\n'),
    };
  }

  const hasSection = /^## Surface Area/m.test(notes);
  if (!hasSection) {
    return {
      error: 'missing_surface_area',
      message: 'Action notes must contain a ## Surface Area section.',
      suggestedFormat: [
        '## Surface Area',
        '- files: path/to/file.js',
        '- files: path/to/other.js',
        '- dirs: src/components/',
      ].join('\n'),
    };
  }

  // Extract everything after ## Surface Area until the next ## or end
  const sectionMatch = notes.match(/^## Surface Area\s*\n([\s\S]*?)(?=\n## |\n*$)/m);
  const sectionBody = sectionMatch ? sectionMatch[1] : '';
  const hasEntry = /^- (?:files|dirs):/m.test(sectionBody);
  if (!hasEntry) {
    return {
      error: 'empty_surface_area',
      message: '## Surface Area section must contain at least one "- files:" or "- dirs:" line.',
      suggestedFormat: [
        '## Surface Area',
        '- files: path/to/file.js',
        '- dirs: src/components/',
      ].join('\n'),
    };
  }

  return null; // valid
}

export function createAction(db, { text, area, projectFid, due, notes }) {
  const validationError = validateSurfaceArea(notes);
  if (validationError) {
    return { error: validationError };
  }

  const fid = generateFid('act');
  db.prepare(`
    INSERT INTO actions (fid, text, area, project_fid, due, notes, created)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(fid, text, area || null, projectFid || null, due || null, notes || '', today());
  return { fid, text, message: `Created action ${fid}: ${text}` };
}

export function listActions(db, { status, project } = {}) {
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

  const rows = db.prepare(`
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
  return { rows };
}

export function updateAction(db, { fid, status, text, tags, notes, due, flagged }) {
  const sets = [];
  const params = [];

  if (status !== undefined) { sets.push('status = ?'); params.push(status); }
  if (text !== undefined) { sets.push('text = ?'); params.push(text); }
  if (tags !== undefined) { sets.push('tags = ?'); params.push(tags); }
  if (notes !== undefined) { sets.push('notes = ?'); params.push(notes); }
  if (due !== undefined) { sets.push('due = ?'); params.push(due); }
  if (flagged !== undefined) { sets.push('flagged = ?'); params.push(flagged === 'true' || flagged === '1' || flagged === true ? 1 : 0); }

  // If marking done, also set completed fields
  if (status === 'done') {
    sets.push('completed = 1', 'completed_at = ?');
    params.push(new Date().toISOString());
  }

  if (sets.length === 0) {
    return { error: { message: 'No fields to update. Use status, text, tags, notes, due, or flagged.' } };
  }

  params.push(fid);
  db.prepare(`UPDATE actions SET ${sets.join(', ')} WHERE fid = ?`).run(...params);
  return { fid, message: `Updated ${fid}` };
}

export function completeAction(db, { fid }) {
  db.prepare(`
    UPDATE actions SET completed = 1, completed_at = ?, status = 'done' WHERE fid = ?
  `).run(new Date().toISOString(), fid);
  return { fid, message: `Completed ${fid}` };
}

export function getAction(db, { fid }) {
  if (!fid) return { error: 'fid is required' };
  const row = db.prepare(`
    SELECT a.*, p.name as project_name
    FROM actions a
    LEFT JOIN projects p ON a.project_fid = p.fid
    WHERE a.fid = ? AND a.deleted_at IS NULL
  `).get(fid);
  if (!row) return { error: `No action found with fid: ${fid}` };
  return row;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
export function createProject(db, { name, area, notes, due }) {
  const fid = generateFid('prj');
  db.prepare(`
    INSERT INTO projects (fid, name, area, notes, due, created)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(fid, name, area || null, notes || '', due || null, today());
  return { fid, name, message: `Created project ${fid}: ${name}` };
}

export function listProjects(db) {
  const rows = db.prepare(`
    SELECT p.fid, p.name, p.area, p.status, p.due,
      (SELECT COUNT(*) FROM actions a WHERE a.project_fid = p.fid AND a.completed = 0 AND a.deleted_at IS NULL) as open_actions
    FROM projects p
    WHERE p.status = 'active' AND p.deleted_at IS NULL
    ORDER BY p.created DESC
  `).all();
  return { rows };
}

// ---------------------------------------------------------------------------
// Audit — ingest findings from a run directory
// ---------------------------------------------------------------------------
export function ingestFindings(db, { runDir }) {
  const summaryPath = join(runDir, 'run-summary.json');
  if (!existsSync(summaryPath)) {
    return { error: { message: `No run-summary.json found in ${runDir}` } };
  }
  const data = JSON.parse(readFileSync(summaryPath, 'utf-8'));
  const runId = data.meta?.runId || `run-${Date.now()}`;
  const timestamp = data.meta?.timestamp || new Date().toISOString();
  const dateStr = timestamp.slice(0, 10);

  db.prepare(`
    INSERT OR REPLACE INTO audit_runs (id, date, timestamp, trigger, finding_count)
    VALUES (?, ?, ?, ?, ?)
  `).run(runId, dateStr, timestamp, data.meta?.trigger || 'manual', data.findings?.length || 0);

  const insert = db.prepare(`
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
  return { count, runId, message: `Ingested ${count} findings from ${runDir} (run: ${runId})` };
}

// ---------------------------------------------------------------------------
// Triage
// ---------------------------------------------------------------------------
export function triage(db, { findingId, status, notes }) {
  db.prepare(`
    UPDATE audit_findings
    SET triage_status = ?, triage_notes = ?, triaged_at = ?
    WHERE id = ?
  `).run(status, notes || null, new Date().toISOString(), findingId);
  return { findingId, status, message: `Triaged ${findingId} → ${status}` };
}

export function triageHistory(db) {
  const rejected = db.prepare(`
    SELECT id, cabinet_member, title FROM audit_findings
    WHERE triage_status = 'rejected'
  `).all();

  const deferred = db.prepare(`
    SELECT id, cabinet_member, title FROM audit_findings
    WHERE triage_status = 'deferred'
  `).all();

  return {
    rejectedIds: rejected.map(r => r.id),
    rejectedFingerprints: rejected.map(r => ({ 'cabinet-member': r.cabinet_member, title: r.title })),
    deferredIds: deferred.map(r => r.id),
    deferredFingerprints: deferred.map(r => ({ 'cabinet-member': r.cabinet_member, title: r.title })),
  };
}

// ---------------------------------------------------------------------------
// Deferred triggers
// ---------------------------------------------------------------------------
// Items (actions or projects) with a trigger_condition are waiting on a
// specific condition. The orient skill re-evaluates them each session and
// records each check in trigger_checks (append-only history).

export const TRIGGER_RESULT_VOCABULARY = ['triggered', 'still-waiting', 'needs-info', 'condition-obsolete'];
const FID_PATTERN = /^(act|prj):[a-f0-9]{8}$/;

function validateFid(fid) {
  if (!fid || typeof fid !== 'string') {
    return { error: 'missing_fid', message: 'fid is required' };
  }
  if (!FID_PATTERN.test(fid)) {
    return { error: 'invalid_fid_format', message: `fid must match ${FID_PATTERN}, got "${fid}"` };
  }
  return null;
}

function tableForFid(fid) {
  return fid.startsWith('prj:') ? 'projects' : 'actions';
}

export function deferWithTrigger(db, { fid, triggerCondition, cascade = false } = {}) {
  const fidError = validateFid(fid);
  if (fidError) return { error: fidError };
  if (!triggerCondition || typeof triggerCondition !== 'string' || triggerCondition.trim() === '') {
    return { error: { error: 'missing_trigger_condition', message: 'triggerCondition must be a non-empty string' } };
  }

  const table = tableForFid(fid);
  const row = db.prepare(`SELECT status, ${table === 'actions' ? 'completed' : "'0' as completed"} FROM ${table} WHERE fid = ? AND deleted_at IS NULL`).get(fid);
  if (!row) return { error: { error: 'not_found', message: `No ${table} row with fid ${fid}` } };
  if (row.status === 'done' || row.completed === 1) {
    return { error: { error: 'already_done', message: `${fid} is already done; cannot defer` } };
  }

  let cascaded = 0;
  if (table === 'projects') {
    // Children with their own trigger_condition already carry their own
    // return condition; cascade leaves them alone so the parent's trigger
    // doesn't overwrite their independent wait state.
    const openChildren = db.prepare(`SELECT fid FROM actions WHERE project_fid = ? AND status NOT IN ('done','deferred') AND trigger_condition IS NULL AND deleted_at IS NULL`).all(fid);
    if (openChildren.length > 0 && !cascade) {
      return {
        error: {
          error: 'has_open_children',
          message: `Project ${fid} has ${openChildren.length} open action(s) without their own trigger. Pass cascade: true to defer them alongside.`,
          openChildren: openChildren.map(c => c.fid),
        },
      };
    }
    if (cascade) {
      const appendNote = `\n\n_Deferred alongside parent ${fid} (trigger: ${triggerCondition})_`;
      const stmt = db.prepare(`UPDATE actions SET status = 'deferred', notes = notes || ? WHERE fid = ?`);
      for (const child of openChildren) stmt.run(appendNote, child.fid);
      cascaded = openChildren.length;
    }
  }

  const newStatus = table === 'projects' ? 'someday' : 'deferred';
  db.prepare(`UPDATE ${table} SET status = ?, trigger_condition = ? WHERE fid = ?`).run(newStatus, triggerCondition, fid);

  return { fid, table, triggerCondition, status: newStatus, cascaded, message: `Deferred ${fid} with trigger` };
}

export function listTriggered(db, { includeDone = false } = {}) {
  const actionsWhere = includeDone
    ? 'a.trigger_condition IS NOT NULL AND a.deleted_at IS NULL'
    : "a.trigger_condition IS NOT NULL AND a.deleted_at IS NULL AND a.status != 'done' AND (a.completed IS NULL OR a.completed = 0)";
  const projectsWhere = includeDone
    ? 'p.trigger_condition IS NOT NULL AND p.deleted_at IS NULL'
    : "p.trigger_condition IS NOT NULL AND p.deleted_at IS NULL AND p.status != 'done'";

  const actions = db.prepare(`
    SELECT a.fid, a.text, a.trigger_condition, a.status, p.name AS project_name,
      (SELECT checked_at FROM trigger_checks WHERE target_fid = a.fid ORDER BY checked_at DESC LIMIT 1) AS last_checked,
      (SELECT result FROM trigger_checks WHERE target_fid = a.fid ORDER BY checked_at DESC LIMIT 1) AS last_result
    FROM actions a
    LEFT JOIN projects p ON a.project_fid = p.fid
    WHERE ${actionsWhere}
    ORDER BY last_checked IS NOT NULL, last_checked ASC
  `).all();

  const projects = db.prepare(`
    SELECT p.fid, p.name, p.trigger_condition, p.status,
      (SELECT checked_at FROM trigger_checks WHERE target_fid = p.fid ORDER BY checked_at DESC LIMIT 1) AS last_checked,
      (SELECT result FROM trigger_checks WHERE target_fid = p.fid ORDER BY checked_at DESC LIMIT 1) AS last_result
    FROM projects p
    WHERE ${projectsWhere}
    ORDER BY last_checked IS NOT NULL, last_checked ASC
  `).all();

  return { actions, projects };
}

export function markTriggerChecked(db, { fid, result, notes } = {}) {
  const fidError = validateFid(fid);
  if (fidError) return { error: fidError };
  if (!TRIGGER_RESULT_VOCABULARY.includes(result)) {
    return {
      error: {
        error: 'invalid_result',
        message: `result must be one of: ${TRIGGER_RESULT_VOCABULARY.join(', ')}`,
        got: result,
      },
    };
  }
  const table = tableForFid(fid);
  const row = db.prepare(`SELECT fid FROM ${table} WHERE fid = ? AND deleted_at IS NULL`).get(fid);
  if (!row) return { error: { error: 'not_found', message: `No ${table} row with fid ${fid}` } };

  const checkedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO trigger_checks (target_table, target_fid, checked_at, result, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(table, fid, checkedAt, result, notes || null);

  return { fid, checkedAt, result, message: `Recorded trigger check for ${fid}: ${result}` };
}
