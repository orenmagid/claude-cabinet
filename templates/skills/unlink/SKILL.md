---
name: unlink
description: |
  Remove local development linking for Claude on Rails. Returns the
  project to using the published npm version. Use when: "unlink",
  "stop using local CoR", "use published version", "/unlink".
---

# /unlink — Remove Local Development Link

## Purpose

Disconnect from a local Claude on Rails checkout and return to using
the published npm version.

## Context Detection

**CoR source repo** (`package.json` has `name: "create-claude-rails"`):
- Run `npm unlink` to remove the global registration
- Warn: "This will break the link for all consuming projects that depend
  on it. They'll need to `npm unlink create-claude-rails` too, or
  they'll get resolution errors."

**Any other project**:
- Run `npm unlink create-claude-rails`
- The project returns to using the published npm version
- Tell the user: "Unlinked. `npx create-claude-rails` will now pull
  from npm instead of your local checkout."

## When to Use

- Before testing against the published npm version
- When done with a local development cycle
- When the local CoR checkout is moving to a branch you don't want
  consuming projects to track
