#!/usr/bin/env node
'use strict';

/**
 * resolve-committees.js — Merge upstream committees.yaml with project committees-project.yaml
 *
 * Usage:
 *   node scripts/resolve-committees.js [path-to-claude-dir]
 *
 * Default path: .claude
 *
 * Reads:
 *   <claude-dir>/cabinet/committees.yaml        (upstream, required)
 *   <claude-dir>/cabinet/committees-project.yaml (project, optional)
 *
 * Merge rules:
 *   - Project `additional_members` appends to upstream member lists
 *   - Project `members` replaces upstream member lists entirely
 *   - Project `skip: true` removes that committee
 *   - Project `name` overrides upstream display name
 *   - New committees in project file are added
 *
 * Outputs merged JSON to stdout.
 */

const fs = require('fs');
const path = require('path');

// --- Simple YAML parser (handles only what we need) ---

function parseSimpleYaml(text) {
  // Our YAML is exactly 3 levels deep with 2-space indentation:
  //   committees:           (indent 0 — top level)
  //     ux:                 (indent 2 — committee name)
  //       name: "UX"       (indent 4 — property)
  //       members:          (indent 4 — property, value is list below)
  //         - usability     (indent 6+ — list item)
  const result = {};
  const lines = text.split('\n');
  let topKey = null;       // e.g., 'committees'
  let committeeKey = null; // e.g., 'ux'
  let propKey = null;      // e.g., 'members'

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
      // Committee name level
      const m = content.match(/^(\w[\w-]*):\s*(.*)$/);
      if (m) {
        committeeKey = m[1];
        const val = m[2].trim();
        if (val === 'true' || val === 'false') {
          result[topKey][committeeKey] = parseValue(val);
        } else {
          result[topKey][committeeKey] = {};
        }
        propKey = null;
      }
    } else if (indent >= 4 && indent < 6 && topKey && committeeKey) {
      // Property level (name, members, additional_members, skip)
      const m = content.match(/^(\w[\w-]*):\s*(.*)$/);
      if (m) {
        propKey = m[1];
        const val = m[2].trim();
        if (val && val !== '') {
          result[topKey][committeeKey][propKey] = parseValue(val);
        } else {
          // Empty value — will be a list (members:) or object
          result[topKey][committeeKey][propKey] = [];
        }
      }
    } else if (indent >= 6 && topKey && committeeKey && propKey) {
      // List item
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

function parseValue(str) {
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (str === 'null') return null;
  // Strip quotes
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  // Try number
  if (/^-?\d+(\.\d+)?$/.test(str)) return Number(str);
  return str;
}

// --- Main ---

function main() {
  const claudeDir = process.argv[2] || '.claude';
  const upstreamPath = path.join(claudeDir, 'cabinet', 'committees.yaml');
  const projectPath = path.join(claudeDir, 'cabinet', 'committees-project.yaml');

  // Read upstream (required)
  if (!fs.existsSync(upstreamPath)) {
    console.error(`Error: Upstream committees file not found at ${upstreamPath}`);
    console.error('');
    console.error('This file is installed by Claude Cabinet and should be at:');
    console.error(`  ${upstreamPath}`);
    console.error('');
    console.error('Run the Claude Cabinet installer to restore it, or check that');
    console.error('the path to your .claude directory is correct.');
    process.exit(1);
  }

  let upstreamText;
  try {
    upstreamText = fs.readFileSync(upstreamPath, 'utf8');
  } catch (err) {
    console.error(`Error reading ${upstreamPath}: ${err.message}`);
    process.exit(1);
  }

  let upstream;
  try {
    upstream = parseSimpleYaml(upstreamText);
  } catch (err) {
    console.error(`Error parsing ${upstreamPath}: ${err.message}`);
    console.error('The file may be malformed. Check that it uses valid YAML syntax.');
    process.exit(1);
  }

  const committees = upstream.committees || {};

  // Read project overrides (optional)
  if (!fs.existsSync(projectPath)) {
    // No project file — output upstream as-is
    console.log(JSON.stringify({ committees }, null, 2));
    return;
  }

  let projectText;
  try {
    projectText = fs.readFileSync(projectPath, 'utf8');
  } catch (err) {
    console.error(`Error reading ${projectPath}: ${err.message}`);
    process.exit(1);
  }

  let project;
  try {
    project = parseSimpleYaml(projectText);
  } catch (err) {
    console.error(`Error parsing ${projectPath}: ${err.message}`);
    console.error('The file may be malformed. Check that it uses valid YAML syntax.');
    process.exit(1);
  }

  const projectCommittees = project.committees || {};

  // Merge
  const merged = Object.assign({}, committees);

  for (const key of Object.keys(projectCommittees)) {
    const projectDef = projectCommittees[key];

    // skip: true removes the committee
    if (projectDef && projectDef.skip === true) {
      delete merged[key];
      continue;
    }

    if (merged[key]) {
      // Existing upstream committee — apply overrides
      if (projectDef.name) {
        merged[key] = Object.assign({}, merged[key], { name: projectDef.name });
      }

      if (Array.isArray(projectDef.members)) {
        // Full replacement
        merged[key] = Object.assign({}, merged[key], { members: projectDef.members });
      } else if (Array.isArray(projectDef.additional_members)) {
        // Append to upstream
        const existing = Array.isArray(merged[key].members) ? merged[key].members : [];
        merged[key] = Object.assign({}, merged[key], {
          members: existing.concat(projectDef.additional_members)
        });
      }
    } else {
      // New committee from project
      merged[key] = {
        name: projectDef.name || key,
        members: Array.isArray(projectDef.members) ? projectDef.members : []
      };
    }
  }

  console.log(JSON.stringify({ committees: merged }, null, 2));
}

main();
