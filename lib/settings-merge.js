const fs = require('fs');
const path = require('path');

const MEMORY_HOOKS = {
  SessionStart: [
    {
      matcher: 'startup|resume|compact',
      hooks: [
        {
          type: 'command',
          command: '.claude/hooks/memory-session-start.sh',
        },
      ],
    },
  ],
  PostCompact: [
    {
      matcher: '',
      hooks: [
        {
          type: 'command',
          command: '.claude/hooks/memory-post-compact.sh',
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

  // Build the complete hook set for this install
  const allHooks = { ...DEFAULT_HOOKS };
  if (includeMemory) {
    for (const [event, hooks] of Object.entries(MEMORY_HOOKS)) {
      allHooks[event] = [...(allHooks[event] || []), ...hooks];
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
