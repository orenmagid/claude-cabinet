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
      matcher: 'Edit|Write',
      hooks: [
        {
          type: 'command',
          command: '.claude/hooks/cc-upstream-guard.sh',
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
      // Add hooks that don't already exist (check by command path)
      for (const newHook of newHooks) {
        const existingCommands = settings.hooks[event].flatMap(h =>
          h.hooks.map(hh => hh.command)
        );
        const newCommands = newHook.hooks.map(h => h.command);
        const alreadyExists = newCommands.every(cmd =>
          existingCommands.includes(cmd)
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

module.exports = { mergeSettings, DEFAULT_HOOKS, MEMORY_HOOKS };
