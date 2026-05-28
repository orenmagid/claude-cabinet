/**
 * Write a single memory file under the project's memory dir and
 * update MEMORY.md's index to reference it.
 *
 * This is the per-file curated-style writer: each memory is its own
 * .md file with a descriptive slug, matching Claude Code's native
 * auto-memory convention. Used by /cc-remember and (Phase 3b) by
 * debrief's record-lessons phase.
 *
 * Does NOT depend on omega — works against the file-based memory
 * layout regardless of whether omega is installed.
 *
 * @module scripts/write-memory-file
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolveMemoryDir } = require('./project-context.cjs');

const MEMORY_INDEX_FILE = 'MEMORY.md';
const CURATED_SECTION_HEADER = '## Curated entries (hand-authored)';
const CURATED_SECTION_BODY =
  '_Hand-curated memory files. Each is one memory, written by Claude or you. Loaded on demand when Claude references them below._\n';

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,79}$/;

/**
 * Normalize an input string to a valid slug.
 * Lowercase, alphanumeric + underscore + hyphen, 1-80 chars,
 * starts with alphanumeric. Strips leading/trailing punctuation.
 */
export function normalizeSlug(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('slug: input must be a non-empty string');
  }
  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '')
    .slice(0, 80);
  if (!normalized || !SLUG_RE.test(normalized)) {
    throw new Error(`slug "${input}" could not be normalized to a valid filename`);
  }
  return normalized;
}

/**
 * Write a memory file. If a file with the same slug exists, append
 * a date suffix until unique (slug.md → slug_2026-05-27.md →
 * slug_2026-05-27-2.md).
 *
 * @param {object} opts
 * @param {string} opts.slug — descriptive identifier for the memory
 * @param {string} opts.content — markdown body
 * @param {string} [opts.title] — optional `# Title` heading; defaults
 *   to a title-cased version of the slug
 * @param {string} [opts.description] — one-line description for the
 *   MEMORY.md index entry (recommended; defaults to first line of content)
 * @param {string} [opts.memoryDir] — override the resolved memory dir
 * @param {string} [opts.homeDir] — override $HOME (for tests)
 * @param {string} [opts.cwd] — override cwd (for tests)
 * @param {string} [opts.settingsPath] — override settings.json path
 * @param {Date|string} [opts.date] — override "today" for testing
 * @returns {{filePath: string, slug: string, indexed: boolean, bytesWritten: number}}
 */
export function writeMemoryFile(opts = {}) {
  if (!opts.content || typeof opts.content !== 'string') {
    throw new Error('writeMemoryFile: content is required and must be a string');
  }
  if (!opts.slug) {
    throw new Error('writeMemoryFile: slug is required (provide via opts.slug or via /cc-remember --slug)');
  }

  const slug = normalizeSlug(opts.slug);
  const memoryDir = opts.memoryDir
    ? path.resolve(opts.memoryDir)
    : resolveMemoryDir({ homeDir: opts.homeDir, cwd: opts.cwd, settingsPath: opts.settingsPath });

  fs.mkdirSync(memoryDir, { recursive: true });

  const date = opts.date ? new Date(opts.date) : new Date();
  const dateStr = date.toISOString().slice(0, 10);

  // Resolve filename, avoiding collision via date + counter suffix.
  let fileName = `${slug}.md`;
  let counter = 1;
  while (fs.existsSync(path.join(memoryDir, fileName))) {
    counter++;
    fileName = counter === 2
      ? `${slug}_${dateStr}.md`
      : `${slug}_${dateStr}-${counter - 1}.md`;
  }

  const finalSlug = fileName.replace(/\.md$/, '');
  const filePath = path.join(memoryDir, fileName);

  const title = opts.title || finalSlug.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const body = [`# ${title}`, '', `_Captured: ${dateStr}_`, '', opts.content.trim(), ''].join('\n');

  // Atomic write via temp + rename.
  const tmpPath = filePath + '.tmp-' + process.pid;
  fs.writeFileSync(tmpPath, body, 'utf8');
  fs.renameSync(tmpPath, filePath);

  const description = opts.description || extractFirstLine(opts.content) || title;
  const indexed = updateMemoryIndex({ memoryDir, fileName, title, description });

  return {
    filePath,
    slug: finalSlug,
    indexed,
    bytesWritten: Buffer.byteLength(body, 'utf8'),
  };
}

function extractFirstLine(text) {
  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/^[-*#>\s]+/, '');
    if (line) return line.slice(0, 100);
  }
  return null;
}

/**
 * Add an entry for `fileName` to MEMORY.md's curated-entries section.
 * Creates the section if absent. If the file is already indexed
 * anywhere (Topic files OR Curated entries section), no-op.
 *
 * Returns true if MEMORY.md was modified, false if no change needed.
 */
function updateMemoryIndex({ memoryDir, fileName, title, description }) {
  const indexPath = path.join(memoryDir, MEMORY_INDEX_FILE);
  let body = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '# Memory Index\n\n';

  // Idempotency: don't re-index a file already referenced anywhere.
  if (body.includes(`(${fileName})`) || body.includes(`**${fileName}**`)) {
    return false;
  }

  const entry = `- [${title}](${fileName}) — ${description}`;

  if (body.includes(CURATED_SECTION_HEADER)) {
    body = body.replace(CURATED_SECTION_HEADER, `${CURATED_SECTION_HEADER}\n${entry}`);
  } else {
    const trailing = body.endsWith('\n') ? '' : '\n';
    body = `${body}${trailing}\n${CURATED_SECTION_HEADER}\n\n${CURATED_SECTION_BODY}\n${entry}\n`;
  }

  const tmp = indexPath + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, body, 'utf8');
  fs.renameSync(tmp, indexPath);
  return true;
}

// CLI mode: `node scripts/write-memory-file.mjs --slug foo "content..."`
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = process.argv.slice(2);
  let slug = null;
  let title = null;
  let description = null;
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--slug') slug = args[++i];
    else if (args[i] === '--title') title = args[++i];
    else if (args[i] === '--description') description = args[++i];
    else positional.push(args[i]);
  }
  const content = positional.join(' ');
  if (!slug || !content) {
    console.error('usage: write-memory-file.mjs --slug <slug> [--title <title>] [--description <desc>] <content>');
    process.exit(2);
  }
  try {
    const result = writeMemoryFile({ slug, content, title, description });
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('write-memory-file failed:', e.message);
    process.exit(1);
  }
}
