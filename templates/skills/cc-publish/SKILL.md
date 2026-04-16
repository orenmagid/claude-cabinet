---
name: cc-publish
description: |
  Publish a new version of Claude Cabinet to npm. Analyzes changes since
  last release, suggests a version bump (patch/minor/major), updates
  package.json, commits, tags, and publishes. Use when: "publish",
  "release", "ship it", "/cc-publish".
---

# /cc-publish — Release to npm

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

- Re-run the installer to update the local dogfood copy with the
  just-published templates. **Match the existing install type** — check
  `.ccrc.json` to see which modules are installed. If all 8 modules are
  present, run a full install (`node bin/create-claude-cabinet.js --yes`).
  If only lean modules, run `--lean`. Never downgrade a full install to
  lean.
- After the install, verify `package.json` wasn't corrupted — check that
  no unexpected fields were added or existing fields changed.
- Update `system-status.md` if it exists
- Report the published version and npm URL

**DO NOT stop here.** Step 6 is mandatory — the publish is incomplete
until all local consumers are updated. Proceed to Step 6 immediately.

### 6. Update Local Consumers

Read `~/.claude/cc-registry.json` for all registered CC projects. For
each project that is NOT the CC source repo itself:

1. Check its current version (`cat <path>/.ccrc.json | jq -r .version`)
2. If it's older than the just-published version, update it:
   - `cd <path> && npx create-claude-cabinet@latest --yes`
   - Verify the install succeeded (`.ccrc.json` version matches)
3. After a successful update, commit ONLY CC-managed files in the consumer:
   - First: `git -C <path> reset HEAD -- .` (clear any pre-staged files —
     the consumer may have project files staged from a prior session)
   - Then: `git -C <path> add .claude/ .mcp.json scripts/pib-db*.mjs scripts/pib-db-schema.sql scripts/*.cjs .ccrc.json`
   - Only stage files that are actually modified (`git -C <path> diff --name-only` to check)
   - Commit with message: `chore: update claude-cabinet to v<version>`
   - Do NOT push — leave that to the user
4. Report which consumers were updated, committed, and which were already current

**Important:**
- Never force-install or pass flags beyond `--yes` — the installer
  reads the existing `.ccrc.json` to determine install type
- If a consumer's path doesn't exist, note it (stale registry entry)
  but don't error — mention it in the report
- If an install fails, report the error but continue with other consumers
- The commit in step 3 should only include CC-managed files, not any
  project-owned files that happen to be dirty in the working tree
