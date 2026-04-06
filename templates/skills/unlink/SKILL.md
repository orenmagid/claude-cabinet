---
name: unlink
description: |
  Remove local development linking for Claude Cabinet. Returns the
  project to using the published npm version. Use when: "unlink",
  "stop using local CC", "use published version", "/unlink".
---

# /unlink — Remove Local Development Link

## Purpose

Disconnect from a local Claude Cabinet checkout and return to using
the published npm version.

## Context Detection

**CC source repo** (`package.json` has `name: "create-claude-cabinet"`):
- Run `npm unlink` to remove the global registration
- Warn: "This will break the link for all consuming projects that depend
  on it. They'll need to `npm unlink create-claude-cabinet` too, or
  they'll get resolution errors."

**Any other project**:
- Run `npm unlink create-claude-cabinet`
- The project returns to using the published npm version
- Tell the user: "Unlinked. `npx create-claude-cabinet` will now pull
  from npm instead of your local checkout."

## When to Use

- Before testing against the published npm version
- When done with a local development cycle
- When the local CC checkout is moving to a branch you don't want
  consuming projects to track
