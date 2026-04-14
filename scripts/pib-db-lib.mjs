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
// Init — create tables from schema
// ---------------------------------------------------------------------------
export function init(db, { schemaPath }) {
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  // Migrate existing DBs — add columns that may not exist yet
  const migrations = [
    { table: 'actions', column: 'status', sql: "ALTER TABLE actions ADD COLUMN status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in-progress','blocked','deferred','done'))" },
    { table: 'actions', column: 'tags', sql: "ALTER TABLE actions ADD COLUMN tags TEXT NOT NULL DEFAULT ''" },
  ];
  for (const m of migrations) {
    const cols = db.prepare(`PRAGMA table_info(${m.table})`).all();
    if (!cols.some(c => c.name === m.column)) {
      try { db.exec(m.sql); } catch { /* column may already exist */ }
    }
  }

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
