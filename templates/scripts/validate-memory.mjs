/**
 * Validate the structural integrity of a Claude Code memory directory.
 *
 * Checks:
 *   1. MEMORY.md exists and is within Claude Code's session-start
 *      load budget: ≤200 lines AND ≤25KB.
 *   2. Every .md file in the memory dir (except MEMORY.md, edges.json)
 *      is referenced by MEMORY.md (bidirectional: no orphans).
 *   3. Every file referenced in MEMORY.md exists on disk.
 *   4. Topic-style files (migrated from omega) do not exceed 50KB.
 *      Per-file curated style: no size cap.
 *
 * Wired into /validate via templates/skills/validate/phases/validators.md.
 * Also runs PostToolUse on memory-dir writes via
 * templates/.claude/hooks/memory-index-guard.sh.
 *
 * Exit codes:
 *   0 — pass
 *   1 — one or more violations
 *   2 — bad usage / inaccessible memory dir
 *
 * @module scripts/validate-memory
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolveMemoryDir } = require('./project-context.cjs');

const MEMORY_INDEX_FILE = 'MEMORY.md';
const MEMORY_INDEX_LINE_CAP = 200;
const MEMORY_INDEX_BYTE_CAP = 25_000;
const TOPIC_FILE_SIZE_CAP = 50_000;
const NON_MEMORY_FILES = new Set(['MEMORY.md', 'edges.json', '.DS_Store']);

// Files that match this pattern are "topic-style" (multi-memory files
// produced by Phase 1 migration). The 50KB cap applies to them.
// Per-file curated style files (one memory each) are not size-capped.
const TOPIC_FILE_NAMES = new Set([
  'decisions.md',
  'lessons.md',
  'preferences.md',
  'constraints.md',
  'session-summaries.md',
  'subagent-residue.md',
  'unscoped.md',
]);
const TOPIC_FILE_PATTERNS = [
  /^(decisions|lessons|preferences|constraints|session-summaries|subagent-residue|unscoped)(-recent|-archive)?(-\d+)?\.md$/,
  /^cross-[a-z0-9_-]+(-recent|-archive)?(-\d+)?\.md$/,
];

function isTopicStyleFile(name) {
  if (TOPIC_FILE_NAMES.has(name)) return true;
  return TOPIC_FILE_PATTERNS.some((re) => re.test(name));
}

/**
 * Extract all `.md` filenames referenced from MEMORY.md.
 * Handles both index formats:
 *   - Topic-files: `- **decisions.md** (56 entries) — desc`
 *   - Curated:    `- [Title](file.md) — desc`
 */
function parseMemoryIndex(memoryMdText) {
  const refs = new Set();
  // Topic-files format: bolded filename
  for (const m of memoryMdText.matchAll(/\*\*([a-z0-9_.-]+\.md)\*\*/gi)) {
    refs.add(m[1]);
  }
  // Curated format: markdown link
  for (const m of memoryMdText.matchAll(/\]\(([a-z0-9_.-]+\.md)\)/gi)) {
    refs.add(m[1]);
  }
  return refs;
}

/**
 * Validate one memory directory.
 *
 * @returns {{ violations: string[], warnings: string[], stats: object }}
 */
export function validateMemoryDir(opts = {}) {
  const memoryDir = opts.memoryDir
    ? path.resolve(opts.memoryDir)
    : resolveMemoryDir({ homeDir: opts.homeDir, cwd: opts.cwd, settingsPath: opts.settingsPath });

  const violations = [];
  const warnings = [];
  const stats = { memoryDir };

  if (!fs.existsSync(memoryDir)) {
    return {
      violations: [`memory directory does not exist: ${memoryDir}`],
      warnings,
      stats,
    };
  }

  const indexPath = path.join(memoryDir, MEMORY_INDEX_FILE);
  if (!fs.existsSync(indexPath)) {
    return {
      violations: [`${MEMORY_INDEX_FILE} missing under ${memoryDir}`],
      warnings,
      stats,
    };
  }

  const indexText = fs.readFileSync(indexPath, 'utf8');
  const indexBytes = Buffer.byteLength(indexText, 'utf8');
  const indexLines = indexText.split('\n').length;
  stats.indexLines = indexLines;
  stats.indexBytes = indexBytes;

  if (indexLines > MEMORY_INDEX_LINE_CAP) {
    violations.push(
      `MEMORY.md exceeds line cap: ${indexLines} lines (max ${MEMORY_INDEX_LINE_CAP}). Reduce index verbosity or move details into topic files.`
    );
  }
  if (indexBytes > MEMORY_INDEX_BYTE_CAP) {
    violations.push(
      `MEMORY.md exceeds byte cap: ${indexBytes} bytes (max ${MEMORY_INDEX_BYTE_CAP}). Reduce index verbosity.`
    );
  }

  const referenced = parseMemoryIndex(indexText);
  stats.indexedFileCount = referenced.size;

  const entries = fs.readdirSync(memoryDir).filter((f) => !f.startsWith('.'));
  const onDiskMd = entries.filter((f) => f.endsWith('.md') && !NON_MEMORY_FILES.has(f));
  stats.onDiskMemoryFileCount = onDiskMd.length;

  // Orphans on disk (file exists, not indexed).
  for (const f of onDiskMd) {
    if (!referenced.has(f)) {
      violations.push(
        `orphan memory file: ${f} exists in ${memoryDir} but is not referenced by MEMORY.md. ` +
          `Either reference it (manually or via /cc-remember next time) or delete it.`
      );
    }
  }

  // Broken references (indexed but missing on disk).
  for (const ref of referenced) {
    if (ref === MEMORY_INDEX_FILE) continue;
    if (!entries.includes(ref)) {
      violations.push(
        `broken reference in MEMORY.md: ${ref} is indexed but does not exist on disk.`
      );
    }
  }

  // Size cap on topic-style files.
  for (const f of onDiskMd) {
    if (!isTopicStyleFile(f)) continue;
    const bytes = fs.statSync(path.join(memoryDir, f)).size;
    if (bytes > TOPIC_FILE_SIZE_CAP) {
      violations.push(
        `topic file too large: ${f} is ${bytes} bytes (cap ${TOPIC_FILE_SIZE_CAP}). Re-shard via migration tool or split manually.`
      );
    }
  }

  return { violations, warnings, stats };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = process.argv.slice(2);
  let memoryDir = null;
  let quiet = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--memory-dir' || args[i] === '--dir') memoryDir = args[++i];
    else if (args[i] === '--quiet') quiet = true;
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('usage: validate-memory.mjs [--memory-dir <path>] [--quiet]');
      console.log('  Validates a Claude Code memory directory. Defaults to the');
      console.log('  current project\'s memory dir. Exits 0 on pass, 1 on violations.');
      process.exit(0);
    }
  }
  try {
    const { violations, warnings, stats } = validateMemoryDir({ memoryDir });
    if (!quiet) {
      console.log(`memory-dir: ${stats.memoryDir}`);
      if (stats.indexLines !== undefined) {
        console.log(`MEMORY.md:  ${stats.indexLines} lines / ${stats.indexBytes} bytes`);
      }
      if (stats.onDiskMemoryFileCount !== undefined) {
        console.log(`on disk:    ${stats.onDiskMemoryFileCount} files`);
        console.log(`indexed:    ${stats.indexedFileCount} references`);
      }
    }
    for (const w of warnings) console.warn(`WARN: ${w}`);
    for (const v of violations) console.error(`FAIL: ${v}`);
    if (violations.length > 0) {
      console.error(`\nvalidate-memory: ${violations.length} violation(s)`);
      process.exit(1);
    }
    if (!quiet) console.log('validate-memory: PASS');
    process.exit(0);
  } catch (e) {
    console.error('validate-memory failed:', e.message);
    process.exit(2);
  }
}
