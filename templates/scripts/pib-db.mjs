#!/usr/bin/env node
// Process-in-a-Box reference data layer — CLI wrapper
//
// Thin CLI over pib-db-lib.mjs. All database operations live in the library;
// this file handles argument parsing and console output.
//
// Usage:
//   node scripts/pib-db.mjs init                        # Create/migrate DB
//   node scripts/pib-db.mjs query "SELECT * FROM ..."   # Run a query
//   node scripts/pib-db.mjs create-action "Do the thing" --projectFid prj:abc --area dev
//   node scripts/pib-db.mjs list-actions [--status X]   # Open actions (or filtered)
//   node scripts/pib-db.mjs update-action act:abc --status in-progress
//   node scripts/pib-db.mjs complete-action act:abc123
//   node scripts/pib-db.mjs create-project "My Project" --area dev
//   node scripts/pib-db.mjs list-projects               # Active projects
//   node scripts/pib-db.mjs ingest-findings <run-dir>   # Ingest audit findings
//   node scripts/pib-db.mjs triage <finding-id> <status> [notes]
//   node scripts/pib-db.mjs triage-history              # Suppression list JSON
//
// Environment:
//   PIB_DB_PATH  — path to SQLite file (default: ./pib.db)

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as lib from './pib-db-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.PIB_DB_PATH || join(process.cwd(), 'pib.db');

// ---------------------------------------------------------------------------
// SQLite setup — try better-sqlite3
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
  } catch (err) {
    if (err.code === 'ERR_DLOPEN_FAILED') {
      console.error('Error: better-sqlite3 native module version mismatch.');
      console.error('  Rebuild it for your current Node version:');
      console.error('  npm rebuild better-sqlite3');
    } else {
      console.error('Error: better-sqlite3 not found. Install it:');
      console.error('  npm install better-sqlite3');
    }
    if (err.message) console.error(`  (${err.message.split('\n')[0]})`);
    process.exit(1);
  }
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

/** Print result — if it has rows, JSON-stringify them; otherwise print message. */
function printResult(result) {
  if (result.error) {
    if (result.error.message) console.error(result.error.message);
    else console.error(JSON.stringify(result.error, null, 2));
    process.exit(1);
  }
  if (result.rows !== undefined) {
    console.log(JSON.stringify(result.rows, null, 2));
  } else if (result.message) {
    console.log(result.message);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

switch (command) {
  case 'init': {
    const schemaPath = join(__dirname, 'pib-db-schema.sql');
    const result = lib.init(getDb(), { schemaPath });
    result.message = `Database initialized at ${DB_PATH}`;
    printResult(result);
    break;
  }
  case 'query':
    printResult(lib.query(getDb(), { sql: args.join(' ') }));
    break;
  case 'create-action': {
    const { flags, positional } = parseFlags(args);
    const result = lib.createAction(getDb(), { text: positional[0], ...flags });
    printResult(result);
    break;
  }
  case 'list-actions': {
    const { flags } = parseFlags(args);
    printResult(lib.listActions(getDb(), flags));
    break;
  }
  case 'update-action': {
    const { flags, positional } = parseFlags(args);
    printResult(lib.updateAction(getDb(), { fid: positional[0], ...flags }));
    break;
  }
  case 'complete-action':
    printResult(lib.completeAction(getDb(), { fid: args[0] }));
    break;
  case 'create-project': {
    const { flags, positional } = parseFlags(args);
    printResult(lib.createProject(getDb(), { name: positional[0], ...flags }));
    break;
  }
  case 'list-projects':
    printResult(lib.listProjects(getDb()));
    break;
  case 'ingest-findings':
    printResult(lib.ingestFindings(getDb(), { runDir: args[0] }));
    break;
  case 'triage':
    printResult(lib.triage(getDb(), { findingId: args[0], status: args[1], notes: args.slice(2).join(' ') || undefined }));
    break;
  case 'triage-history':
    printResult(lib.triageHistory(getDb()));
    break;
  default:
    console.log(`Usage: pib-db.mjs <command>

Commands:
  init                              Create/migrate the database
  query "SQL"                       Run a SQL query
  create-action "text" [--projectFid X] [--area X] [--due X] [--notes X]  Create an action
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
