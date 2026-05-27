---
type: field-feedback
source: go-duck-yourself
date: 2026-05-24
component: hooks / user-level settings.json
---

## Friction

Every UserPromptSubmit fires a non-blocking error:
`/bin/sh: .claude/hooks/skill-telemetry.sh: No such file or directory`

The hook is wired in `~/.claude/settings.json` but the command is a
project-relative path. In a non-CC project (e.g.,
`/Users/orenmagid/go-duck-yourself` with no `.claude/` dir), every
prompt produces noise.

Same pattern across other hooks in PreToolUse and PostToolUse:
skill-tool-telemetry.sh, cc-upstream-guard.sh, git-guardrails.sh,
work-tracker-guard.sh, action-quality-gate.sh,
action-completion-gate.sh, domain-memories.sh — all relative paths in
user-level settings, all silently broken outside CC projects.

## Suggestion

(a) Install these hooks at absolute paths under `~/.claude-cabinet/hooks/`
rather than relying on each project to ship `.claude/hooks/*`.
(b) At minimum, suppress missing-hook errors instead of bubbling them.
(c) Document the footgun: user-level hooks with project-relative
commands fail in non-CC projects.

## Session context

Building "Go Duck Yourself" browser game from scratch via Claude
conversation. Project has no CC infrastructure (just `index.html`,
`README.md`, `.gitignore`).
