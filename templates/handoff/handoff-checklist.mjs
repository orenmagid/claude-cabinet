import { readFile, writeFile, rename } from 'node:fs/promises';

const VALID_KINDS = ['decide', 'provide', 'confirm', 'credential'];
const VALID_TRANSPORT_TYPES = ['email', 'mcp', 'file'];

export function validateChecklist(checklist) {
  const errors = [];

  if (!checklist.meta) errors.push('Missing "meta" section');
  else {
    if (!checklist.meta.title) errors.push('meta.title is required');
    if (!checklist.meta.public_key) errors.push('meta.public_key is required');
  }

  if (!checklist.transport) {
    errors.push('Missing "transport" section');
  } else if (!VALID_TRANSPORT_TYPES.includes(checklist.transport.type)) {
    errors.push(`transport.type must be one of: ${VALID_TRANSPORT_TYPES.join(', ')}`);
  }

  if (!Array.isArray(checklist.sections)) {
    errors.push('Missing or invalid "sections" array');
    return { valid: false, errors };
  }

  // First pass: collect all keys for cross-section dependency validation
  const allKeys = new Set();
  for (const section of checklist.sections) {
    for (const item of (section.items || [])) {
      if (item.key) allKeys.add(item.key);
    }
  }

  const seenKeys = new Set();
  for (const section of checklist.sections) {
    if (!section.key) errors.push('Section missing "key"');
    if (!section.title) errors.push(`Section ${section.key || '?'} missing "title"`);
    if (!Array.isArray(section.items)) {
      errors.push(`Section ${section.key || '?'} missing "items" array`);
      continue;
    }
    for (const item of section.items) {
      if (!item.key) { errors.push('Item missing "key"'); continue; }
      if (!item.prompt) errors.push(`Item ${item.key} missing "prompt"`);
      if (!VALID_KINDS.includes(item.kind)) {
        errors.push(`Item ${item.key}: kind must be one of: ${VALID_KINDS.join(', ')}`);
      }
      if (seenKeys.has(item.key)) errors.push(`Duplicate item key: ${item.key}`);
      seenKeys.add(item.key);

      if (item.visibility) {
        if (!item.visibility.depends_on) errors.push(`Item ${item.key}: visibility.depends_on is required`);
        if (!Array.isArray(item.visibility.value_in)) errors.push(`Item ${item.key}: visibility.value_in must be an array`);
        if (item.visibility.depends_on && !allKeys.has(item.visibility.depends_on)) {
          errors.push(`Item ${item.key}: depends_on "${item.visibility.depends_on}" references non-existent key`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function getAllItems(checklist) {
  return (checklist.sections || []).flatMap(s => s.items || []);
}

export function detectCycles(checklist) {
  const items = getAllItems(checklist);
  const keySet = new Set(items.map(i => i.key));
  const graph = new Map();
  const inDegree = new Map();

  for (const item of items) {
    graph.set(item.key, []);
    inDegree.set(item.key, 0);
  }

  for (const item of items) {
    const parent = item.visibility?.depends_on;
    if (parent && keySet.has(parent)) {
      graph.get(parent).push(item.key);
      inDegree.set(item.key, inDegree.get(item.key) + 1);
    }
  }

  const queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([k]) => k);
  let processed = 0;

  while (queue.length > 0) {
    const key = queue.shift();
    processed++;
    for (const child of graph.get(key) || []) {
      const nd = inDegree.get(child) - 1;
      inDegree.set(child, nd);
      if (nd === 0) queue.push(child);
    }
  }

  const hasCycle = processed < items.length;
  const cycleKeys = hasCycle
    ? [...inDegree.entries()].filter(([, d]) => d > 0).map(([k]) => k)
    : [];

  return { hasCycle, cycleKeys };
}

export function computeVisibility(checklist, answers) {
  const items = getAllItems(checklist);
  const visible = new Set();

  for (const item of items) {
    if (!item.visibility) visible.add(item.key);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const item of items) {
      if (visible.has(item.key) || !item.visibility) continue;
      const parentKey = item.visibility.depends_on;
      if (!visible.has(parentKey)) continue;
      const parentAnswer = answers[parentKey]?.value;
      if (parentAnswer && item.visibility.value_in.includes(parentAnswer)) {
        visible.add(item.key);
        changed = true;
      }
    }
  }

  return visible;
}

export async function loadState(path) {
  try {
    return JSON.parse(await readFile(path, 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export function createState(checklistPath) {
  return {
    checklist: checklistPath,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    answers: {},
  };
}

export async function saveState(path, state) {
  state.updated_at = new Date().toISOString();
  const tmp = path + '.tmp';
  await writeFile(tmp, JSON.stringify(state, null, 2));
  await rename(tmp, path);
}

export function recordAnswer(state, key, value) {
  state.answers[key] = { value, answered_at: new Date().toISOString() };
}

export function recordCredentialSent(state, key, envelopeId) {
  state.answers[key] = { status: 'sent', envelope_id: envelopeId, sent_at: new Date().toISOString() };
}

export function getProgress(checklist, state) {
  const answers = state?.answers || {};
  const visible = computeVisibility(checklist, answers);
  const completed = [...visible].filter(key => answers[key]).length;
  return { total: visible.size, completed, remaining: visible.size - completed };
}
