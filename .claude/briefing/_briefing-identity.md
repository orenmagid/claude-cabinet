# Project Identity — Claude Cabinet

## What This Project Is

Claude Cabinet (CC) is an npm package (`create-claude-cabinet`) that scaffolds
opinionated process infrastructure for Claude Code projects. It's a Node CLI
that copies skill templates, hooks, and scripts into a target project's `.claude/`
directory, then uses a conversational `/onboard` skill to generate project-specific
briefings. The audience is anyone using Claude Code — developers and non-developers
alike. The codebase is small: ~6 JS files in `lib/`, templates in `templates/`.

## Core Principles

1. **Intelligence is the merge strategy.** CC distributes as conversation, not
   config. Upgrades, onboarding, and adaptation happen through Claude reasoning
   about context — not mechanical diffing.
2. **Phase files customize, not enable.** Skills always do something reasonable
   when phase files are absent. Phase files override defaults; `skip: true`
   disables them. No config files, no YAML, no DSL.
3. **Session continuity over session intelligence.** The core value is orient/debrief:
   Claude starts informed, ends by recording what happened. Everything else is opt-in.
4. **Meet people where they are.** The system works for senior engineers and
   first-time coders. Onboarding listens to how you talk and matches your level.
5. **Minimal footprint.** Nothing touches source code. Everything lives in
   `.claude/`, `scripts/`, or root metadata files.

## User Context

Oren Magid — creator and product owner of Claude Cabinet. Self-describes as
"the idea man, not the architect." Relies on Claude for implementation,
architectural decisions, and planning. Deep context on the methodology's
purpose and philosophy; delegates technical execution.
