const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { read: readMetadata, METADATA_FILE } = require('./metadata');
const { DEFAULT_HOOKS } = require('./settings-merge');

// CC-managed hook command patterns — used to identify hooks to remove
const CC_HOOK_PATTERNS = [
  '.claude/hooks/git-guardrails.sh',
  '.claude/hooks/skill-telemetry.sh',
  '.claude/hooks/skill-tool-telemetry.sh',
];

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Reconstruct manifest from module list for 0.1.x installs that lack one.
 * Maps module names to their expected template paths using the MODULES
 * definition from cli.js. Returns a best-effort manifest with no hashes.
 */
function reconstructManifest(metadata) {
  // We don't import MODULES to avoid circular deps — use a static mapping
  // that covers the known 0.1.x template structure.
  console.log('  ⚠ No manifest found (0.1.x install). Reconstructing from modules...');
  console.log('    All files will be treated as unmodified (no hash data).\n');
  return {};
}

/**
 * Remove CC files from a project using the manifest for safety.
 *
 * For each manifest entry:
 * - Hash matches → remove (unmodified CC file)
 * - Hash differs → skip with [CUSTOMIZED] warning (unless --force)
 * - File missing → skip (already removed)
 *
 * Files NOT in the manifest are left alone (user-created, onboard-generated).
 */
async function reset(projectDir, { dryRun = false, force = false } = {}) {
  console.log('');
  console.log('  🗄️  Claude Cabinet — Reset');
  console.log('');

  if (dryRun) {
    console.log('  [dry run — no files will be removed]\n');
  }

  const metadata = readMetadata(projectDir);
  if (!metadata) {
    console.log('  No .ccrc.json found — nothing to reset.');
    return;
  }

  console.log(`  Found installation (v${metadata.version}, installed ${metadata.installedAt.split('T')[0]})`);
  console.log('');

  let manifest = metadata.manifest;
  if (!manifest || Object.keys(manifest).length === 0) {
    manifest = reconstructManifest(metadata);
    if (Object.keys(manifest).length === 0) {
      console.log('  Could not reconstruct manifest. Use --force to remove all CC directories.\n');
      if (!force) return;
    }
  }

  const removed = [];
  const customized = [];
  const missing = [];
  const forced = [];

  // Process each manifest entry
  for (const [relPath, installedHash] of Object.entries(manifest)) {
    const fullPath = path.join(projectDir, relPath);

    if (!fs.existsSync(fullPath)) {
      missing.push(relPath);
      continue;
    }

    const currentContent = fs.readFileSync(fullPath, 'utf8');
    const currentHash = hashContent(currentContent);

    if (currentHash === installedHash) {
      // Unmodified — safe to remove
      if (!dryRun) {
        fs.unlinkSync(fullPath);
        cleanEmptyDirs(path.dirname(fullPath), projectDir);
      }
      removed.push(relPath);
    } else if (force) {
      // Modified but --force used
      if (!dryRun) {
        fs.unlinkSync(fullPath);
        cleanEmptyDirs(path.dirname(fullPath), projectDir);
      }
      forced.push(relPath);
    } else {
      customized.push(relPath);
    }
  }

  // Clean CC hooks from settings.json
  const settingsPath = path.join(projectDir, '.claude', 'settings.json');
  let hooksRemoved = 0;
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (settings.hooks) {
      for (const [event, hookGroups] of Object.entries(settings.hooks)) {
        const filtered = hookGroups.filter(group => {
          const commands = group.hooks.map(h => h.command);
          return !commands.some(cmd => CC_HOOK_PATTERNS.includes(cmd));
        });
        const removedCount = hookGroups.length - filtered.length;
        hooksRemoved += removedCount;
        if (filtered.length === 0) {
          delete settings.hooks[event];
        } else {
          settings.hooks[event] = filtered;
        }
      }
      if (Object.keys(settings.hooks).length === 0) {
        delete settings.hooks;
      }
      if (!dryRun) {
        if (Object.keys(settings).length === 0) {
          fs.unlinkSync(settingsPath);
        } else {
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
        }
      }
    }
  }

  // Remove .ccrc.json last
  const pibrcPath = path.join(projectDir, METADATA_FILE);
  if (!dryRun && fs.existsSync(pibrcPath)) {
    fs.unlinkSync(pibrcPath);
  }

  // Print summary
  if (removed.length > 0) {
    console.log(`  ✅ Removed ${removed.length} unmodified file${removed.length === 1 ? '' : 's'}`);
    for (const f of removed) console.log(`     [REMOVED] ${f}`);
  }

  if (forced.length > 0) {
    console.log(`  ⚠ Force-removed ${forced.length} customized file${forced.length === 1 ? '' : 's'}`);
    for (const f of forced) console.log(`     [FORCED]  ${f}`);
  }

  if (customized.length > 0) {
    console.log(`  ⏭ Skipped ${customized.length} customized file${customized.length === 1 ? '' : 's'} (use --force to remove)`);
    for (const f of customized) console.log(`     [CUSTOMIZED] ${f}`);
  }

  if (missing.length > 0) {
    console.log(`  ℹ ${missing.length} manifest file${missing.length === 1 ? '' : 's'} already removed`);
  }

  if (hooksRemoved > 0) {
    console.log(`  🔧 Removed ${hooksRemoved} CC hook${hooksRemoved === 1 ? '' : 's'} from settings.json`);
  }

  if (!dryRun) {
    console.log(`  📝 Removed ${METADATA_FILE}`);
  }

  console.log('\n  Reset complete.\n');
}

/**
 * Remove empty directories up to (but not including) the stop directory.
 */
function cleanEmptyDirs(dir, stopDir) {
  const resolved = path.resolve(dir);
  const stop = path.resolve(stopDir);

  if (resolved === stop || !resolved.startsWith(stop)) return;

  try {
    const entries = fs.readdirSync(resolved);
    if (entries.length === 0) {
      fs.rmdirSync(resolved);
      cleanEmptyDirs(path.dirname(resolved), stopDir);
    }
  } catch {
    // Directory doesn't exist or not empty — stop
  }
}

module.exports = { reset };
