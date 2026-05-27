const fs = require('fs');
const path = require('path');

const MEMORY_HOOKS = {
  PreToolUse: [
    {
      matcher: 'Edit|Write',
      hooks: [
        {
          type: 'command',
          command: '.claude/hooks/omega-memory-guard.sh',
        },
      ],
    },
  ],
};

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
      matcher: 'Edit|Write',
      hooks: [
        {
          type: 'command',
          command: '.claude/hooks/domain-memories.sh',
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
  ],
};

/**
 * Merge PIB hooks into the project's .claude/settings.json.
 * Creates the file if it doesn't exist. Preserves existing hooks.
 */
function mergeSettings(projectDir, { includeDb = true, includeMemory = false } = {}) {
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

  // Remove legacy CC memory hooks (v0.9.x and earlier).
  // These are now handled by omega's native hooks in global settings.
  const LEGACY_MEMORY_COMMANDS = [
    'memory-session-start.sh',
    'memory-post-compact.sh',
  ];
  for (const [event, entries] of Object.entries(settings.hooks)) {
    if (!Array.isArray(entries)) continue;
    settings.hooks[event] = entries.filter(entry => {
      if (!entry.hooks || !Array.isArray(entry.hooks)) return true;
      return !entry.hooks.some(h =>
        LEGACY_MEMORY_COMMANDS.some(cmd => (h.command || '').includes(cmd))
      );
    });
  }

  // Heal legacy domain-memories entries shipped with an invalid type ("prompt").
  // The Claude Code schema only accepts "command" for shell-based hooks; older
  // installs (≤ v0.26.0) have the wrong value and fail /doctor validation.
  for (const entries of Object.values(settings.hooks)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry.hooks || !Array.isArray(entry.hooks)) continue;
      for (const h of entry.hooks) {
        if ((h.command || '').includes('domain-memories.sh') && h.type === 'prompt') {
          h.type = 'command';
        }
      }
    }
  }

  // Build the full hook set — include memory hooks if memory module is selected
  const allHooks = { ...DEFAULT_HOOKS };
  if (includeMemory) {
    for (const [event, hooks] of Object.entries(MEMORY_HOOKS)) {
      if (!allHooks[event]) {
        allHooks[event] = hooks;
      } else {
        allHooks[event] = [...allHooks[event], ...hooks];
      }
    }
  }

  // Merge each hook event type
  for (const [event, newHooks] of Object.entries(allHooks)) {
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

module.exports = { mergeSettings, healUserSettings, DEFAULT_HOOKS, MEMORY_HOOKS };
