const fs = require('fs');
const path = require('path');
const prompts = require('prompts');

/**
 * Recursively copy files from src to dest, surfacing conflicts.
 * Returns { copied: string[], skipped: string[], overwritten: string[] }
 */
async function copyTemplates(src, dest, { dryRun = false, skipConflicts = false, skipPhases = false } = {}) {
  const results = { copied: [], skipped: [], overwritten: [] };
  await walkAndCopy(src, dest, src, results, dryRun, skipConflicts, skipPhases);
  return results;
}

async function walkAndCopy(srcRoot, destRoot, currentSrc, results, dryRun, skipConflicts, skipPhases) {
  const entries = fs.readdirSync(currentSrc, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(currentSrc, entry.name);
    const relPath = path.relative(srcRoot, srcPath);
    const destPath = path.join(destRoot, relPath);

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
      await walkAndCopy(srcRoot, destRoot, srcPath, results, dryRun, skipConflicts, skipPhases);
    } else {
      if (fs.existsSync(destPath)) {
        const existing = fs.readFileSync(destPath, 'utf8');
        const incoming = fs.readFileSync(srcPath, 'utf8');

        if (existing === incoming) {
          results.skipped.push(relPath);
          continue;
        }

        if (skipConflicts) {
          results.skipped.push(relPath);
          continue;
        }

        const response = await prompts({
          type: 'select',
          name: 'action',
          message: `File exists: ${relPath}`,
          choices: [
            { title: 'Keep existing', value: 'keep' },
            { title: 'Overwrite with template', value: 'overwrite' },
            { title: 'Show diff', value: 'diff' },
          ],
        });

        if (!response.action) {
          // User cancelled
          results.skipped.push(relPath);
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
        } else if (response.action === 'overwrite') {
          if (!dryRun) fs.copyFileSync(srcPath, destPath);
          results.overwritten.push(relPath);
        } else {
          results.skipped.push(relPath);
        }
      } else {
        if (!dryRun) {
          const dir = path.dirname(destPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.copyFileSync(srcPath, destPath);
        }
        results.copied.push(relPath);
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
