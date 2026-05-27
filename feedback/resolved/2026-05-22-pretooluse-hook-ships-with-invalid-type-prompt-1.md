---
type: field-feedback
source: sydney-graduation
date: 2026-05-22
component: settings.json hook template
---

## PreToolUse hook ships with invalid `"type": "prompt"`

**Friction:** The CC-provided `.claude/settings.json` template includes a PreToolUse entry for `domain-memories.sh` with `"type": "prompt"`, which fails `/doctor` validation. The Claude Code schema only accepts `"type": "command"` for shell-based hooks; there is no "prompt" type at PreToolUse. The script's leading comment ("PreToolUse prompt hook on Edit|Write") suggests the author was describing the hook's purpose (injecting prompt context) and mistook that for the schema type field.

**Suggestion:** Change `"type": "prompt"` to `"type": "command"` in the template (and any installer/onboarding code that emits this block). Optionally update the script comment to "PreToolUse hook on Edit|Write that injects domain memories" to avoid future confusion.

**Session context:** Running `/doctor` on a sydney-graduation project surfaced this as a settings validation error.
