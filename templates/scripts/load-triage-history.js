#!/usr/bin/env node
// Build suppression lists from triage history.
//
// Outputs JSON with rejected/deferred finding IDs and fingerprints.
// The audit skill uses this to skip previously-triaged findings.
//
// Usage:
//   node scripts/load-triage-history.js              # Auto-detect source
//   node scripts/load-triage-history.js --db-only    # Only check database
//   node scripts/load-triage-history.js --files-only # Only check triage.json files
//
// Two sources (tried in order):
//   1. pib-db (SQLite) — if PIB_DB_PATH exists
//   2. Filesystem — scan reviews/*/triage.json files
//
// Environment:
//   PIB_DB_PATH   — path to SQLite file (default: ./pib.db)
//   REVIEWS_DIR   — path to reviews directory (default: ./reviews)

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const DB_PATH = process.env.PIB_DB_PATH || join(process.cwd(), 'pib.db');
const REVIEWS_DIR = process.env.REVIEWS_DIR || join(process.cwd(), 'reviews');
const args = process.argv.slice(2);
const dbOnly = args.includes('--db-only');
const filesOnly = args.includes('--files-only');

const result = {
  rejectedIds: [],
  rejectedFingerprints: [],
  deferredIds: [],
  deferredFingerprints: [],
};

// ---------------------------------------------------------------------------
// Source 1: Database
// ---------------------------------------------------------------------------
function tryDatabase() {
  if (filesOnly) return false;
  if (!existsSync(DB_PATH)) return false;

  try {
    const require = createRequire(import.meta.url);
    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH, { readonly: true });

    const rejected = db.prepare(`
      SELECT id, cabinet_member, title FROM audit_findings
      WHERE triage_status = 'rejected'
    `).all();

    const deferred = db.prepare(`
      SELECT id, cabinet_member, title FROM audit_findings
      WHERE triage_status = 'deferred'
    `).all();

    db.close();

    result.rejectedIds = rejected.map(r => r.id);
    result.rejectedFingerprints = rejected.map(r => ({
      'cabinet-member': r.cabinet_member,
      title: r.title,
    }));
    result.deferredIds = deferred.map(r => r.id);
    result.deferredFingerprints = deferred.map(r => ({
      'cabinet-member': r.cabinet_member,
      title: r.title,
    }));

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Source 2: Filesystem (triage.json files)
// ---------------------------------------------------------------------------
function tryFilesystem() {
  if (dbOnly) return false;
  if (!existsSync(REVIEWS_DIR)) return false;

  const MAX_AGE_DAYS = 30;
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  try {
    const dateDirs = readdirSync(REVIEWS_DIR)
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()
      .reverse();

    for (const dateDir of dateDirs) {
      const datePath = join(REVIEWS_DIR, dateDir);
      if (!statSync(datePath).isDirectory()) continue;

      // Check age
      const dirDate = new Date(dateDir).getTime();
      if (dirDate < cutoff) break;

      // Look for triage.json in date dir or run subdirs
      const triagePaths = [];
      const directTriage = join(datePath, 'triage.json');
      if (existsSync(directTriage)) triagePaths.push(directTriage);

      // Check run subdirectories
      for (const sub of readdirSync(datePath)) {
        const subTriage = join(datePath, sub, 'triage.json');
        if (existsSync(subTriage)) triagePaths.push(subTriage);
      }

      for (const triagePath of triagePaths) {
        try {
          const data = JSON.parse(readFileSync(triagePath, 'utf-8'));
          const verdicts = data.verdicts || data;

          for (const v of (Array.isArray(verdicts) ? verdicts : [])) {
            const fp = { 'cabinet-member': v['cabinet-member'] || v.perspective, title: v.title };

            if (v.verdict === 'reject' || v.status === 'rejected') {
              if (v.id && !result.rejectedIds.includes(v.id)) {
                result.rejectedIds.push(v.id);
                result.rejectedFingerprints.push(fp);
              }
            } else if (v.verdict === 'defer' || v.status === 'deferred') {
              if (v.id && !result.deferredIds.includes(v.id)) {
                result.deferredIds.push(v.id);
                result.deferredFingerprints.push(fp);
              }
            }
          }
        } catch {
          // Skip malformed triage files
        }
      }
    }

    return result.rejectedIds.length > 0 || result.deferredIds.length > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const foundDb = tryDatabase();
if (!foundDb) tryFilesystem();

console.log(JSON.stringify(result, null, 2));
