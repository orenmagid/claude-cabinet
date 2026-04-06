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

function create(projectDir, { modules, skipped, version, manifest = {} }) {
  const data = {
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

module.exports = { read, write, create, metadataPath, METADATA_FILE };
