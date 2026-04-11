#!/usr/bin/env node
// Process-in-a-Box MCP Server
//
// JSON-RPC 2.0 over stdio. Exposes pib-db operations as MCP tools
// for Claude Code to call directly instead of shelling out to the CLI.
//
// Environment:
//   PIB_DB_PATH  — path to SQLite file (default: ./pib.db)

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import * as lib from './pib-db-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.PIB_DB_PATH || join(process.cwd(), 'pib.db');

// ---------------------------------------------------------------------------
// SQLite setup
// ---------------------------------------------------------------------------
let db;

function getDb() {
  if (db) return db;
  const require = createRequire(import.meta.url);
  const Database = require('better-sqlite3');
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------
const TOOLS = [
  {
    name: 'pib_create_project',
    description: 'Create a new project in pib-db.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project name' },
        area: { type: 'string', description: 'Area (e.g., dev, ops, docs)' },
        notes: { type: 'string', description: 'Project notes' },
        due: { type: 'string', description: 'Due date (YYYY-MM-DD)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'pib_list_projects',
    description: 'List active projects.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'pib_create_action',
    description: 'Create a new action (work item). Notes MUST contain a "## Surface Area" section with at least one "- files:" or "- dirs:" line.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Action description' },
        area: { type: 'string', description: 'Area (e.g., dev, ops, docs)' },
        projectFid: { type: 'string', description: 'Project fid (e.g., prj:abc12345)' },
        due: { type: 'string', description: 'Due date (YYYY-MM-DD)' },
        notes: { type: 'string', description: 'Action notes. Must include ## Surface Area section with - files: or - dirs: lines.' },
      },
      required: ['text', 'notes'],
    },
  },
  {
    name: 'pib_list_actions',
    description: 'List actions. Default: open actions. Filter by status or project.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'in-progress', 'blocked', 'deferred', 'done'], description: 'Filter by status' },
        project: { type: 'string', description: 'Filter by project fid' },
      },
    },
  },
  {
    name: 'pib_update_action',
    description: 'Update fields on an existing action.',
    inputSchema: {
      type: 'object',
      properties: {
        fid: { type: 'string', description: 'Action fid (e.g., act:abc12345)' },
        status: { type: 'string', enum: ['open', 'in-progress', 'blocked', 'deferred', 'done'] },
        text: { type: 'string', description: 'New action text' },
        tags: { type: 'string', description: 'Comma-separated tags' },
        notes: { type: 'string', description: 'Updated notes' },
        due: { type: 'string', description: 'Due date (YYYY-MM-DD)' },
        flagged: { type: 'boolean', description: 'Flag the action' },
      },
      required: ['fid'],
    },
  },
  {
    name: 'pib_complete_action',
    description: 'Mark an action as complete (status=done).',
    inputSchema: {
      type: 'object',
      properties: {
        fid: { type: 'string', description: 'Action fid (e.g., act:abc12345)' },
      },
      required: ['fid'],
    },
  },
  {
    name: 'pib_ingest_findings',
    description: 'Ingest audit findings from a run directory containing run-summary.json.',
    inputSchema: {
      type: 'object',
      properties: {
        runDir: { type: 'string', description: 'Path to the audit run directory' },
      },
      required: ['runDir'],
    },
  },
  {
    name: 'pib_triage',
    description: 'Triage an audit finding (set status and optional notes).',
    inputSchema: {
      type: 'object',
      properties: {
        findingId: { type: 'string', description: 'Finding ID' },
        status: { type: 'string', enum: ['approved', 'rejected', 'deferred', 'fixed', 'archived'], description: 'Triage status' },
        notes: { type: 'string', description: 'Triage notes' },
      },
      required: ['findingId', 'status'],
    },
  },
  {
    name: 'pib_triage_history',
    description: 'Get the triage suppression list (rejected and deferred findings).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'pib_query',
    description: 'Run an arbitrary SQL query against the pib database.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'SQL query to execute' },
      },
      required: ['sql'],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------------
function handleToolCall(name, args) {
  const d = getDb();
  const schemaPath = join(__dirname, 'pib-db-schema.sql');

  // Auto-init: ensure tables exist
  try {
    d.prepare('SELECT 1 FROM projects LIMIT 0').run();
  } catch {
    lib.init(d, { schemaPath });
  }

  switch (name) {
    case 'pib_create_project':
      return lib.createProject(d, args);
    case 'pib_list_projects':
      return lib.listProjects(d);
    case 'pib_create_action':
      return lib.createAction(d, args);
    case 'pib_list_actions':
      return lib.listActions(d, args);
    case 'pib_update_action':
      return lib.updateAction(d, args);
    case 'pib_complete_action':
      return lib.completeAction(d, args);
    case 'pib_ingest_findings':
      return lib.ingestFindings(d, args);
    case 'pib_triage':
      return lib.triage(d, args);
    case 'pib_triage_history':
      return lib.triageHistory(d);
    case 'pib_query':
      return lib.query(d, args);
    default:
      return { error: { message: `Unknown tool: ${name}` } };
  }
}

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 over stdio
// ---------------------------------------------------------------------------
const SERVER_INFO = {
  name: 'pib-db',
  version: '1.0.0',
};

function makeResponse(id, result) {
  return JSON.stringify({ jsonrpc: '2.0', id, result });
}

function makeError(id, code, message) {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } });
}

function handleMessage(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case 'initialize':
      return makeResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });

    case 'notifications/initialized':
      // No response needed for notifications
      return null;

    case 'tools/list':
      return makeResponse(id, { tools: TOOLS });

    case 'tools/call': {
      const { name, arguments: toolArgs } = params;
      try {
        const result = handleToolCall(name, toolArgs || {});
        if (result.error) {
          return makeResponse(id, {
            content: [{ type: 'text', text: JSON.stringify(result.error, null, 2) }],
            isError: true,
          });
        }
        return makeResponse(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        });
      } catch (err) {
        return makeResponse(id, {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        });
      }
    }

    default:
      if (method?.startsWith('notifications/')) return null;
      return makeError(id, -32601, `Method not found: ${method}`);
  }
}

// ---------------------------------------------------------------------------
// Stdio transport
// ---------------------------------------------------------------------------
let buffer = '';

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on('line', (line) => {
  buffer += line;
  // Try to parse — each line should be a complete JSON-RPC message
  try {
    const msg = JSON.parse(buffer);
    buffer = '';
    const response = handleMessage(msg);
    if (response) {
      process.stdout.write(response + '\n');
    }
  } catch {
    // Incomplete JSON — wait for more data
    // If it's clearly invalid, reset
    try {
      JSON.parse(buffer);
    } catch (e) {
      if (e.message.includes('Unexpected token') && !e.message.includes('end of JSON')) {
        buffer = '';
      }
    }
  }
});

rl.on('close', () => {
  if (db) db.close();
  process.exit(0);
});

// Prevent unhandled errors from crashing the server
process.on('uncaughtException', (err) => {
  process.stderr.write(`pib-db-mcp-server error: ${err.message}\n`);
});
