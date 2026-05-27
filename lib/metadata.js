const fs = require('fs');
const path = require('path');

const METADATA_FILE = '.ccrc.json';
const LEGACY_METADATA_FILE = '.corrc.json';

function metadataPath(projectDir) {
  return path.join(projectDir, METADATA_FILE);
}

function read(projectDir) {
  const file = metadataPath(projectDir);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  // Fall back to legacy manifest from pre-v0.6.0 installs
  const legacyFile = path.join(projectDir, LEGACY_METADATA_FILE);
  if (fs.existsSync(legacyFile)) return JSON.parse(fs.readFileSync(legacyFile, 'utf8'));
  return null;
}

function write(projectDir, data) {
  const file = metadataPath(projectDir);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Shallow-merge `partial` into the existing .ccrc.json and write back.
 * Preserves any unknown top-level keys (e.g., `migrated_from_omega`)
 * that this codepath doesn't know about — critical for cross-codepath
 * fields written by other tools like --migrate-memory.
 *
 * Returns the merged result.
 */
function merge(projectDir, partial) {
  const existing = read(projectDir) || {};
  const data = { ...existing, ...partial };
  write(projectDir, data);
  return data;
}

function create(projectDir, { modules, skipped, version, manifest = {} }) {
  // Read existing first so unknown top-level keys (e.g.
  // `migrated_from_omega` set by --migrate-memory) survive the
  // install/upgrade rewrite. Only the install-specific fields below
  // are reset on each create() call.
  const existing = read(projectDir) || {};
  const data = {
    ...existing,
    version,
    installedAt: new Date().toISOString(),
    upstreamPackage: 'create-claude-cabinet',
    modules: {},
    skipped: {},
    manifest,
  };

  for (const mod of modules) {
    data.modules[mod] = true;
  }
  for (const [mod, reason] of Object.entries(skipped)) {
    data.skipped[mod] = reason;
  }

  write(projectDir, data);
  return data;
}

module.exports = { read, write, merge, create, metadataPath, METADATA_FILE };
