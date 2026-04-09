---
name: cc-link
description: |
  Set up local development linking for Claude Cabinet. Detects whether
  you're in the CC source repo or a consuming project and runs the
  appropriate npm link command. Use when: "link", "local dev", "use local
  CC", "/cc-link".
---

# /cc-link — Local Development Linking

## Purpose

Connect a consuming project to a local checkout of Claude Cabinet so
template changes are immediately available without publishing to npm.

## Context Detection

Before doing anything, determine where you are:

**CC source repo** (`package.json` has `name: "create-claude-cabinet"`):
- Run `npm link` to register the package globally
- This makes the local checkout available to any project that links to it
- Tell the user: "Registered locally. In your other projects, run `/cc-link`
  to connect them to this checkout."

**Any other project** (anything that isn't the CC source repo):
- Run `npm link create-claude-cabinet` to point to the local CC checkout
- Verify it worked: check that `npx create-claude-cabinet --help` resolves
  to the local version
- If CC is already installed (`.ccrc.json` exists): "Linked to local
  CC. Run `/cc-upgrade` to pull template changes into your installed
  skills."
- If CC is not yet installed: "Linked to local CC. Run
  `npx create-claude-cabinet` to install."

## Prerequisites

The CC source repo must have been linked first (`npm link` from the CC
directory). If a consuming project tries to link and the global link
doesn't exist, npm will error. In that case, tell the user to run `/cc-link`
in their CC checkout first.

## What This Encodes

- `npm link` (in source) registers a global symlink to the package
- `npm link create-claude-cabinet` (in consumer) creates a local symlink
  to the globally registered package
- The link survives across terminal sessions
- The link uses whatever is on disk — no version pinning, no caching
- After linking, `npx create-claude-cabinet` and `/cc-upgrade` both
  resolve to the local checkout
