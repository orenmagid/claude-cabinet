#!/usr/bin/env node
// Merge cabinet member JSON outputs into a unified run-summary.json.
//
// Usage:
//   node scripts/merge-findings.js <run-dir>            # Merge only
//   node scripts/merge-findings.js <run-dir> --db       # Merge + ingest to pib-db
//
// Reads all *.json files in <run-dir> (one per cabinet member), validates
// against finding-schema.json, deduplicates by finding ID, and writes
// run-summary.json with merged findings and metadata.
//
// Environment:
//   PIB_DB_PATH  — path to SQLite file (for --db mode)

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKIP_FILES = new Set(['run-summary.json', 'day-summary.json', 'layer1-results.json', 'triage.json']);

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const runDir = args.find(a => !a.startsWith('--'));
const useDb = args.includes('--db');

if (!runDir) {
  console.log(`Usage: merge-findings.js <run-dir> [--db]

Merges per-cabinet-member JSON files into run-summary.json.
  --db    Also ingest findings into the pib-db database.`);
  process.exit(1);
}

if (!existsSync(runDir)) {
  console.error(`Directory not found: ${runDir}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Read and merge
// ---------------------------------------------------------------------------
const files = readdirSync(runDir).filter(f =>
  f.endsWith('.json') && !SKIP_FILES.has(f)
);

if (files.length === 0) {
  console.error(`No cabinet member JSON files found in ${runDir}`);
  process.exit(1);
}

const allFindings = [];
const seenIds = new Set();
const memberCounts = {};
const severityCounts = { critical: 0, warn: 0, info: 0, idea: 0 };
let positiveCount = 0;

for (const file of files) {
  try {
    const data = JSON.parse(readFileSync(join(runDir, file), 'utf-8'));
    const findings = data.findings || [];
    const member = data.meta?.['cabinet-member'] || basename(file, '.json');

    for (const f of findings) {
      if (seenIds.has(f.id)) continue;
      seenIds.add(f.id);

      allFindings.push(f);

      if (f.type === 'positive') {
        positiveCount++;
      } else {
        severityCounts[f.severity] = (severityCounts[f.severity] || 0) + 1;
        memberCounts[member] = (memberCounts[member] || 0) + 1;
      }
    }

    console.log(`  ${member}: ${findings.length} findings`);
  } catch (err) {
    console.error(`  Error reading ${file}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Write run-summary.json
// ---------------------------------------------------------------------------
const timestamp = new Date().toISOString();
const runId = `run-${basename(runDir)}`;

const summary = {
  findings: allFindings,
  meta: {
    runId,
    timestamp,
    trigger: 'manual',
    members: Object.keys(memberCounts),
    counts: {
      total: allFindings.length,
      findings: allFindings.length - positiveCount,
      positive: positiveCount,
      ...severityCounts,
    },
    byMember: memberCounts,
  },
};

const summaryPath = join(runDir, 'run-summary.json');
writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
console.log(`\nMerged ${allFindings.length} findings → ${summaryPath}`);
console.log(`  critical: ${severityCounts.critical}, warn: ${severityCounts.warn}, info: ${severityCounts.info}, idea: ${severityCounts.idea}, positive: ${positiveCount}`);

// ---------------------------------------------------------------------------
// Optional: ingest to pib-db
// ---------------------------------------------------------------------------
if (useDb) {
  try {
    const pibDb = join(__dirname, 'pib-db.js');
    execSync(`node "${pibDb}" ingest-findings "${runDir}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error(`DB ingest failed: ${err.message}`);
    console.error('Findings are still saved in run-summary.json.');
  }
}
