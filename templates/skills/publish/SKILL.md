---
name: publish
description: |
  Publish a new version of Claude Cabinet to npm. Analyzes changes since
  last release, suggests a version bump (patch/minor/major), updates
  package.json, commits, tags, and publishes. Use when: "publish",
  "release", "ship it", "/publish".
---

# /publish — Release to npm

## Purpose

Handle the full publish flow for the `create-claude-cabinet` package:
analyze what changed, suggest a version, get confirmation, and ship.

This skill only runs from the CC source repo (`package.json` has
`name: "create-claude-cabinet"`). If run elsewhere, say so and stop.

## Workflow

### 1. Analyze Changes

Run `git log` from the last version tag (e.g., `v0.2.0`) to HEAD.
Summarize what changed in plain language — group by category:

- **Breaking** — renames, removed features, changed file formats
- **Features** — new flags, new skills, new modules
- **Fixes** — bug fixes, UX improvements
- **Internal** — refactors, template updates that don't change behavior

### 2. Suggest Version

Based on the changes:

- **Patch** (0.x.Y) — fixes only, no new features, no breaking changes
- **Minor** (0.X.0) — new features, backward-compatible
- **Major** (X.0.0) — breaking changes (renames, removed APIs, format changes)

Note: while pre-1.0, minor can include breaking changes per semver
convention. Call this out when recommending.

Present the suggestion with reasoning:

> "Since the last release (v0.2.0), there are N breaking changes
> (list them), N new features, and N fixes. I'd suggest **0.3.0**
> because [reason]. Want to go with that, or a different version?"

### 3. Pre-Publish Checks

Before publishing, verify:

- `node -c lib/cli.js` passes (syntax check)
- Working tree is clean (no uncommitted changes) — if dirty, ask
  whether to commit first
- Current branch is main
- `npm whoami` succeeds (logged in to npm)

### 4. Publish

With user confirmation:

1. Update `version` in `package.json`
2. Commit: `Bump to <version>`
3. Tag: `git tag v<version>`
4. `npm publish`
5. `git push && git push --tags`

### 5. Post-Publish

- Re-run the lean install (`node bin/create-claude-cabinet.js --lean`) to
  update the local dogfood copy with the just-published templates
- Update `system-status.md` if it exists
- Report the published version and npm URL
