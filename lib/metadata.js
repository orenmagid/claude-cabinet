const fs = require('fs');
const path = require('path');

const METADATA_FILE = '.corrc.json';

function metadataPath(projectDir) {
  return path.join(projectDir, METADATA_FILE);
}

function read(projectDir) {
  const file = metadataPath(projectDir);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
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
