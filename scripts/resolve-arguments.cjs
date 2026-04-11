#!/usr/bin/env node
'use strict';

/**
 * resolve-arguments.cjs — Resolve raw argument string into members and topics
 *
 * Usage:
 *   node scripts/resolve-arguments.cjs "<arguments>" [path-to-claude-dir]
 *
 * Takes a raw argument string (comma or space separated tokens) and resolves
 * each token against:
 *   1. Cabinet member names (cabinet-<name> directories)
 *   2. Committee keys in committees.yaml → expands to member list
 *   3. No match → treated as a topic
 *
 * Outputs JSON to stdout:
 *   { "members": [...], "topics": [...], "source": "arguments" }
 *
 * Examples:
 *   node scripts/resolve-arguments.cjs "security"
 *     → { "members": ["security"], "topics": [], "source": "arguments" }
 *
 *   node scripts/resolve-arguments.cjs "health"
 *     → { "members": ["security", "data-integrity", "speed-freak"], "topics": [], "source": "arguments" }
 *
 *   node scripts/resolve-arguments.cjs "security, architecture"
 *     → { "members": ["security", "architecture"], "topics": [], "source": "arguments" }
 *
 *   node scripts/resolve-arguments.cjs "hooks"
 *     → { "members": [], "topics": ["hooks"], "source": "arguments" }
 */

const fs = require('fs');
const path = require('path');

// --- Simple YAML parser (handles only committees.yaml structure) ---

function parseSimpleYaml(text) {
  const result = {};
  const lines = text.split('\n');
  let topKey = null;
  let committeeKey = null;
  let propKey = null;

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed === '' || /^\s*#/.test(trimmed)) continue;

    const indent = line.length - line.trimStart().length;
    const content = trimmed.trim();

    if (indent === 0) {
      const m = content.match(/^(\w[\w-]*):\s*(.*)$/);
      if (m) {
        topKey = m[1];
        result[topKey] = {};
        committeeKey = null;
        propKey = null;
      }
    } else if (indent >= 2 && indent < 4 && topKey) {
      const m = content.match(/^(\w[\w-]*):\s*(.*)$/);
      if (m) {
        committeeKey = m[1];
        result[topKey][committeeKey] = {};
        propKey = null;
      }
    } else if (indent >= 4 && indent < 6 && topKey && committeeKey) {
      const m = content.match(/^(\w[\w-]*):\s*(.*)$/);
      if (m) {
        propKey = m[1];
        const val = m[2].trim();
        if (val && val !== '') {
          result[topKey][committeeKey][propKey] = val;
        } else {
          result[topKey][committeeKey][propKey] = [];
        }
      }
    } else if (indent >= 6 && topKey && committeeKey && propKey) {
      const m = content.match(/^- (.+)$/);
      if (m) {
        const container = result[topKey][committeeKey];
        if (!Array.isArray(container[propKey])) {
          container[propKey] = [];
        }
        container[propKey].push(m[1].trim());
      }
    }
  }

  return result;
}

// --- Main ---

function main() {
  const rawArgs = process.argv[2] || '';
  const claudeDir = process.argv[3] || '.claude';

  if (!rawArgs.trim()) {
    console.log(JSON.stringify({ members: [], topics: [], source: 'arguments' }));
    return;
  }

  // Tokenize: split on commas, then whitespace, flatten, trim
  const tokens = rawArgs
    .split(/[,]+/)
    .flatMap(part => part.trim().split(/\s+/))
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);

  // Discover cabinet member names from cabinet-* skill directories
  const skillsDir = path.join(claudeDir, 'skills');
  const memberNames = new Set();
  if (fs.existsSync(skillsDir)) {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith('cabinet-')) {
        memberNames.add(entry.name.replace(/^cabinet-/, ''));
      }
    }
  }

  // Load committees from committees.yaml (upstream, merged with project)
  const committees = {};
  const upstreamPath = path.join(claudeDir, 'cabinet', 'committees.yaml');
  if (fs.existsSync(upstreamPath)) {
    try {
      const text = fs.readFileSync(upstreamPath, 'utf8');
      const parsed = parseSimpleYaml(text);
      const cmts = parsed.committees || {};
      for (const key of Object.keys(cmts)) {
        committees[key] = Array.isArray(cmts[key].members) ? cmts[key].members : [];
      }
    } catch (err) {
      console.error(`Warning: could not parse ${upstreamPath}: ${err.message}`);
    }
  }

  // Also merge project committees if available
  const projectPath = path.join(claudeDir, 'cabinet', 'committees-project.yaml');
  if (fs.existsSync(projectPath)) {
    try {
      const text = fs.readFileSync(projectPath, 'utf8');
      const parsed = parseSimpleYaml(text);
      const cmts = parsed.committees || {};
      for (const key of Object.keys(cmts)) {
        if (cmts[key].skip === 'true') {
          delete committees[key];
          continue;
        }
        if (Array.isArray(cmts[key].members)) {
          committees[key] = cmts[key].members;
        } else if (Array.isArray(cmts[key].additional_members)) {
          committees[key] = (committees[key] || []).concat(cmts[key].additional_members);
        } else if (!committees[key]) {
          committees[key] = [];
        }
      }
    } catch (err) {
      console.error(`Warning: could not parse ${projectPath}: ${err.message}`);
    }
  }

  // Resolve each token
  const members = [];
  const topics = [];
  const seenMembers = new Set();

  for (const token of tokens) {
    if (memberNames.has(token)) {
      // Direct member match
      if (!seenMembers.has(token)) {
        members.push(token);
        seenMembers.add(token);
      }
    } else if (committees[token]) {
      // Committee match — expand to members
      for (const member of committees[token]) {
        if (!seenMembers.has(member)) {
          members.push(member);
          seenMembers.add(member);
        }
      }
    } else {
      // No match — treat as topic
      topics.push(token);
    }
  }

  console.log(JSON.stringify({ members, topics, source: 'arguments' }, null, 2));
}

main();
