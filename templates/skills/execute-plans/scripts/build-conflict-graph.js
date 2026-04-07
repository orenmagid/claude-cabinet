#!/usr/bin/env node

/**
 * build-conflict-graph.js
 *
 * Reads actions (from stdin as JSON array), parses surface area
 * declarations from notes, builds a conflict graph, and outputs
 * independent sets for parallel execution.
 *
 * Usage:
 *   echo '[{fid, text, notes}, ...]' | node build-conflict-graph.js
 *   echo '[...]' | node build-conflict-graph.js --high-conflict "App.tsx,server.js"
 *
 * Output (JSON):
 *   {
 *     nodes: [{ fid, text, surfaceArea: { files: [], dirs: [] } }],
 *     edges: [{ from, to, reason }],
 *     groups: [[fid, ...], [fid, ...]],  // independent sets (parallel groups)
 *     serial: [fid, ...],                // nodes that conflict with many
 *     unschedulable: [{ fid, text }],    // no surface area declared
 *     fileOverlapMatrix: { "file": ["fid1:Group1", "fid2:Group2"] },
 *     highConflictFiles: ["..."],
 *     warnings: ["..."]
 *   }
 */

const path = require('path');

// Parse --high-conflict flag from argv
const highConflictArg = process.argv.find((a, i) => i > 0 && process.argv[i - 1] === '--high-conflict');
const HIGH_CONFLICT_PATTERNS = highConflictArg
  ? highConflictArg.split(',').map(s => s.trim())
  : [];

function parseSurfaceArea(notes) {
  if (!notes) return null;

  const surfaceMatch = notes.match(/## Surface Area\n([\s\S]*?)(?=\n##|\n*$)/);
  if (!surfaceMatch) return null;

  const section = surfaceMatch[1];
  const files = [];
  const dirs = [];

  for (const line of section.split('\n')) {
    const trimmed = line.trim();

    // Match: - files: path, - file: path (with optional backticks, bold, or (new) marker)
    const fileMatch = trimmed.match(/^-\s*files?:\s*(?:`([^`]+)`|\*\*([^*]+)\*\*|(.+))$/);
    if (fileMatch) {
      const raw = (fileMatch[1] || fileMatch[2] || fileMatch[3]).trim();
      files.push(raw.replace(/\s*\(new\)\s*$/, ''));
      continue;
    }

    // Match: - dirs: path/ , - dir: path/
    const dirMatch = trimmed.match(/^-\s*dirs?:\s*(?:`([^`]+)`|\*\*([^*]+)\*\*|(.+))$/);
    if (dirMatch) {
      const raw = (dirMatch[1] || dirMatch[2] || dirMatch[3]).trim();
      dirs.push(raw.replace(/\/?$/, '/')); // ensure trailing slash
      continue;
    }
  }

  if (files.length === 0 && dirs.length === 0) {
    return null;
  }

  return { files, dirs };
}

function fileInDir(filePath, dirPath) {
  const normalizedFile = path.normalize(filePath);
  const normalizedDir = path.normalize(dirPath);
  return normalizedFile.startsWith(normalizedDir);
}

function dirsOverlap(dir1, dir2) {
  const n1 = path.normalize(dir1);
  const n2 = path.normalize(dir2);
  return n1.startsWith(n2) || n2.startsWith(n1);
}

function findConflict(a, b) {
  // Check file-file overlap
  for (const f1 of a.files) {
    for (const f2 of b.files) {
      if (path.normalize(f1) === path.normalize(f2)) {
        return `shared file: ${f1}`;
      }
    }
  }

  // Check file-dir containment
  for (const f of a.files) {
    for (const d of b.dirs) {
      if (fileInDir(f, d)) return `file ${f} inside dir ${d}`;
    }
  }
  for (const f of b.files) {
    for (const d of a.dirs) {
      if (fileInDir(f, d)) return `file ${f} inside dir ${d}`;
    }
  }

  // Check dir-dir overlap
  for (const d1 of a.dirs) {
    for (const d2 of b.dirs) {
      if (dirsOverlap(d1, d2)) return `overlapping dirs: ${d1} ↔ ${d2}`;
    }
  }

  return null;
}

function greedyColor(nodes, edges) {
  // Build adjacency list
  const adj = new Map();
  for (const node of nodes) {
    adj.set(node.fid, new Set());
  }
  for (const edge of edges) {
    adj.get(edge.from).add(edge.to);
    adj.get(edge.to).add(edge.from);
  }

  // Greedy coloring (sorted by degree descending — high-conflict nodes first)
  const sorted = [...nodes].sort((a, b) => {
    return (adj.get(b.fid)?.size || 0) - (adj.get(a.fid)?.size || 0);
  });

  const colorMap = new Map();
  let maxColor = -1;

  for (const node of sorted) {
    const neighborColors = new Set();
    for (const neighbor of adj.get(node.fid)) {
      if (colorMap.has(neighbor)) {
        neighborColors.add(colorMap.get(neighbor));
      }
    }

    let color = 0;
    while (neighborColors.has(color)) color++;

    colorMap.set(node.fid, color);
    if (color > maxColor) maxColor = color;
  }

  // Group by color
  const groups = [];
  for (let c = 0; c <= maxColor; c++) {
    const group = [];
    for (const [fid, color] of colorMap) {
      if (color === c) group.push(fid);
    }
    if (group.length > 0) groups.push(group);
  }

  // Sort groups by size (largest first — maximize parallelism in early groups)
  groups.sort((a, b) => b.length - a.length);

  return groups;
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  const actions = JSON.parse(input);

  const nodes = [];
  const unschedulable = [];

  for (const action of actions) {
    const surfaceArea = parseSurfaceArea(action.notes);
    if (!surfaceArea) {
      unschedulable.push({ fid: action.fid, text: action.text });
      continue;
    }
    nodes.push({
      fid: action.fid,
      text: action.text,
      surfaceArea
    });
  }

  // Build edges
  const edges = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const reason = findConflict(nodes[i].surfaceArea, nodes[j].surfaceArea);
      if (reason) {
        edges.push({
          from: nodes[i].fid,
          to: nodes[j].fid,
          reason
        });
      }
    }
  }

  // Find independent sets
  const groups = greedyColor(nodes, edges);

  // Identify serial nodes (in groups by themselves AND have many conflicts)
  const serial = [];
  const parallelGroups = [];
  for (const group of groups) {
    if (group.length === 1) {
      const fid = group[0];
      const edgeCount = edges.filter(e => e.from === fid || e.to === fid).length;
      if (edgeCount >= 2) {
        serial.push(fid);
        continue;
      }
    }
    parallelGroups.push(group);
  }

  // Build file overlap matrix: for each file, which plans (and groups) touch it
  const fidToGroup = new Map();
  for (let g = 0; g < parallelGroups.length; g++) {
    for (const fid of parallelGroups[g]) {
      fidToGroup.set(fid, g + 1);
    }
  }
  for (const fid of serial) {
    fidToGroup.set(fid, 'serial');
  }

  const fileOverlapMatrix = {};
  for (const node of nodes) {
    for (const f of node.surfaceArea.files) {
      const norm = path.normalize(f);
      if (!fileOverlapMatrix[norm]) fileOverlapMatrix[norm] = [];
      fileOverlapMatrix[norm].push(`${node.fid}:Group${fidToGroup.get(node.fid)}`);
    }
  }

  // Flag files touched by multiple plans in the SAME group
  const warnings = [];
  for (const [file, plans] of Object.entries(fileOverlapMatrix)) {
    if (plans.length < 2) continue;
    const groupNums = plans.map(p => p.split(':Group')[1]);
    const unique = new Set(groupNums);
    if (unique.size < groupNums.length) {
      warnings.push(`CONFLICT: ${file} touched by ${plans.join(', ')} — same group!`);
    }
  }

  // Identify high-conflict files (project-specific shared entry points)
  const highConflictFiles = Object.keys(fileOverlapMatrix).filter(f => {
    if (fileOverlapMatrix[f].length < 2) return false;
    return HIGH_CONFLICT_PATTERNS.some(pattern => f.endsWith(pattern));
  });

  if (highConflictFiles.length > 0) {
    warnings.push(`High-conflict shared files detected: ${highConflictFiles.join(', ')}. Ensure plans touching these are in different groups.`);
  }

  const result = {
    nodes: nodes.map(n => ({ fid: n.fid, text: n.text, surfaceArea: n.surfaceArea })),
    edges,
    groups: parallelGroups,
    serial,
    unschedulable,
    fileOverlapMatrix,
    highConflictFiles,
    warnings
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
