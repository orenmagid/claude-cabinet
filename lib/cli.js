const prompts = require('prompts');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { copyTemplates } = require('./copy');
const { mergeSettings } = require('./settings-merge');
const { create: createMetadata, read: readMetadata } = require('./metadata');
const { setupDb } = require('./db-setup');
const { reset } = require('./reset');

const VERSION = require('../package.json').version;

const MODULES = {
  'session-loop': {
    name: 'Session Loop (orient + debrief)',
    description: 'The briefing cycle. Claude starts each session informed, ends by preparing the next briefing.',
    mandatory: true,
    templates: ['skills/orient', 'skills/orient-quick', 'skills/debrief', 'skills/debrief-quick', 'skills/debrief/phases/upstream-feedback.md', 'skills/menu', 'hooks/stop-hook.md'],
  },
  'hooks': {
    name: 'Git Guardrails + Telemetry',
    description: 'Block destructive git ops (force push, hard reset). Track skill usage via JSONL telemetry.',
    mandatory: false,
    default: true,
    lean: true,
    templates: ['hooks/git-guardrails.sh', 'hooks/cc-upstream-guard.sh', 'hooks/skill-telemetry.sh', 'hooks/skill-tool-telemetry.sh', 'scripts/cc-drift-check.cjs'],
  },
  'work-tracking': {
    name: 'Work Tracking (pib-db or markdown)',
    description: 'Track work items for orient/debrief. Default: SQLite (pib-db). Also supports markdown (tasks.md) or external systems. Choice made during /onboard.',
    mandatory: false,
    default: true,
    lean: false,
    templates: ['scripts/pib-db.js', 'scripts/pib-db-schema.sql'],
    needsDb: true,
  },
  'planning': {
    name: 'Planning + Execution (plan + execute)',
    description: 'Structured planning with cabinet critique — members weigh in before you build.',
    mandatory: false,
    default: true,
    lean: true,
    templates: ['skills/plan', 'skills/execute', 'skills/investigate'],
  },
  'compliance': {
    name: 'Compliance Stack (rules + enforcement)',
    description: 'Scoped instructions that load by path. Enforcement pipeline for promoting patterns to rules.',
    mandatory: false,
    default: true,
    lean: false,
    templates: ['rules/enforcement-pipeline.md', 'memory/patterns/_pattern-template.md', 'memory/patterns/pattern-intelligence-first.md'],
  },
  'audit': {
    name: 'Audit Loop (audit + triage + cabinet)',
    description: '27 expert cabinet members review your project. Convene the full cabinet or just one committee.',
    mandatory: false,
    default: true,
    lean: true,
    templates: [
      'skills/audit', 'skills/pulse', 'skills/triage-audit',
      'cabinet', 'briefing',
      'skills/cabinet-accessibility', 'skills/cabinet-anti-confirmation',
      'skills/cabinet-architecture', 'skills/cabinet-boundary-man',
      'skills/cabinet-cc-health', 'skills/cabinet-data-integrity',
      'skills/cabinet-debugger', 'skills/cabinet-historian',
      'skills/cabinet-organized-mind', 'skills/cabinet-process-therapist',
      'skills/cabinet-qa', 'skills/cabinet-record-keeper',
      'skills/cabinet-roster-check', 'skills/cabinet-security',
      'skills/cabinet-small-screen', 'skills/cabinet-speed-freak',
      'skills/cabinet-system-advocate', 'skills/cabinet-technical-debt',
      'skills/cabinet-usability', 'skills/cabinet-workflow-cop',
      'skills/cabinet-framework-quality', 'skills/cabinet-goal-alignment',
      'skills/cabinet-information-design', 'skills/cabinet-mantine-quality',
      'skills/cabinet-ui-experimentalist', 'skills/cabinet-user-advocate',
      'skills/cabinet-vision',
      'scripts/merge-findings.js', 'scripts/load-triage-history.js',
      'scripts/triage-server.mjs', 'scripts/triage-ui.html',
      'scripts/finding-schema.json', 'scripts/resolve-committees.cjs',
    ],
  },
  'lifecycle': {
    name: 'Lifecycle (onboard + seed + cc-upgrade + link)',
    description: 'Onboarding prepares the briefings. Seed proposes new cabinet members when you adopt new tech.',
    mandatory: false,
    default: true,
    lean: true,
    templates: ['skills/onboard', 'skills/seed', 'skills/cc-upgrade', 'skills/link', 'skills/unlink', 'skills/extract'],
  },
  'validate': {
    name: 'Validate',
    description: 'Structural validation checks with unified summary. Define your own validators.',
    mandatory: false,
    default: true,
    lean: false,
    templates: ['skills/validate'],
  },
};

// Signals that a directory contains a real project (not just empty)
const PROJECT_SIGNALS = [
  'package.json', 'Cargo.toml', 'requirements.txt', 'pyproject.toml',
  'go.mod', 'Gemfile', 'pom.xml', 'build.gradle', 'CMakeLists.txt',
  'Makefile', '.git', 'src', 'lib', 'app', 'main.py', 'index.js',
  'index.ts', 'README.md', 'CLAUDE.md', '.claude',
];

function detectProjectState(dir) {
  const entries = fs.readdirSync(dir);
  const signals = entries.filter(e => PROJECT_SIGNALS.includes(e));
  const hasClaude = entries.includes('.claude');
  const hasCcrc = fs.existsSync(path.join(dir, '.ccrc.json'));
  const hasCorrc = fs.existsSync(path.join(dir, '.corrc.json'));

  if (hasCcrc || hasCorrc) return 'existing-install';
  if (signals.length > 0) return 'existing-project';
  // Allow a few dotfiles (e.g. .git) without calling it a project
  if (entries.filter(e => !e.startsWith('.')).length === 0) return 'empty';
  return 'empty';
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = {
    yes: false,
    lean: false,
    noDb: false,
    dryRun: false,
    help: false,
    reset: false,
    force: false,
    targetDir: '.',
  };

  for (const arg of args) {
    if (arg === '--yes' || arg === '-y') flags.yes = true;
    else if (arg === '--lean') flags.lean = true;
    else if (arg === '--no-db') flags.noDb = true;
    else if (arg === '--dry-run') flags.dryRun = true;
    else if (arg === '--help' || arg === '-h') flags.help = true;
    else if (arg === '--reset') flags.reset = true;
    else if (arg === '--force') flags.force = true;
    else if (!arg.startsWith('-')) flags.targetDir = arg;
  }

  return flags;
}

function printHelp() {
  console.log(`
  Usage: npx create-claude-cabinet [directory] [options]

  Options:
    --yes, -y     Accept all defaults, no prompts
    --lean        Install core modules only (no work-tracking, compliance, validate)
    --no-db       Skip work tracking database setup
    --dry-run     Show what would be copied without writing
    --reset       Remove Claude Cabinet files (uses manifest for safety)
    --force       With --reset: remove even customized files
    --help, -h    Show this help

  Examples:
    npx create-claude-cabinet                 Interactive setup in current dir
    npx create-claude-cabinet my-project      Set up in ./my-project/
    npx create-claude-cabinet --yes           Install everything, no questions
    npx create-claude-cabinet --lean          Session loop + planning + cabinet
    npx create-claude-cabinet --yes --no-db   Install everything except DB
    npx create-claude-cabinet --dry-run       Preview what would be installed
    npx create-claude-cabinet --reset         Remove CC files safely
    npx create-claude-cabinet --reset --dry-run  Preview what --reset would do
`);
}

async function run() {
  const flags = parseArgs(process.argv);

  if (flags.help) {
    printHelp();
    return;
  }

  if (flags.reset) {
    const projectDir = path.resolve(flags.targetDir);
    await reset(projectDir, { dryRun: flags.dryRun, force: flags.force });
    return;
  }

  console.log('');
  console.log('  🗄️  Claude Cabinet v' + VERSION);
  console.log('  A cabinet of experts for your Claude Code project');
  console.log('');

  if (flags.dryRun) {
    console.log('  [dry run — no files will be written]\n');
  }

  let projectDir = path.resolve(flags.targetDir);

  // --- User identity + project registry ---
  const claudeHome = path.join(os.homedir(), '.claude');
  const registryPath = path.join(claudeHome, 'cc-registry.json');
  const claudeMdPath = path.join(claudeHome, 'CLAUDE.md');

  if (!flags.dryRun) {
    if (!fs.existsSync(claudeHome)) fs.mkdirSync(claudeHome, { recursive: true });
  }

  // First-ever CC install: set up user identity
  const firstCcInstall = !fs.existsSync(registryPath);
  if (firstCcInstall && !flags.yes && !flags.lean && !flags.dryRun) {
    const claudeMdContent = fs.existsSync(claudeMdPath) ? fs.readFileSync(claudeMdPath, 'utf8') : '';
    if (!claudeMdContent.includes('# About Me')) {
      console.log('  This looks like your first time assembling a cabinet.');
      console.log('  Quick question so Claude knows who you are across all projects.\n');
      const { userName } = await prompts({ type: 'text', name: 'userName', message: "What's your name?" });
      const { userRole } = await prompts({ type: 'text', name: 'userRole', message: 'What do you do? (e.g. "I run a bakery", "I\'m a freelance designer")' });
      if (userName || userRole) {
        let profile = '\n# About Me\n\n';
        if (userName) profile += `Name: ${userName}\n`;
        if (userRole) profile += `${userRole}\n`;
        profile += '\n<!-- Added by Claude Cabinet. Claude sees this in every project. -->\n';
        profile += '<!-- Edit ~/.claude/CLAUDE.md to update. -->\n';
        fs.appendFileSync(claudeMdPath, profile);
        console.log('\n  ✓ Saved to ~/.claude/CLAUDE.md — Claude will know this everywhere.\n');
      }
    }
  }

  // --- Directory detection ---
  const dirState = detectProjectState(projectDir);

  let existingManifest = {};
  if (dirState === 'existing-install') {
    const existing = readMetadata(projectDir);
    existingManifest = existing.manifest || {};
    console.log(`  Found existing installation (v${existing.version}, installed ${existing.installedAt.split('T')[0]})`);
    console.log('  Updating upstream-managed files and adding new files.');
    if (!flags.yes && !flags.lean) {
      const { proceed } = await prompts({
        type: 'confirm',
        name: 'proceed',
        message: 'Add new files from latest version?',
        initial: true,
      });
      if (!proceed) {
        console.log('  Cancelled.');
        return;
      }
    }
  } else if (dirState === 'existing-project') {
    console.log(`  Detected existing project in ${projectDir}`);
    if (!flags.yes && !flags.lean) {
      const { action } = await prompts({
        type: 'select',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { title: 'Add Claude Cabinet to this project', value: 'here' },
          { title: 'Create a new project in a different directory', value: 'new' },
        ],
      });

      if (!action) {
        console.log('  Cancelled.');
        return;
      }

      if (action === 'new') {
        const { newDir } = await prompts({
          type: 'text',
          name: 'newDir',
          message: 'Directory name for the new project:',
        });
        if (!newDir) {
          console.log('  Cancelled.');
          return;
        }
        projectDir = path.resolve(newDir);
        if (!fs.existsSync(projectDir)) {
          if (!flags.dryRun) fs.mkdirSync(projectDir, { recursive: true });
          console.log(`  Created ${projectDir}`);
        }
      }
    }
    // --yes with existing project: install here (the most useful default)
  } else {
    // Empty directory
    console.log(`  Setting up in ${projectDir}`);
  }

  // --- Module selection ---
  let selectedModules = [];
  let skippedModules = {};
  let includeDb = !flags.noDb;

  if (flags.lean) {
    selectedModules = Object.entries(MODULES)
      .filter(([, mod]) => mod.mandatory || mod.lean)
      .map(([key]) => key);
    includeDb = false;
    const skippedKeys = Object.keys(MODULES).filter(k => !selectedModules.includes(k));
    for (const k of skippedKeys) {
      skippedModules[k] = 'Skipped by --lean install';
    }
    console.log(`  Lean install: ${selectedModules.length} modules (session-loop, hooks, planning, audit + cabinet, lifecycle).`);
    console.log(`  Skipped: ${skippedKeys.join(', ')}.\n`);
  } else if (flags.yes) {
    selectedModules = Object.keys(MODULES);
    if (flags.noDb) {
      includeDb = false;
      // work-tracking templates are still copied (pib-db.js, schema) but
      // the DB isn't initialized. Mark it as skipped so /onboard knows
      // to ask about the alternative work tracking system.
      selectedModules = selectedModules.filter(m => m !== 'work-tracking');
      skippedModules['work-tracking'] = 'Database setup skipped (--no-db)';
    }
    console.log(`  Installing all ${selectedModules.length} modules.${flags.noDb ? ' (skipping work-tracking DB)' : ''}\n`);
  } else {
    const { installMode } = await prompts({
      type: 'select',
      name: 'installMode',
      message: 'How much do you want to install?',
      choices: [
        { title: 'Everything — all modules, full setup', value: 'full' },
        { title: 'Lean — session loop + planning + cabinet (no DB, compliance, validate)', value: 'lean' },
        { title: 'Custom — choose modules individually', value: 'custom' },
      ],
    });

    if (!installMode) {
      console.log('  Cancelled.');
      return;
    }

    if (installMode === 'full') {
      selectedModules = Object.keys(MODULES);
      console.log(`\n  Installing all ${selectedModules.length} modules.\n`);
    } else if (installMode === 'lean') {
      selectedModules = Object.entries(MODULES)
        .filter(([, mod]) => mod.mandatory || mod.lean)
        .map(([key]) => key);
      includeDb = false;
      const skippedKeys = Object.keys(MODULES).filter(k => !selectedModules.includes(k));
      for (const k of skippedKeys) {
        skippedModules[k] = 'Skipped by lean install';
      }
      console.log(`\n  Lean install: ${selectedModules.length} modules.`);
      console.log(`  Skipped: ${skippedKeys.join(', ')}.\n`);
    } else {
      for (const [key, mod] of Object.entries(MODULES)) {
        if (mod.mandatory) {
          console.log(`  ✓ ${mod.name} (mandatory)`);
          selectedModules.push(key);
          continue;
        }

        const { include } = await prompts({
          type: 'confirm',
          name: 'include',
          message: `${mod.name}\n    ${mod.description}`,
          initial: mod.default !== false,
        });

        if (include) {
          selectedModules.push(key);
        } else {
          const { reason } = await prompts({
            type: 'text',
            name: 'reason',
            message: `  Why skip ${mod.name}? (brief reason, or Enter to skip)`,
          });
          skippedModules[key] = reason || 'Not needed yet';
        }
      }

      // DB prompt (only if work-tracking was selected and --no-db not set)
      if (selectedModules.includes('work-tracking') && !flags.noDb) {
        const { db } = await prompts({
          type: 'confirm',
          name: 'db',
          message: 'Set up work tracking database? (requires better-sqlite3)',
          initial: true,
        });
        includeDb = db;
      } else if (!selectedModules.includes('work-tracking')) {
        includeDb = false;
      }
    }
  }

  console.log('  Assembling your cabinet...\n');

  // --- Copy template files ---
  const templateRoot = path.join(__dirname, '..', 'templates');
  const claudeDir = path.join(projectDir, '.claude');

  let totalCopied = 0;
  let totalSkipped = 0;
  let totalOverwritten = 0;
  const allManifest = {}; // relPath -> hash for all written files

  function hashContent(content) {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  // Compute the relative path from projectDir for manifest entries
  function manifestPath(tmpl) {
    if (tmpl.startsWith('skills/') || tmpl.startsWith('hooks/') || tmpl.startsWith('rules/')) {
      return '.claude/' + tmpl;
    } else if (tmpl.startsWith('scripts/')) {
      return tmpl;
    }
    return '.claude/' + tmpl;
  }

  for (const modKey of selectedModules) {
    const mod = MODULES[modKey];
    for (const tmpl of mod.templates) {
      const srcPath = path.join(templateRoot, tmpl);
      if (!fs.existsSync(srcPath)) {
        console.log(`  ⚠ Template not found: ${tmpl}`);
        continue;
      }

      let destPath;
      if (tmpl.startsWith('skills/') || tmpl.startsWith('hooks/') || tmpl.startsWith('rules/')) {
        destPath = path.join(claudeDir, tmpl);
      } else if (tmpl.startsWith('scripts/')) {
        destPath = path.join(projectDir, tmpl);
      } else {
        destPath = path.join(claudeDir, tmpl);
      }

      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        // For most skill directories, skip phases/ — absent phase files
        // use skeleton defaults. Phase files are created by /onboard
        // based on the project interview, not copied as generic templates.
        // Exception: cabinet members (always copied), and skills whose phase
        // files ARE the instructions (onboard, seed, cc-upgrade,
        // extract) — these need their phases to function.
        // Note: publish is CC-source-repo-only, not shipped to consumers.
        const alwaysCopyPhases = [
          'skills/onboard', 'skills/seed',
          'skills/cc-upgrade', 'skills/extract',
        ];
        const isSkill = tmpl.startsWith('skills/') && !alwaysCopyPhases.some(p => tmpl.startsWith(p));
        const results = await copyTemplates(srcPath, destPath, {
          dryRun: flags.dryRun,
          skipConflicts: flags.yes || dirState === 'existing-install',
          skipPhases: isSkill,
          projectRoot: projectDir,
          existingManifest,
        });
        totalCopied += results.copied.length;
        totalSkipped += results.skipped.length;
        totalOverwritten += results.overwritten.length;
        // Collect manifest entries — prefix with the dest-relative path
        const prefix = manifestPath(tmpl);
        for (const [relFile, hash] of Object.entries(results.manifest)) {
          allManifest[prefix + '/' + relFile] = hash;
        }
      } else {
        const destDir = path.dirname(destPath);
        if (!flags.dryRun && !fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        const incoming = fs.readFileSync(srcPath, 'utf8');
        const incomingHash = hashContent(incoming);
        const mPath = manifestPath(tmpl);

        if (fs.existsSync(destPath)) {
          const existingContent = fs.readFileSync(destPath, 'utf8');
          if (existingContent === incoming) {
            totalSkipped++;
            allManifest[mPath] = incomingHash;
            continue;
          }

          if (flags.yes || dirState === 'existing-install') {
            // If file is in the old manifest, it's upstream-managed — overwrite.
            // If not, it's project-created — skip.
            if (existingManifest[mPath]) {
              if (!flags.dryRun) fs.copyFileSync(srcPath, destPath);
              totalOverwritten++;
            } else {
              totalSkipped++;
            }
            allManifest[mPath] = incomingHash;
          } else {
            const response = await prompts({
              type: 'select',
              name: 'action',
              message: `File exists: ${tmpl}`,
              choices: [
                { title: 'Keep existing', value: 'keep' },
                { title: 'Overwrite with template', value: 'overwrite' },
              ],
            });

            if (response.action === 'overwrite') {
              if (!flags.dryRun) fs.copyFileSync(srcPath, destPath);
              totalOverwritten++;
            } else {
              totalSkipped++;
            }
            allManifest[mPath] = incomingHash;
          }
        } else {
          if (!flags.dryRun) fs.copyFileSync(srcPath, destPath);
          totalCopied++;
          allManifest[mPath] = incomingHash;
        }
      }
    }
  }

  console.log(`  📁 Files: ${totalCopied} copied, ${totalOverwritten} overwritten, ${totalSkipped} unchanged`);

  // --- Make hook scripts executable ---
  const hooksDir = path.join(claudeDir, 'hooks');
  if (!flags.dryRun && fs.existsSync(hooksDir)) {
    const hookFiles = fs.readdirSync(hooksDir).filter(f => f.endsWith('.sh'));
    for (const f of hookFiles) {
      fs.chmodSync(path.join(hooksDir, f), 0o755);
    }
    if (hookFiles.length > 0) {
      console.log(`  🔧 Made ${hookFiles.length} hook scripts executable`);
    }
  }

  // --- Merge hooks into settings.json ---
  if (selectedModules.includes('hooks') && !flags.dryRun) {
    const settingsPath = mergeSettings(projectDir, { includeDb });
    console.log(`  ⚙️  Merged hooks into ${path.relative(projectDir, settingsPath)}`);
  }

  // --- Set up database ---
  if (includeDb && selectedModules.includes('work-tracking') && !flags.dryRun) {
    try {
      const dbResults = setupDb(projectDir);
      for (const r of dbResults) console.log(`  🗄️  ${r}`);
    } catch (err) {
      console.log(`  ⚠ Database setup failed: ${err.message}`);
      console.log('    You can set it up later: node scripts/pib-db.js init');
    }
  }

  // --- Clean up files removed upstream ---
  // Phase files are excluded from the manifest (they're user-customized),
  // so skip them during cleanup even if they were in the old manifest.
  if (Object.keys(existingManifest).length > 0) {
    let totalRemoved = 0;
    for (const oldPath of Object.keys(existingManifest)) {
      if (!allManifest[oldPath]) {
        // Skip phase files — they may be user-customized
        if (/\/phases\//.test(oldPath)) continue;
        const fullPath = path.join(projectDir, oldPath);
        if (fs.existsSync(fullPath)) {
          if (!flags.dryRun) fs.unlinkSync(fullPath);
          totalRemoved++;
        }
      }
    }
    if (totalRemoved > 0) {
      console.log(`  🧹 Removed ${totalRemoved} file${totalRemoved === 1 ? '' : 's'} no longer in upstream`);
    }
  }

  // --- Write metadata ---
  if (!flags.dryRun) {
    createMetadata(projectDir, {
      modules: selectedModules,
      skipped: skippedModules,
      version: VERSION,
      manifest: allManifest,
    });
    console.log('  📝 Created .ccrc.json');
  }

  // --- Update project registry ---
  if (!flags.dryRun) {
    try {
      let registry = { projects: [] };
      if (fs.existsSync(registryPath)) {
        registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      }
      const existingIdx = registry.projects.findIndex(p => p.path === projectDir);
      const entry = {
        path: projectDir,
        name: path.basename(projectDir),
        description: '',
        version: VERSION,
        updatedAt: new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        entry.name = registry.projects[existingIdx].name || entry.name;
        entry.description = registry.projects[existingIdx].description || '';
        registry.projects[existingIdx] = entry;
      } else {
        // Register with folder name. /onboard fills in name and description later.
        registry.projects.push(entry);
      }
      fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
      const otherCount = registry.projects.filter(p => p.path !== projectDir).length;
      if (otherCount > 0) {
        console.log(`  📋 Registered in project registry (${otherCount} other project${otherCount === 1 ? '' : 's'})`);
      } else {
        console.log('  📋 Registered in project registry');
      }
    } catch (err) {
      // Non-fatal — registry is nice-to-have
    }
  }

  // --- Summary ---
  console.log('\n  ✅ Cabinet assembled!\n');
  console.log('  Next steps:');
  console.log('  1. Run /onboard in Claude Code — Claude will interview you and prepare the briefings');
  console.log('  2. Start each session with /orient — get briefed');
  console.log('  3. End each session with /debrief — close the loop for next time');
  const skippedKeys = Object.keys(skippedModules);
  if (skippedKeys.length > 0) {
    console.log(`\n  Skipped modules: ${skippedKeys.join(', ')}`);
    console.log('  Re-run `npx create-claude-cabinet` to add them later.');
  }
  if (flags.dryRun) {
    console.log('\n  [dry run — nothing was written to disk]');
  }
  console.log('');
}

module.exports = { run, MODULES };
