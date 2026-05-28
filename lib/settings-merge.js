const fs = require('fs');
const path = require('path');

const DEFAULT_HOOKS = {
  PreToolUse: [
    {
      matcher: 'Bash',
      hooks: [
        {
          type: 'command',
          command: '.claude/hooks/git-guardrails.sh',
        },
      ],
    },
    {
      matcher: 'Bash',
      hooks: [
        {
          type: 'command',
          command: '.claude/hooks/work-tracker-guard.sh',
        },
      ],
    },
    {
      matcher: 'Edit|Write',
      hooks: [
        {
          type: 'command',
          command: '.claude/hooks/cc-upstream-guard.sh',
        },
      ],
    },
    {
      matcher: 'pib_create_action',
      hooks: [
        {
          type: 'command',
          command: '.claude/hooks/action-quality-gate.sh',
        },
      ],
    },
    {
      matcher: 'pib_complete_action',
      hooks: [
        {
          type: 'command',
          command: '.claude/hooks/action-completion-gate.sh',
        },
      ],
    },
  ],
  UserPromptSubmit: [
    {
      matcher: '',
      hooks: [
        {
          type: 'command',
          command: '.claude/hooks/skill-telemetry.sh',
        },
      ],
    },
  ],
  PostToolUse: [
    {
      matcher: 'Skill',
      hooks: [
        {
          type: 'command',
          command: '.claude/hooks/skill-tool-telemetry.sh',
        },
      ],
    },
    {
      matcher: 'Edit|Write',
      hooks: [
        {
          type: 'command',
          command: '.claude/hooks/memory-index-guard.sh',
        },
      ],
    },
  ],
};

// Legacy hook script names that should be stripped on any merge.
// Centralizes cleanup so a user who skips --migrate-memory but runs
// any other CC operation still gets omega-era hooks pruned.
//
// Includes:
//   - memory-session-start.sh, memory-post-compact.sh — pre-omega CC
//     memory hooks (v0.9.x and earlier)
//   - omega-memory-guard.sh — omega-era CC PreToolUse guard
//   - domain-memories.sh — omega-era CC PreToolUse domain surfacer
const LEGACY_HOOK_COMMANDS = [
  'memory-session-start.sh',
  'memory-post-compact.sh',
  'omega-memory-guard.sh',
  'domain-memories.sh',
];

/**
 * Merge PIB hooks into the project's .claude/settings.json.
 * Creates the file if it doesn't exist. Preserves existing hooks.
 */
function mergeSettings(projectDir, { includeDb = true } = {}) {
  const settingsDir = path.join(projectDir, '.claude');
  const settingsPath = path.join(settingsDir, 'settings.json');

  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }

  let settings = {};
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  }

  if (!settings.hooks) settings.hooks = {};

  // Strip legacy CC hook entries — runs unconditionally on every merge.
  // Covers pre-omega CC memory hooks AND omega-era hooks that v0.27.0
  // no longer ships. A consumer who never runs --migrate-memory but
  // does any other CC install gets these pruned automatically.
  for (const [event, entries] of Object.entries(settings.hooks)) {
    if (!Array.isArray(entries)) continue;
    settings.hooks[event] = entries
      .map(entry => {
        if (!entry.hooks || !Array.isArray(entry.hooks)) return entry;
        const cleanedSubHooks = entry.hooks.filter(
          h => !LEGACY_HOOK_COMMANDS.some(cmd => (h.command || '').includes(cmd))
        );
        return { ...entry, hooks: cleanedSubHooks };
      })
      .filter(entry => !entry.hooks || !Array.isArray(entry.hooks) || entry.hooks.length > 0);
    if (settings.hooks[event].length === 0) delete settings.hooks[event];
    if (!settings.hooks[event]) continue;
  }

  // Merge each hook event type from DEFAULT_HOOKS
  for (const [event, newHooks] of Object.entries(DEFAULT_HOOKS)) {
    if (!settings.hooks[event]) {
      settings.hooks[event] = newHooks;
    } else {
      // Add hooks that don't already exist (check by command path or prompt text)
      for (const newHook of newHooks) {
        const hookKey = h => h.command || h.prompt || '';
        const existingKeys = settings.hooks[event].flatMap(h =>
          h.hooks.map(hh => hookKey(hh))
        );
        const newKeys = newHook.hooks.map(h => hookKey(h));
        const alreadyExists = newKeys.every(k =>
          existingKeys.includes(k)
        );
        if (!alreadyExists) {
          settings.hooks[event].push(newHook);
        }
      }
    }
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  return settingsPath;
}

/**
 * Heal user-level ~/.claude/settings.json by removing CC hook entries that
 * reference project-relative paths (`.claude/hooks/*.sh`). These belong at
 * project-level only — at user-level they fire in every project including
 * non-CC ones, where the path doesn't resolve and produces noise on every
 * tool call. CC's current installer never writes them at user-level, but
 * older versions or manual edits may have. Idempotent.
 *
 * Returns the number of entries removed, or 0 if no healing was needed.
 */
function healUserSettings() {
  const os = require('os');
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  if (!fs.existsSync(settingsPath)) return 0;

  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return 0;
  }
  if (!settings.hooks || typeof settings.hooks !== 'object') return 0;

  let removed = 0;
  for (const [event, entries] of Object.entries(settings.hooks)) {
    if (!Array.isArray(entries)) continue;
    const filtered = entries.filter(entry => {
      if (!entry.hooks || !Array.isArray(entry.hooks)) return true;
      const hasRelativeCcHook = entry.hooks.some(h =>
        /^\.claude\/hooks\//.test(h.command || '')
      );
      if (hasRelativeCcHook) removed++;
      return !hasRelativeCcHook;
    });
    if (filtered.length === 0) {
      delete settings.hooks[event];
    } else {
      settings.hooks[event] = filtered;
    }
  }

  if (removed > 0) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  }
  return removed;
}

module.exports = { mergeSettings, healUserSettings, DEFAULT_HOOKS, LEGACY_HOOK_COMMANDS };
