#!/usr/bin/env node
/**
 * Fake omega CLI for migrate-from-omega.js tests.
 *
 * Selects a fixture by FAKE_OMEGA_FIXTURE env var: empty | small |
 * multi | oversized | with-edges. Writes a vault that matches real
 * omega export-obsidian output structure: <outputDir>/omega-memories/
 * with _index.md + per-type subdirectories (decisions/, memories/).
 *
 * Frontmatter mirrors real omega: id, type, tags, created, strength,
 * project, ttl_seconds. Body ends with a "## Metadata" section.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const cmd = args[0];

if (cmd === 'stats') {
  console.log('Memories: ' + (process.env.FAKE_OMEGA_STATS_COUNT || '10'));
  console.log('DB size: 0.01 MB');
  process.exit(0);
}

if (cmd !== 'export-obsidian') {
  console.error(`fake-omega: unknown command ${cmd}`);
  process.exit(1);
}

let outputDir = null;
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--output-dir') outputDir = args[i + 1];
}
if (!outputDir) {
  console.error('fake-omega: --output-dir required');
  process.exit(1);
}

const fixture = process.env.FAKE_OMEGA_FIXTURE || 'small';
const vaultDir = path.join(outputDir, 'omega-memories');
fs.mkdirSync(path.join(vaultDir, 'decisions'), { recursive: true });
fs.mkdirSync(path.join(vaultDir, 'memories'), { recursive: true });

function makeMemory({ id, type, project, content, created, links }) {
  const fm = [
    '---',
    `id: ${id}`,
    `type: ${type}`,
    `tags: [test, fixture]`,
    `created: ${created}`,
    `strength: 1.00`,
    `project: ${project === null ? 'null' : project}`,
    `ttl_seconds: 7776000`,
    '---',
    '',
  ].join('\n');

  let body = content + '\n';
  if (links && links.length) {
    body += '\nLinked: ' + links.map((l) => `[[${l}]]`).join(', ') + '\n';
  }
  body += '\n## Metadata\n- Access count: 1\n';

  return fm + body;
}

function write(subdir, mem) {
  const file = path.join(vaultDir, subdir, mem.id + '.md');
  fs.writeFileSync(file, makeMemory(mem));
}

function genMemories(fixture) {
  const now = Date.now();
  const isoFor = (daysAgo) => new Date(now - daysAgo * 86_400_000).toISOString();

  switch (fixture) {
    case 'empty':
      return [];

    case 'small':
      return [
        { id: 'mem-aaaaaaaaaa01', type: 'decision', project: 'claude-cabinet', content: 'Chose markdown-first memory.', created: isoFor(2), subdir: 'decisions' },
        { id: 'mem-aaaaaaaaaa02', type: 'lesson_learned', project: 'claude-cabinet', content: 'Learned omega export has wrapper subdir.', created: isoFor(3), subdir: 'memories' },
        { id: 'mem-aaaaaaaaaa03', type: 'constraint', project: 'claude-cabinet', content: 'MEMORY.md 200-line cap.', created: isoFor(5), subdir: 'memories' },
        { id: 'mem-aaaaaaaaaa04', type: 'user_preference', project: 'claude-cabinet', content: 'Prefer terse responses.', created: isoFor(10), subdir: 'memories' },
        { id: 'mem-aaaaaaaaaa05', type: 'session_summary', project: 'claude-cabinet', content: 'Session worked on omega winddown.', created: isoFor(1), subdir: 'memories' },
        { id: 'mem-aaaaaaaaaa06', type: 'lesson', project: 'claude-cabinet', content: 'Type field is event_type.', created: isoFor(4), subdir: 'memories' },
        { id: 'mem-aaaaaaaaaa07', type: 'error_pattern', project: 'claude-cabinet', content: 'ESM type:module breaks CLI.', created: isoFor(20), subdir: 'memories' },
        { id: 'mem-aaaaaaaaaa08', type: 'advisor_insight', project: 'claude-cabinet', content: 'Cabinet critique catches gaps.', created: isoFor(7), subdir: 'memories' },
      ];

    case 'multi':
      return [
        { id: 'mem-bbbbbbbbbb01', type: 'decision', project: 'claude-cabinet', content: 'CC bare slug.', created: isoFor(1), subdir: 'decisions' },
        { id: 'mem-bbbbbbbbbb02', type: 'decision', project: '/Users/test/claude-cabinet', content: 'CC absolute path.', created: isoFor(2), subdir: 'decisions' },
        { id: 'mem-bbbbbbbbbb03', type: 'lesson', project: '/Users/test/claude-cabinet/.claude/worktrees/foo', content: 'Worktree path.', created: isoFor(3), subdir: 'memories' },
        { id: 'mem-bbbbbbbbbb04', type: 'lesson', project: '/Users/test/claude-cabinet/some/subdir', content: 'Subdir path.', created: isoFor(4), subdir: 'memories' },
        { id: 'mem-bbbbbbbbbb05', type: 'decision', project: 'flow', content: 'Other project.', created: isoFor(5), subdir: 'decisions' },
        { id: 'mem-bbbbbbbbbb06', type: 'lesson', project: '/Users/test/flow', content: 'Other project abs.', created: isoFor(6), subdir: 'memories' },
        { id: 'mem-bbbbbbbbbb07', type: 'lesson', project: '/Users/test/flow/areas/school', content: 'Other project deep subdir.', created: isoFor(7), subdir: 'memories' },
        { id: 'mem-bbbbbbbbbb08', type: 'lesson', project: 'agent-deadbeef', content: 'Agent memory.', created: isoFor(8), subdir: 'memories' },
        { id: 'mem-bbbbbbbbbb09', type: 'constraint', project: null, content: 'Null-project memory.', created: isoFor(9), subdir: 'memories' },
      ];

    case 'oversized': {
      const out = [];
      const filler = 'x'.repeat(1800);
      for (let i = 0; i < 80; i++) {
        out.push({
          id: 'mem-cccccccc' + i.toString().padStart(4, '0'),
          type: i % 2 === 0 ? 'lesson_learned' : 'decision',
          project: 'claude-cabinet',
          content: `Memory ${i}: ${filler}`,
          created: isoFor(i * 3),
          subdir: i % 2 === 0 ? 'memories' : 'decisions',
        });
      }
      return out;
    }

    case 'with-edges':
      return [
        { id: 'mem-eeeeeeeeee01', type: 'decision', project: 'claude-cabinet', content: 'First decision.', created: isoFor(1), subdir: 'decisions', links: ['mem-eeeeeeeeee02'] },
        { id: 'mem-eeeeeeeeee02', type: 'lesson', project: 'claude-cabinet', content: 'Follows from first.', created: isoFor(2), subdir: 'memories', links: ['mem-eeeeeeeeee01'] },
      ];

    default:
      throw new Error(`unknown fixture: ${fixture}`);
  }
}

const memories = genMemories(fixture);
for (const m of memories) write(m.subdir, m);

const byType = new Map();
for (const m of memories) byType.set(m.type, (byType.get(m.type) || 0) + 1);
const indexLines = [
  '---',
  'title: OMEGA Memory Index',
  `generated: ${new Date().toISOString()}`,
  `total_memories: ${memories.length}`,
  '---',
  '',
  '# OMEGA Memory Index',
  '',
  `**Total memories:** ${memories.length}`,
  '',
  '## By Type',
  '',
  '| Type | Count |',
  '|------|-------|',
];
for (const [t, c] of byType.entries()) indexLines.push(`| ${t} | ${c} |`);
fs.writeFileSync(path.join(vaultDir, '_index.md'), indexLines.join('\n') + '\n');

console.log(`Exported ${memories.length} memories (fixture: ${fixture}) to ${outputDir}`);
