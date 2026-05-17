**Friction:** The CC installer writes `.claude/settings.json` with `"type": "prompt"` for the `domain-memories.sh` hook, but the file is a shell script (command hook). This trips `/doctor` with `hooks.PreToolUse.4.hooks.0.prompt: Expected string, but received undefined`. The script header comment still says "PreToolUse prompt hook on Edit|Write" — likely a leftover from when it was conceived as a prompt hook before being rewritten as a shell script. Confirmed across multiple worktree copies, so it's the installer-seeded value, not local drift.

**Suggestion:** Change the registered type to `"type": "command"` in whatever installer template writes this entry, and update the script header comment to drop "prompt".

**Session context:** Running `/doctor` on the flow project surfaced the warning; traced the wiring back to CC's manifest.
