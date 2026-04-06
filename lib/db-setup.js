const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Set up the PIB database in the target project.
 * - Copies pib-db.js and schema to scripts/
 * - Runs npm init if no package.json
 * - Installs better-sqlite3
 * - Runs pib-db init
 */
function setupDb(projectDir) {
  const scriptsDir = path.join(projectDir, 'scripts');
  const results = [];

  // Check if package.json exists; if not, init
  const pkgPath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.log('  Initializing package.json...');
    execSync('npm init -y', { cwd: projectDir, stdio: 'pipe' });
    results.push('Created package.json');
  }

  // pib-db.js uses ESM imports — ensure package.json has "type": "module"
  // Skip this for the CC source repo itself (its CLI uses CommonJS)
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.type !== 'module' && pkg.name !== 'create-claude-cabinet') {
    pkg.type = 'module';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    results.push('Set package.json type to "module"');
  }

  // Install better-sqlite3 if not already installed
  const nodeModules = path.join(projectDir, 'node_modules', 'better-sqlite3');
  if (!fs.existsSync(nodeModules)) {
    console.log('  Installing better-sqlite3...');
    execSync('npm install better-sqlite3', { cwd: projectDir, stdio: 'pipe' });
    results.push('Installed better-sqlite3');
  }

  // Initialize the database
  const dbScript = path.join(scriptsDir, 'pib-db.js');
  if (fs.existsSync(dbScript)) {
    console.log('  Initializing database...');
    execSync(`node ${dbScript} init`, { cwd: projectDir, stdio: 'pipe' });
    results.push('Initialized pib.db');
  }

  return results;
}

module.exports = { setupDb };
