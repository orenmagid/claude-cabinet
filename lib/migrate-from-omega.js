/**
 * Migrate omega-memory data to Claude Code's built-in memory layout.
 *
 * Reads from omega via `omega export-obsidian`, classifies memories by
 * canonicalized project key (handling worktree paths, subdir paths,
 * agent-scoped paths, null-project), partitions into topic files
 * (decisions.md, lessons.md, ...), writes a MEMORY.md index that
 * stays within Claude Code's 200-line / 25KB session-start budget,
 * and emits an edges.json sidecar with omega's relational data.
 *
 * Atomic via staging-dir-rename. Idempotent via preamble detection.
 * Pure add — does not touch omega state, hooks, MCP, or CLAUDE.md
 * (that's --migrate-memory in Phase 4).
 *
 * @deprecated Remove after v1.0.0 — one-time migration for v0.27.0 omega removal.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');

const PREAMBLE_MARKER = '<!-- cc:migration source=omega -->';
const STAGING_PREFIX = '.migration-staging-';
const TOPIC_FILE_SIZE_CAP = 50_000;
const MEMORY_MD_LINE_CAP = 200;
const MEMORY_MD_BYTE_CAP = 25_000;
const RECENT_DAYS = 90;
const MS_PER_DAY = 86_400_000;

// Omega event_type → topic file. Unknown types → lessons.md.
const TYPE_TO_TOPIC = {
  decision: 'decisions',
  user_preference: 'preferences',
  constraint: 'constraints',
  session_summary: 'session-summaries',
  memory: 'session-summaries',
  compaction: 'session-summaries',
  lesson_learned: 'lessons',
  lesson: 'lessons',
  error_pattern: 'lessons',
  advisor_insight: 'lessons',
  pattern: 'lessons',
  task_completion: 'lessons',
};

const TOPIC_DESCRIPTIONS = {
  decisions: 'architectural and process decisions; consult when revisiting why something was built a particular way',
  lessons: 'lessons learned, error patterns, and discovered constraints; consult when hitting unfamiliar problems',
  preferences: 'durable user preferences across projects',
  constraints: 'active constraints and limitations affecting current work',
  'session-summaries': 'narrative summaries of prior sessions; consult when reconstructing context',
  unscoped: 'memories without a project assignment; consult only when other sources lack context',
  'subagent-residue': 'memories captured by ephemeral subagents; rarely consulted',
};

function describeTopic(topicName) {
  if (TOPIC_DESCRIPTIONS[topicName]) return TOPIC_DESCRIPTIONS[topicName];
  const base = topicName.replace(/-recent$|-archive$|-recent-\d+$|-archive-\d+$/, '');
  if (TOPIC_DESCRIPTIONS[base]) return TOPIC_DESCRIPTIONS[base];
  if (base.startsWith('cross-')) {
    const slug = base.slice('cross-'.length);
    return `memories from project '${slug}'; consult when work touches that project`;
  }
  return '';
}

const BASE_TOPICS = ['decisions', 'lessons', 'preferences', 'constraints'];

// ---------------------------------------------------------------------------
// Path / project canonicalization
// ---------------------------------------------------------------------------

function stripUserPrefix(raw, homeDir) {
  const userHome = homeDir || os.homedir();
  const userBase = path.dirname(userHome);
  if (raw.startsWith(userBase + '/')) {
    const tail = raw.slice(userBase.length + 1);
    const segs = tail.split('/');
    return segs.slice(1).join('/');
  }
  return raw;
}

function canonicalizeProjectKey(raw, ctx = {}) {
  if (raw == null || raw === '') return { canonical: null, kind: 'unscoped' };

  if (/^agent-[a-f0-9]+$/i.test(raw)) {
    return { canonical: 'subagent-residue', kind: 'agent' };
  }

  let work = raw;

  const worktreeMatch = work.match(/^(.+?)\/\.claude\/worktrees\/[^/]+(?:\/.*)?$/);
  if (worktreeMatch) work = worktreeMatch[1];

  const slugPath = stripUserPrefix(work, ctx.homeDir);
  const topSlug = slugPath.split('/')[0];

  return { canonical: topSlug || null, kind: 'project' };
}

function resolveCurrentProject(cwd, homeDir) {
  try {
    const commonDir = execSync('git rev-parse --git-common-dir', {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    const abs = path.isAbsolute(commonDir) ? commonDir : path.resolve(cwd, commonDir);
    const repoRoot = path.dirname(abs);
    return path.basename(repoRoot);
  } catch {
    return path.basename(cwd);
  }
}

function dashifiedSlug(absolutePath) {
  return absolutePath.replace(/^\//, '-').replace(/\//g, '-');
}

// ---------------------------------------------------------------------------
// Settings + output dir resolution
// ---------------------------------------------------------------------------

function readSettings(settingsPath) {
  if (!fs.existsSync(settingsPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return {};
  }
}

function resolveOutputDir(opts) {
  if (opts.outputDir) return path.resolve(opts.outputDir);

  const homeDir = opts.homeDir || os.homedir();
  const settingsPath = opts.settingsPath || path.join(homeDir, '.claude', 'settings.json');
  const settings = readSettings(settingsPath);

  if (settings.autoMemoryDirectory) {
    const v = settings.autoMemoryDirectory;
    if (v.includes('~')) {
      throw new Error(
        `autoMemoryDirectory in ${settingsPath} contains '~' (literal). Claude Code does not expand tilde. Use an absolute path.`
      );
    }
    return path.resolve(v);
  }

  const cwd = opts.cwd || process.cwd();
  const projectAbs = resolveProjectAbsolutePath(cwd);
  return path.join(homeDir, '.claude', 'projects', dashifiedSlug(projectAbs), 'memory');
}

function resolveProjectAbsolutePath(cwd) {
  try {
    const commonDir = execSync('git rev-parse --git-common-dir', {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    const abs = path.isAbsolute(commonDir) ? commonDir : path.resolve(cwd, commonDir);
    return path.dirname(abs);
  } catch {
    return path.resolve(cwd);
  }
}

// ---------------------------------------------------------------------------
// Omega export + parse
// ---------------------------------------------------------------------------

function resolveOmegaBin(opts) {
  if (opts.omegaBin) return opts.omegaBin;
  const homeDir = opts.homeDir || os.homedir();
  return path.join(homeDir, '.claude-cabinet', 'omega-venv', 'bin', 'omega');
}

function omegaPresent(omegaBin) {
  try {
    return fs.statSync(omegaBin).isFile();
  } catch {
    return false;
  }
}

function exportOmegaToTmp(omegaBin, env) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-omega-export-'));
  const result = spawnSync(omegaBin, ['export-obsidian', '--output-dir', tmpRoot], {
    env: { ...process.env, ...(env || {}) },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    throw new Error(`omega export-obsidian failed (status ${result.status}): ${result.stderr || result.stdout}`);
  }
  const vaultDir = path.join(tmpRoot, 'omega-memories');
  if (!fs.existsSync(vaultDir)) {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    throw new Error(`expected omega-memories/ inside ${tmpRoot}; not found`);
  }
  return { tmpRoot, vaultDir };
}

function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return { frontmatter: {}, body: text };
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) return { frontmatter: {}, body: text };
  const raw = text.slice(4, end);
  const body = text.slice(end + 5);
  const fm = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      val = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (val === 'null' || val === '') {
      val = null;
    }
    fm[m[1]] = val;
  }
  return { frontmatter: fm, body: body.replace(/^---\n?/, '').trim() };
}

function readVault(vaultDir) {
  const memories = [];
  const edges = [];

  for (const sub of fs.readdirSync(vaultDir)) {
    const subPath = path.join(vaultDir, sub);
    if (!fs.statSync(subPath).isDirectory()) continue;

    for (const f of fs.readdirSync(subPath)) {
      if (!f.endsWith('.md')) continue;
      const filePath = path.join(subPath, f);
      const text = fs.readFileSync(filePath, 'utf8');
      const { frontmatter, body } = parseFrontmatter(text);
      if (!frontmatter.id) continue;

      // Body may contain "## Metadata" section with edges. Strip it for clean content.
      const metaIdx = body.indexOf('\n## Metadata');
      const cleanBody = metaIdx === -1 ? body.trim() : body.slice(0, metaIdx).trim();

      memories.push({
        id: frontmatter.id,
        type: frontmatter.type || 'unknown',
        project: frontmatter.project ?? null,
        created: frontmatter.created || null,
        content: cleanBody,
        raw: text,
      });

      // Crude edge detection: omega body sometimes contains "Linked: [[mem-...]]" or similar.
      // For Phase 1, we just count occurrences of mem-XXXX references that aren't self.
      const linkMatches = body.matchAll(/\bmem-[a-f0-9]{8,}\b/g);
      for (const lm of linkMatches) {
        if (lm[0] !== frontmatter.id) {
          edges.push({ from: frontmatter.id, to: lm[0] });
        }
      }
    }
  }

  return { memories, edges };
}

// ---------------------------------------------------------------------------
// Classification + partitioning
// ---------------------------------------------------------------------------

function buildKnownProjects(memories, currentProject) {
  const slugs = new Set();
  if (currentProject) slugs.add(currentProject);
  for (const m of memories) {
    const { canonical, kind } = canonicalizeProjectKey(m.project);
    if (kind === 'project' && canonical) slugs.add(canonical);
  }
  return slugs;
}

function classifyMemories(memories, currentProject) {
  const buckets = {
    thisProject: [],
    crossProject: new Map(),
    unscoped: [],
    agent: [],
  };

  for (const m of memories) {
    const { canonical, kind } = canonicalizeProjectKey(m.project);
    if (kind === 'unscoped') {
      buckets.unscoped.push(m);
    } else if (kind === 'agent') {
      buckets.agent.push(m);
    } else if (canonical === currentProject) {
      buckets.thisProject.push(m);
    } else {
      if (!buckets.crossProject.has(canonical)) buckets.crossProject.set(canonical, []);
      buckets.crossProject.get(canonical).push(m);
    }
  }

  return buckets;
}

function topicFor(memory) {
  return TYPE_TO_TOPIC[memory.type] || 'lessons';
}

function safeSlugForFilename(slug) {
  return slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'unknown';
}

function partitionToTopics(buckets) {
  const topics = new Map();
  const ensure = (name) => {
    if (!topics.has(name)) topics.set(name, []);
    return topics.get(name);
  };

  for (const m of buckets.thisProject) ensure(topicFor(m)).push(m);
  for (const m of buckets.unscoped) ensure('unscoped').push(m);
  for (const m of buckets.agent) ensure('subagent-residue').push(m);

  for (const [slug, mems] of buckets.crossProject.entries()) {
    const topicName = `cross-${safeSlugForFilename(slug)}`;
    const list = ensure(topicName);
    for (const m of mems) list.push({ ...m, _crossProjectSlug: slug });
  }

  return topics;
}

function sortByCreatedDesc(memories) {
  return [...memories].sort((a, b) => {
    const ta = a.created ? Date.parse(a.created) : 0;
    const tb = b.created ? Date.parse(b.created) : 0;
    return tb - ta;
  });
}

function memoryToMarkdown(m) {
  const dt = m.created ? m.created.slice(0, 10) : 'undated';
  const proj = m._crossProjectSlug ? ` _(from ${m._crossProjectSlug})_` : '';
  return `### ${dt} — ${m.type}${proj}\n\n${m.content}\n\n_source: omega ${m.id}_\n`;
}

function buildTopicFileContent(topic, memories) {
  const sorted = sortByCreatedDesc(memories);
  const header = `# ${topic.replace(/-/g, ' ')}\n\n`;
  const description = describeTopic(topic);
  const desc = description ? `_${description}_\n\n` : '';
  const entries = sorted.map(memoryToMarkdown).join('\n');
  return header + desc + entries;
}

function shardTopic(topic, memories) {
  const sorted = sortByCreatedDesc(memories);
  if (Buffer.byteLength(buildTopicFileContent(topic, sorted), 'utf8') <= TOPIC_FILE_SIZE_CAP) {
    return [{ suffix: '', memories: sorted }];
  }

  const now = Date.now();
  const recent = sorted.filter((m) => {
    const t = m.created ? Date.parse(m.created) : 0;
    return now - t <= RECENT_DAYS * MS_PER_DAY;
  });
  const archive = sorted.filter((m) => {
    const t = m.created ? Date.parse(m.created) : 0;
    return now - t > RECENT_DAYS * MS_PER_DAY;
  });

  const buckets = [];
  if (recent.length > 0) buckets.push({ label: 'recent', memories: recent });
  if (archive.length > 0) buckets.push({ label: 'archive', memories: archive });

  const fitsCap = (mems) => Buffer.byteLength(buildTopicFileContent(topic, mems), 'utf8') <= TOPIC_FILE_SIZE_CAP;

  const shards = [];
  for (const bucket of buckets) {
    const queue = [bucket.memories];
    let part = 0;
    while (queue.length > 0) {
      const chunk = queue.shift();
      if (chunk.length === 0) continue;
      if (fitsCap(chunk) || chunk.length === 1) {
        const suffix = part === 0 ? `-${bucket.label}` : `-${bucket.label}-${part + 1}`;
        shards.push({ suffix, memories: chunk });
        part++;
        continue;
      }
      const half = Math.ceil(chunk.length / 2);
      queue.unshift(chunk.slice(half), chunk.slice(0, half));
    }
  }

  return shards;
}

// ---------------------------------------------------------------------------
// MEMORY.md index with overflow algorithm
// ---------------------------------------------------------------------------

function buildVerboseIndex(topicFiles, summary) {
  const lines = [
    PREAMBLE_MARKER,
    '# Memory Index',
    '',
    `_Source: migrated from omega on ${new Date().toISOString().slice(0, 10)}._`,
    `_${summary.migrated} memories migrated; ${summary.edges} edges captured in edges.json._`,
    '',
    '## Topic files',
    '',
  ];

  for (const { topic, file, count } of topicFiles) {
    const desc = describeTopic(topic);
    lines.push(`- **${file}** (${count} entries) — ${desc}`);
  }

  return lines.join('\n') + '\n';
}

function buildCategoryIndex(topicFiles, summary) {
  const recent = [];
  const reference = [];
  const archive = [];
  for (const tf of topicFiles) {
    if (tf.file.endsWith('-archive.md')) archive.push(tf);
    else if (tf.file.endsWith('-recent.md')) recent.push(tf);
    else reference.push(tf);
  }

  const lines = [
    PREAMBLE_MARKER,
    '# Memory Index',
    '',
    `_Source: migrated from omega on ${new Date().toISOString().slice(0, 10)}._`,
    `_${summary.migrated} memories migrated; ${summary.edges} edges captured in edges.json._`,
    '',
  ];
  if (recent.length > 0) {
    lines.push('## Recent');
    for (const tf of recent) lines.push(`- ${tf.file} (${tf.count})`);
    lines.push('');
  }
  if (reference.length > 0) {
    lines.push('## Reference');
    for (const tf of reference) lines.push(`- ${tf.file} (${tf.count})`);
    lines.push('');
  }
  if (archive.length > 0) {
    lines.push('## Archive');
    for (const tf of archive) lines.push(`- ${tf.file} (${tf.count})`);
    lines.push('');
  }

  return lines.join('\n');
}

function buildMemoryMd(topicFiles, summary) {
  const verbose = buildVerboseIndex(topicFiles, summary);
  const verboseLines = verbose.split('\n').length;
  const verboseBytes = Buffer.byteLength(verbose, 'utf8');
  if (verboseLines <= 180 && verboseBytes <= 22_000) return verbose;

  const category = buildCategoryIndex(topicFiles, summary);
  const catLines = category.split('\n').length;
  const catBytes = Buffer.byteLength(category, 'utf8');
  if (catLines > MEMORY_MD_LINE_CAP || catBytes > MEMORY_MD_BYTE_CAP) {
    throw new Error(
      `MEMORY.md too large even with category grouping: ${catLines} lines, ${catBytes} bytes. Reduce topic file count or shorten descriptions.`
    );
  }
  return category;
}

// ---------------------------------------------------------------------------
// Idempotency + collision policy
// ---------------------------------------------------------------------------

function checkExistingMigration(outputDir) {
  const memoryMdPath = path.join(outputDir, 'MEMORY.md');
  if (!fs.existsSync(outputDir)) return { state: 'empty' };
  if (!fs.existsSync(memoryMdPath)) {
    const entries = fs.readdirSync(outputDir).filter((f) => !f.startsWith('.'));
    if (entries.length === 0) return { state: 'empty' };
    return { state: 'partial-or-foreign', files: entries };
  }
  const memoryMd = fs.readFileSync(memoryMdPath, 'utf8');
  if (memoryMd.includes(PREAMBLE_MARKER)) return { state: 'migrated' };
  return { state: 'foreign-content' };
}

// ---------------------------------------------------------------------------
// Atomic write via staging dir
// ---------------------------------------------------------------------------

function writeStaging(stagingDir, files) {
  fs.mkdirSync(stagingDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(stagingDir, name), content, 'utf8');
  }
}

function commitStaging(stagingDir, outputDir, { force = false } = {}) {
  fs.mkdirSync(path.dirname(outputDir), { recursive: true });

  if (fs.existsSync(outputDir)) {
    const remaining = fs.readdirSync(outputDir).filter((f) => !f.startsWith('.'));
    if (remaining.length === 0) {
      fs.rmdirSync(outputDir);
    } else if (force) {
      fs.rmSync(outputDir, { recursive: true });
    } else {
      throw new Error(
        `commitStaging: ${outputDir} is not empty (${remaining.length} entries). Collision check should have refused earlier.`
      );
    }
  }

  fs.renameSync(stagingDir, outputDir);
}

// ---------------------------------------------------------------------------
// Edges sidecar
// ---------------------------------------------------------------------------

function buildEdgesJson(edges) {
  return JSON.stringify(
    {
      source: 'omega export-obsidian',
      generated: new Date().toISOString(),
      count: edges.length,
      edges,
    },
    null,
    2
  );
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

async function migrateFromOmega(opts = {}) {
  const omegaBin = resolveOmegaBin(opts);
  if (!omegaPresent(omegaBin)) {
    return { migrated: 0, reason: 'no-omega', omegaBin };
  }

  const cwd = opts.cwd || process.cwd();
  const homeDir = opts.homeDir || os.homedir();
  const currentProject = opts.currentProject || resolveCurrentProject(cwd, homeDir);
  const outputDir = resolveOutputDir({ ...opts, cwd, homeDir });

  if (!opts.force) {
    const existing = checkExistingMigration(outputDir);
    if (existing.state === 'migrated') {
      return { migrated: 0, reason: 'already-migrated', outputDir };
    }
    if (existing.state === 'foreign-content' || existing.state === 'partial-or-foreign') {
      return {
        migrated: 0,
        reason: existing.state,
        outputDir,
        details: existing.files || ['MEMORY.md without migration preamble'],
        hint: 'Inspect outputDir. If safe to overwrite, re-run with { force: true }.',
      };
    }
  }

  const env = opts.omegaDbPath ? { OMEGA_DB: opts.omegaDbPath } : null;
  const { tmpRoot, vaultDir } = exportOmegaToTmp(omegaBin, env);

  try {
    const { memories, edges } = readVault(vaultDir);

    if (memories.length === 0) {
      const minimalIndex = `${PREAMBLE_MARKER}\n# Memory Index\n\n_Source: migrated from omega on ${new Date()
        .toISOString()
        .slice(0, 10)}. No prior memories migrated — omega database was empty._\n`;

      const stagingDir = path.join(path.dirname(outputDir), STAGING_PREFIX + process.pid);
      if (opts.dryRun) {
        return {
          migrated: 0,
          reason: 'empty-db',
          outputDir,
          dryRun: true,
          memoryMdPreview: minimalIndex,
        };
      }
      writeStaging(stagingDir, { 'MEMORY.md': minimalIndex });
      commitStaging(stagingDir, outputDir);
      return { migrated: 0, reason: 'empty-db', outputDir };
    }

    const buckets = classifyMemories(memories, currentProject);
    const baseTopics = partitionToTopics(buckets);

    for (const t of BASE_TOPICS) {
      if (!baseTopics.has(t)) baseTopics.set(t, []);
    }

    const filesToWrite = {};
    const topicFileMeta = [];
    for (const [topic, mems] of baseTopics.entries()) {
      const shards = shardTopic(topic, mems);
      for (const shard of shards) {
        const fileName = `${topic}${shard.suffix}.md`;
        const content = buildTopicFileContent(topic, shard.memories);
        filesToWrite[fileName] = content;
        topicFileMeta.push({ topic: `${topic}${shard.suffix}`, file: fileName, count: shard.memories.length });
      }
    }

    const summary = {
      migrated: memories.length,
      edges: edges.length,
      topicFileCount: topicFileMeta.length,
    };

    if (topicFileMeta.length > 50) {
      throw new Error(`Topic file count ${topicFileMeta.length} exceeds soft max of 50. Investigate fragmentation.`);
    }

    const memoryMd = buildMemoryMd(topicFileMeta, summary);
    filesToWrite['MEMORY.md'] = memoryMd;

    if (edges.length > 0) {
      filesToWrite['edges.json'] = buildEdgesJson(edges);
    }

    if (opts.dryRun) {
      return {
        migrated: memories.length,
        edges: edges.length,
        outputDir,
        dryRun: true,
        topicFiles: topicFileMeta,
        memoryMdPreview: memoryMd,
        omegaBin,
        currentProject,
      };
    }

    const stagingDir = path.join(path.dirname(outputDir), STAGING_PREFIX + process.pid);
    writeStaging(stagingDir, filesToWrite);
    commitStaging(stagingDir, outputDir, { force: opts.force });

    return {
      migrated: memories.length,
      edges: edges.length,
      outputDir,
      topicFiles: topicFileMeta,
      currentProject,
    };
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

module.exports = {
  migrateFromOmega,
  canonicalizeProjectKey,
  resolveCurrentProject,
  resolveOutputDir,
  PREAMBLE_MARKER,
  TYPE_TO_TOPIC,
};
