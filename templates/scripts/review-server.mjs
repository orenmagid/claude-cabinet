/**
 * Generic review server — serves the review UI and holds items/verdicts in memory.
 *
 * Claude POSTs items to review, user reviews in browser, Claude GETs verdicts.
 * Works for audit findings, plan critique, plan actions, or any itemized list.
 *
 * Usage: node review-server.mjs [--port 3459]
 *
 * API:
 *   POST /api/session   — Claude sends { title, items, verdictLabels?, groups? }
 *   GET  /api/session    — UI fetches current session
 *   POST /api/verdicts   — UI submits verdicts
 *   GET  /api/verdicts   — Claude reads verdicts
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--port') || '3459');

let currentSession = null;
let currentVerdicts = null;

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

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
      const html = await readFile(join(__dirname, 'review-ui.html'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(html);
    } catch (err) {
      res.writeHead(500);
      return res.end('Failed to read review-ui.html');
    }
  }

  // POST /api/session — Claude sends items to review
  if (req.method === 'POST' && url.pathname === '/api/session') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      currentSession = JSON.parse(body);
      currentVerdicts = null;
      console.log(`Review session: "${currentSession.title}" — ${currentSession.items?.length || 0} items`);
      return json(res, { ok: true, count: currentSession.items?.length || 0 });
    } catch (err) {
      return json(res, { error: 'Invalid JSON' }, 400);
    }
  }

  // GET /api/session — UI fetches current session
  if (req.method === 'GET' && url.pathname === '/api/session') {
    if (!currentSession) return json(res, { active: false });
    return json(res, { active: true, ...currentSession });
  }

  // POST /api/verdicts — UI submits verdicts
  if (req.method === 'POST' && url.pathname === '/api/verdicts') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      currentVerdicts = JSON.parse(body);
      console.log(`Received ${currentVerdicts.reviewed}/${currentVerdicts.total} verdicts`);
      return json(res, { ok: true });
    } catch (err) {
      return json(res, { error: 'Invalid JSON' }, 400);
    }
  }

  // GET /api/verdicts — Claude reads verdicts
  if (req.method === 'GET' && url.pathname === '/api/verdicts') {
    if (!currentVerdicts) {
      return json(res, { submitted: false, message: 'No verdicts submitted yet' });
    }
    return json(res, { submitted: true, ...currentVerdicts });
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Review server running at http://localhost:${PORT}`);
});
