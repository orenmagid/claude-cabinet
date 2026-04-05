const prompts = require('prompts');
const path = require('path');
const fs = require('fs');
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
    description: 'Context continuity between sessions. Claude starts informed, ends by recording what happened.',
    mandatory: true,
    templates: ['skills/orient', 'skills/debrief', 'skills/debrief/phases/upstream-feedback.md', 'skills/menu', 'hooks/stop-hook.md'],
  },
  'hooks': {
    name: 'Git Guardrails + Telemetry',
    description: 'Block destructive git ops (force push, hard reset). Track skill usage via JSONL telemetry.',
    mandatory: false,
    default: true,
    lean: true,
    templates: ['hooks/git-guardrails.sh', 'hooks/cor-upstream-guard.sh', 'hooks/skill-telemetry.sh', 'hooks/skill-tool-telemetry.sh', 'scripts/cor-drift-check.cjs'],
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
    description: 'Structured implementation planning with perspective critique and execution checkpoints.',
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
    name: 'Audit Loop (audit + triage + perspectives)',
    description: 'Periodic expert-perspective analysis with structured triage. Most compute-intensive module.',
    mandatory: false,
    default: true,
    lean: true,
    templates: [
      'skills/audit', 'skills/pulse', 'skills/triage-audit',
      'skills/perspectives',
      'scripts/merge-findings.js', 'scripts/load-triage-history.js',
      'scripts/triage-server.mjs', 'scripts/triage-ui.html',
      'scripts/finding-schema.json',
    ],
  },
  'lifecycle': {
    name: 'Lifecycle (onboard + seed + cor-upgrade + link)',
    description: 'Conversational onboarding, capability seeding, upgrade merges, local dev linking.',
    mandatory: false,
    default: true,
    lean: true,
    templates: ['skills/onboard', 'skills/seed', 'skills/cor-upgrade', 'skills/link', 'skills/unlink', 'skills/publish', 'skills/extract'],
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
  const hasPibrc = fs.existsSync(path.join(dir, '.corrc.json'));

  if (hasPibrc) return 'existing-install';
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
  Usage: npx create-claude-rails [directory] [options]

  Options:
    --yes, -y     Accept all defaults, no prompts
    --lean        Install core modules only (no work-tracking, compliance, validate)
    --no-db       Skip work tracking database setup
    --dry-run     Show what would be copied without writing
    --reset       Remove CoR files (uses manifest for safety)
    --force       With --reset: remove even customized files
    --help, -h    Show this help

  Examples:
    npx create-claude-rails                 Interactive setup in current dir
    npx create-claude-rails my-project      Set up in ./my-project/
    npx create-claude-rails --yes           Install everything, no questions
    npx create-claude-rails --lean          Session loop + planning + perspectives
    npx create-claude-rails --yes --no-db   Install everything except DB
    npx create-claude-rails --dry-run       Preview what would be installed
    npx create-claude-rails --reset         Remove CoR files safely
    npx create-claude-rails --reset --dry-run  Preview what --reset would do
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
  console.log('  🚂 Claude on Rails v' + VERSION);
  console.log('  Opinionated process scaffolding for Claude Code projects');
  console.log('');

  if (flags.dryRun) {
    console.log('  [dry run — no files will be written]\n');
  }

  let projectDir = path.resolve(flags.targetDir);

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
          { title: 'Add Claude on Rails to this project', value: 'here' },
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
    console.log(`  Lean install: ${selectedModules.length} modules (session-loop, hooks, planning, audit, lifecycle).`);
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
        { title: 'Lean — session loop + planning + perspectives (no DB, compliance, validate)', value: 'lean' },
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

  console.log('  Setting up Claude on Rails...\n');

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
        // Exception: perspectives (always copied), and skills whose phase
        // files ARE the instructions (onboard, seed, cor-upgrade, publish,
        // extract) — these need their phases to function.
        const alwaysCopyPhases = [
          'skills/perspectives', 'skills/onboard', 'skills/seed',
          'skills/cor-upgrade', 'skills/publish', 'skills/extract',
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
  if (Object.keys(existingManifest).length > 0) {
    let totalRemoved = 0;
    for (const oldPath of Object.keys(existingManifest)) {
      if (!allManifest[oldPath]) {
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
    console.log('  📝 Created .corrc.json');
  }

  // --- Summary ---
  console.log('\n  ✅ Claude on Rails installed!\n');
  console.log('  Next steps:');
  console.log('  1. Run /onboard in Claude Code to generate your project context');
  console.log('  2. Start a session with /orient');
  console.log('  3. End a session with /debrief');
  const skippedKeys = Object.keys(skippedModules);
  if (skippedKeys.length > 0) {
    console.log(`\n  Skipped modules: ${skippedKeys.join(', ')}`);
    console.log('  Re-run npx create-claude-rails to add them later.');
  }
  if (flags.dryRun) {
    console.log('\n  [dry run — nothing was written to disk]');
  }
  console.log('');
}

module.exports = { run, MODULES };
