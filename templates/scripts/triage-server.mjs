/**
 * Minimal triage server — serves the triage UI and holds findings/verdicts.
 *
 * Claude POSTs findings, user triages in browser, Claude GETs verdicts.
 * Each verdict is written through to disk as the user makes it, so page
 * reloads or server restarts don't lose in-progress triage decisions.
 *
 * Usage: node triage-server.mjs [--port 3457]
 */

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--port') || '3457');
const DRAFT_PATH = join(process.cwd(), '.claude', 'triage-draft.json');

let currentFindings = [];
let currentVerdicts = null;
let drafts = {}; // { findingId: { verdict, feedback } }

async function loadDrafts() {
  try {
    drafts = JSON.parse(await readFile(DRAFT_PATH, 'utf-8'));
  } catch {
    drafts = {};
  }
}

async function saveDrafts() {
  await mkdir(dirname(DRAFT_PATH), { recursive: true });
  await writeFile(DRAFT_PATH, JSON.stringify(drafts, null, 2));
}

function dedupById(items) {
  const seen = new Set();
  const out = [];
  for (const f of items) {
    if (!f || !f.id || seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
  }
  return out;
}

function withDrafts(findings) {
  return findings.map((f) => ({ ...f, draft: drafts[f.id] || null }));
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // Serve HTML
  if (req.method === 'GET' && url.pathname === '/') {
    try {
      const html = await readFile(join(__dirname, 'triage-ui.html'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(html);
    } catch (err) {
      res.writeHead(500);
      return res.end('Failed to read triage-ui.html');
    }
  }

  // POST /api/findings — Claude sends findings
  if (req.method === 'POST' && url.pathname === '/api/findings') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const data = JSON.parse(body);
      const raw = data.findings || data;
      currentFindings = dedupById(Array.isArray(raw) ? raw : []);
      currentVerdicts = null;
      // Trim drafts to the new finding id set so a fresh batch doesn't
      // surface stale entries, but a re-POST of the same batch preserves
      // in-progress work.
      const idSet = new Set(currentFindings.map((f) => f.id));
      drafts = Object.fromEntries(Object.entries(drafts).filter(([id]) => idSet.has(id)));
      await saveDrafts();
      console.log(`Loaded ${currentFindings.length} findings (${Object.keys(drafts).length} drafts retained)`);
      return json(res, { ok: true, count: currentFindings.length });
    } catch (err) {
      return json(res, { error: 'Invalid JSON' }, 400);
    }
  }

  // GET /api/findings — UI fetches findings (with any saved drafts attached)
  if (req.method === 'GET' && url.pathname === '/api/findings') {
    return json(res, { findings: withDrafts(currentFindings) });
  }

  // POST /api/verdict — UI writes a single verdict as the user makes it
  if (req.method === 'POST' && url.pathname === '/api/verdict') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { id, verdict, feedback } = JSON.parse(body);
      if (!id) return json(res, { error: 'Missing id' }, 400);
      const existing = drafts[id] || { verdict: '', feedback: '' };
      drafts[id] = {
        verdict: verdict !== undefined ? verdict : existing.verdict,
        feedback: feedback !== undefined ? feedback : existing.feedback,
      };
      await saveDrafts();
      return json(res, { ok: true });
    } catch (err) {
      return json(res, { error: 'Invalid JSON' }, 400);
    }
  }

  // POST /api/verdicts — UI submits final verdicts batch
  if (req.method === 'POST' && url.pathname === '/api/verdicts') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      currentVerdicts = JSON.parse(body);
      console.log(`Received ${currentVerdicts.triaged}/${currentVerdicts.total} verdicts`);
      return json(res, { ok: true });
    } catch (err) {
      return json(res, { error: 'Invalid JSON' }, 400);
    }
  }

  // GET /api/verdicts — Claude reads submitted verdicts
  if (req.method === 'GET' && url.pathname === '/api/verdicts') {
    if (!currentVerdicts) {
      return json(res, { submitted: false, message: 'No verdicts submitted yet' });
    }
    return json(res, currentVerdicts);
  }

  // DELETE /api/draft — clear in-progress draft state
  if (req.method === 'DELETE' && url.pathname === '/api/draft') {
    drafts = {};
    try {
      await unlink(DRAFT_PATH);
    } catch {}
    return json(res, { ok: true });
  }

  // 404
  res.writeHead(404);
  res.end('Not found');
});

await loadDrafts();
server.listen(PORT, () => {
  console.log(`Triage server running at http://localhost:${PORT}`);
  const draftCount = Object.keys(drafts).length;
  if (draftCount) console.log(`Restored ${draftCount} in-progress draft verdict(s) from ${DRAFT_PATH}`);
});
