/**
 * Work tracker server — serves the work tracker UI and provides
 * read/write access to pib.db (projects and actions).
 *
 * Usage: node work-tracker-server.mjs [--port 3458] [--db path/to/pib.db]
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || process.argv.find((_, i, a) => a[i - 1] === '--port') || '3458');
const DB_PATH = resolve(process.argv.find((_, i, a) => a[i - 1] === '--db') || 'pib.db');

if (!existsSync(DB_PATH)) {
  console.error(`Database not found: ${DB_PATH}`);
  console.error('Run: node scripts/pib-db.mjs init');
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: false });
db.pragma('journal_mode = WAL');

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  return JSON.parse(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  try {
    // Serve HTML
    if (req.method === 'GET' && url.pathname === '/') {
      const html = await readFile(join(__dirname, 'work-tracker-ui.html'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(html);
    }

    // GET /api/projects — list projects with action counts
    if (req.method === 'GET' && url.pathname === '/api/projects') {
      const status = url.searchParams.get('status') || 'active';
      const rows = db.prepare(`
        SELECT p.*,
          (SELECT COUNT(*) FROM actions a WHERE a.project_fid = p.fid AND a.completed = 0 AND a.deleted_at IS NULL) as open_actions,
          (SELECT COUNT(*) FROM actions a WHERE a.project_fid = p.fid AND a.completed = 1) as done_actions,
          (SELECT COUNT(*) FROM actions a WHERE a.project_fid = p.fid AND a.deleted_at IS NULL) as total_actions
        FROM projects p
        WHERE p.deleted_at IS NULL AND p.status = ?
        ORDER BY p.created DESC
      `).all(status);
      return json(res, rows);
    }

    // GET /api/actions — list actions, optionally filtered
    if (req.method === 'GET' && url.pathname === '/api/actions') {
      const project = url.searchParams.get('project');
      const status = url.searchParams.get('status'); // open, done, all
      let query = `
        SELECT a.*, p.name as project_name
        FROM actions a
        LEFT JOIN projects p ON a.project_fid = p.fid
        WHERE a.deleted_at IS NULL
      `;
      const params = [];

      if (project) {
        query += ' AND a.project_fid = ?';
        params.push(project);
      }
      if (status === 'open') {
        query += ' AND a.completed = 0';
      } else if (status === 'done') {
        query += ' AND a.completed = 1';
      }

      query += ' ORDER BY a.completed ASC, a.flagged DESC, a.sort_order ASC, a.created DESC';
      return json(res, db.prepare(query).all(...params));
    }

    // GET /api/action/:fid — single action with full notes
    if (req.method === 'GET' && url.pathname.startsWith('/api/action/')) {
      const fid = decodeURIComponent(url.pathname.slice('/api/action/'.length));
      const row = db.prepare(`
        SELECT a.*, p.name as project_name
        FROM actions a
        LEFT JOIN projects p ON a.project_fid = p.fid
        WHERE a.fid = ?
      `).get(fid);
      if (!row) return json(res, { error: 'Not found' }, 404);
      return json(res, row);
    }

    // PATCH /api/action/:fid — update action fields
    if (req.method === 'PATCH' && url.pathname.startsWith('/api/action/')) {
      const fid = decodeURIComponent(url.pathname.slice('/api/action/'.length));
      const body = await readBody(req);
      const allowed = ['text', 'status', 'completed', 'flagged', 'notes', 'due', 'tags', 'project_fid'];
      const sets = [];
      const params = [];
      for (const [key, val] of Object.entries(body)) {
        if (!allowed.includes(key)) continue;
        sets.push(`${key} = ?`);
        params.push(val);
      }
      if (body.completed === 1 && !body.completed_at) {
        sets.push('completed_at = ?');
        params.push(new Date().toISOString().split('T')[0]);
      }
      if (sets.length === 0) return json(res, { error: 'Nothing to update' }, 400);
      params.push(fid);
      db.prepare(`UPDATE actions SET ${sets.join(', ')} WHERE fid = ?`).run(...params);
      return json(res, { ok: true });
    }

    // PATCH /api/project/:fid — update project fields
    if (req.method === 'PATCH' && url.pathname.startsWith('/api/project/')) {
      const fid = decodeURIComponent(url.pathname.slice('/api/project/'.length));
      const body = await readBody(req);
      const allowed = ['name', 'status', 'area', 'notes', 'due'];
      const sets = [];
      const params = [];
      for (const [key, val] of Object.entries(body)) {
        if (!allowed.includes(key)) continue;
        sets.push(`${key} = ?`);
        params.push(val);
      }
      if (body.status === 'done' && !body.completed_at) {
        sets.push('completed_at = ?');
        params.push(new Date().toISOString().split('T')[0]);
      }
      if (sets.length === 0) return json(res, { error: 'Nothing to update' }, 400);
      params.push(fid);
      db.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE fid = ?`).run(...params);
      return json(res, { ok: true });
    }

    // GET /api/stats — dashboard summary
    if (req.method === 'GET' && url.pathname === '/api/stats') {
      const projects = db.prepare(`
        SELECT status, COUNT(*) as count FROM projects WHERE deleted_at IS NULL GROUP BY status
      `).all();
      const actions = db.prepare(`
        SELECT
          SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) as open,
          SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as done,
          SUM(CASE WHEN flagged = 1 AND completed = 0 THEN 1 ELSE 0 END) as flagged
        FROM actions WHERE deleted_at IS NULL
      `).get();
      return json(res, { projects, actions });
    }

    res.writeHead(404);
    res.end('Not found');
  } catch (err) {
    console.error(err);
    json(res, { error: err.message }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`Work tracker at http://localhost:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});
