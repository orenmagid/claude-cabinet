const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const prompts = require('prompts');

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Recursively copy files from src to dest, surfacing conflicts.
 * Returns { copied: string[], skipped: string[], overwritten: string[] }
 */
async function copyTemplates(src, dest, { dryRun = false, skipConflicts = false, skipPhases = false, projectRoot = null, existingManifest = {} } = {}) {
  const results = { copied: [], skipped: [], overwritten: [], manifest: {} };
  await walkAndCopy(src, dest, src, results, dryRun, skipConflicts, skipPhases, projectRoot, existingManifest);
  return results;
}

async function walkAndCopy(srcRoot, destRoot, currentSrc, results, dryRun, skipConflicts, skipPhases, projectRoot, existingManifest) {
  const entries = fs.readdirSync(currentSrc, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(currentSrc, entry.name);
    const relPath = path.relative(srcRoot, srcPath);
    const destPath = path.join(destRoot, relPath);
    // Display path relative to project root for clearer conflict prompts
    const displayPath = projectRoot ? path.relative(projectRoot, destPath) : relPath;

    if (entry.isDirectory()) {
      // Skip phases/ directories — absent phase files use skeleton defaults,
      // which is the correct behavior for most adopters. Phase files are
      // only created when the user customizes behavior via /onboard.
      if (skipPhases && entry.name === 'phases') {
        continue;
      }
      if (!dryRun && !fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      await walkAndCopy(srcRoot, destRoot, srcPath, results, dryRun, skipConflicts, skipPhases, projectRoot, existingManifest);
    } else {
      const incoming = fs.readFileSync(srcPath, 'utf8');
      const incomingHash = hashContent(incoming);

      if (fs.existsSync(destPath)) {
        const existing = fs.readFileSync(destPath, 'utf8');

        // Phase file guard (act:98d74381) — independent of skipPhases flag.
        // If a phase file on disk has been customized (differs from template
        // and isn't empty), never overwrite it regardless of other flags.
        if (relPath.includes('phases' + path.sep) || relPath.includes('phases/')) {
          const trimmedExisting = existing.trim();
          if (trimmedExisting !== '' && trimmedExisting !== incoming.trim()) {
            results.skipped.push(relPath);
            results.manifest[relPath] = hashContent(existing);
            console.log(`  Preserved customized phase: ${displayPath}`);
            continue;
          }
        }

        if (existing === incoming) {
          results.skipped.push(relPath);
          results.manifest[relPath] = incomingHash;
          continue;
        }

        if (skipConflicts) {
          // Check if file is upstream-managed (in the old manifest).
          // If so, overwrite — it can't be customized (hook enforces this).
          // If not, skip — it's project-created content.
          const manifestKey = projectRoot
            ? path.relative(projectRoot, destPath)
            : relPath;
          if (existingManifest[manifestKey]) {
            if (!dryRun) fs.copyFileSync(srcPath, destPath);
            results.overwritten.push(relPath);
            results.manifest[relPath] = incomingHash;
            console.log(`  Updated: ${displayPath}`);
          } else {
            results.skipped.push(relPath);
            // Record the hash of what's actually on disk, not the template —
            // otherwise the manifest lies about file content after a skip.
            results.manifest[relPath] = hashContent(existing);
          }
          continue;
        }

        const response = await prompts({
          type: 'select',
          name: 'action',
          message: `File exists: ${displayPath}`,
          choices: [
            { title: 'Keep existing', value: 'keep' },
            { title: 'Overwrite with template', value: 'overwrite' },
            { title: 'Show diff', value: 'diff' },
          ],
        });

        if (!response.action) {
          // User cancelled
          results.skipped.push(relPath);
          results.manifest[relPath] = incomingHash;
          continue;
        }

        if (response.action === 'diff') {
          showDiff(existing, incoming, relPath);
          const followUp = await prompts({
            type: 'confirm',
            name: 'overwrite',
            message: `Overwrite ${relPath}?`,
            initial: false,
          });
          if (followUp.overwrite && !dryRun) {
            fs.copyFileSync(srcPath, destPath);
            results.overwritten.push(relPath);
          } else {
            results.skipped.push(relPath);
          }
          results.manifest[relPath] = incomingHash;
        } else if (response.action === 'overwrite') {
          if (!dryRun) fs.copyFileSync(srcPath, destPath);
          results.overwritten.push(relPath);
          results.manifest[relPath] = incomingHash;
        } else {
          results.skipped.push(relPath);
          results.manifest[relPath] = incomingHash;
        }
      } else {
        if (!dryRun) {
          const dir = path.dirname(destPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.copyFileSync(srcPath, destPath);
        }
        results.copied.push(relPath);
        results.manifest[relPath] = incomingHash;
      }
    }
  }
}

function showDiff(existing, incoming, relPath) {
  const existingLines = existing.split('\n');
  const incomingLines = incoming.split('\n');

  console.log(`\n--- ${relPath} (existing)`);
  console.log(`+++ ${relPath} (template)`);
  console.log('');

  // Simple line-by-line comparison
  const maxLines = Math.max(existingLines.length, incomingLines.length);
  for (let i = 0; i < maxLines; i++) {
    const a = existingLines[i];
    const b = incomingLines[i];
    if (a === b) continue;
    if (a !== undefined && b !== undefined) {
      console.log(`  ${i + 1}: - ${a}`);
      console.log(`  ${i + 1}: + ${b}`);
    } else if (a !== undefined) {
      console.log(`  ${i + 1}: - ${a}`);
    } else {
      console.log(`  ${i + 1}: + ${b}`);
    }
  }
  console.log('');
}

module.exports = { copyTemplates };
