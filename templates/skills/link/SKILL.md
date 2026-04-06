---
name: link
description: |
  Set up local development linking for Claude Cabinet. Detects whether
  you're in the CoR source repo or a consuming project and runs the
  appropriate npm link command. Use when: "link", "local dev", "use local
  CoR", "/link".
---

# /link — Local Development Linking

## Purpose

Connect a consuming project to a local checkout of Claude Cabinet so
template changes are immediately available without publishing to npm.

## Context Detection

Before doing anything, determine where you are:

**CoR source repo** (`package.json` has `name: "create-claude-cabinet"`):
- Run `npm link` to register the package globally
- This makes the local checkout available to any project that links to it
- Tell the user: "Registered locally. In your other projects, run `/link`
  to connect them to this checkout."

**Any other project** (anything that isn't the CoR source repo):
- Run `npm link create-claude-cabinet` to point to the local CoR checkout
- Verify it worked: check that `npx create-claude-cabinet --help` resolves
  to the local version
- If CoR is already installed (`.corrc.json` exists): "Linked to local
  CoR. Run `/cor-upgrade` to pull template changes into your installed
  skills."
- If CoR is not yet installed: "Linked to local CoR. Run
  `npx create-claude-cabinet` to install."

## Prerequisites

The CoR source repo must have been linked first (`npm link` from the CoR
directory). If a consuming project tries to link and the global link
doesn't exist, npm will error. In that case, tell the user to run `/link`
in their CoR checkout first.

## What This Encodes

- `npm link` (in source) registers a global symlink to the package
- `npm link create-claude-cabinet` (in consumer) creates a local symlink
  to the globally registered package
- The link survives across terminal sessions
- The link uses whatever is on disk — no version pinning, no caching
- After linking, `npx create-claude-cabinet` and `/cor-upgrade` both
  resolve to the local checkout
