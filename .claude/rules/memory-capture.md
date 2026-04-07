# Memory Capture Rules

When omega memory is active (check: `omega hooks doctor` reports OK),
these rules govern what gets captured and when.

## How Capture Works

Omega handles memory capture natively through its hooks in
`~/.claude/settings.json` (global). No project-level hook scripts needed.

**Automatic capture (omega native hooks):**
- `auto_capture` (UserPromptSubmit) — detects decisions/lessons from user messages in real time
- `assistant_capture` (Stop) — extracts insights from assistant responses at session end
- `session_stop` (Stop) — session summary, activity report, auto-reflection
- `surface_memories` (PostToolUse) — surfaces relevant memories before file edits

**Manual capture (adapter or omega MCP tools):**
- Use `omega_store()` MCP tool directly, or
- Use the adapter for project-scoped storage:
  ```bash
  echo '{"text": "the memory", "type": "decision"}' | \
    ~/.claude-cabinet/omega-venv/bin/python3 scripts/cabinet-memory-adapter.py store
  ```

**Memory types:** `decision`, `lesson_learned`, `user_preference`, `constraint`, `error_pattern`

## What to Capture Manually

Omega's auto_capture hook catches many decisions and lessons from
conversation flow. Manual capture is for things the hooks miss:

**Decisions with reasoning.** Non-obvious architectural choices where
the "why" matters as much as the "what."

**Discovered constraints.** Limitations or gotchas that waste time
if you don't know them in advance.

**User preferences revealed through correction.** When the user
redirects your approach — capture what they actually want.

## What NOT to Capture

- Code patterns visible by reading current files
- Git history (use `git log`)
- Anything already in CLAUDE.md or briefing files
- Ephemeral debugging details
- Information that changes frequently (use state files instead)

## Capture Cadence

Omega's native hooks handle most capture automatically. Manual capture
should be rare — only when something important happened that the hooks
wouldn't detect (e.g., a nuanced architectural decision discussed
verbally, or a constraint discovered through external research).

Over-capturing degrades retrieval quality. The test: *"Would a future
session benefit from knowing this?"* If yes, capture it. If it's just
noise or ephemera, skip it.
