# Detect Current — Inventory Claude on Rails Adoption State

Build a structured manifest of the project's current CoR adoption. This
manifest is consumed by the diff-upstream phase to determine what has
changed.

When this file is absent or empty, the default behavior is: read
`.corrc.json` for version and module metadata, then scan the project's
`.claude/skills/`, perspectives, hooks, and database for CoR artifacts.
To explicitly skip detection, write only `skip: true`.

## What to Inventory

### Package Metadata (.corrc.json)

Read `.corrc.json` from the project root. This file is written by the
CLI installer (`npx create-claude-rails`) and contains:

- **`version`** — the installed package version (for diff-upstream comparison)
- **`installedAt`** — when the install or last upgrade happened
- **`modules`** — which module groups were selected (boolean map)
- **`skipped`** — modules the user opted out of, with reasons
- **`upstreamPackage`** — the npm package name (`create-claude-rails`)

If `.corrc.json` is missing, this is either a pre-npm adoption or a
manual install. Note this in the manifest — the diff-upstream phase
needs to know whether version comparison is possible or if it must fall
back to pure filesystem diffing.

### Skills

For each directory in `.claude/skills/`:
- **Is it a CoR skeleton?** Compare the SKILL.md against the upstream
  upstream templates directory. If it matches a known skeleton
  (by name or by frontmatter `name` field), it's a CoR skill.
- **Phase file status:** For each phase file the skeleton defines, check
  whether the project's copy is: absent (using default), empty (using
  default), contains `skip: true` (opted out), or contains custom content
  (project-specific adaptation).
- **Custom phases:** Any phase files in the project's `phases/` directory
  that the skeleton doesn't define are project extensions.

### Perspectives

- Which perspective groups exist in `.claude/skills/perspectives/`?
- Which perspectives are listed in each group's `_group.yaml`?
- Which perspectives have project-customized content vs upstream defaults?

### Hooks

- Read `.claude/settings.json` (or `.claude/settings.local.json`).
- Identify which hooks were installed as part of CoR adoption vs
  project-specific additions.

### Database Schema

- If the project uses `pib-db`, check the actual DB schema against
  known CoR columns. Record which tables and columns exist.
- Note the effective schema version (inferred from which columns are
  present, not from a version number).

### Memory and Patterns

- Count files in `memory/patterns/` and `memory/archive/`.
- Note whether the enforcement pipeline is active (patterns have
  `enforcement` frontmatter fields).

## Output Format

Produce a structured manifest (in conversation, not a file) listing:
- **Package version** from `.corrc.json` (or "unknown — no .corrc.json")
- **Installed modules** from `.corrc.json` modules map
- **Skipped modules** with reasons from `.corrc.json` skipped map
- Each adopted skill with its phase file statuses
- Each adopted perspective group with member count
- Hook count and types
- Schema state
- Pattern/archive counts

This manifest feeds directly into the diff-upstream phase. The version
field is especially critical — it determines whether diff-upstream can
do a targeted version-to-version comparison or must diff everything.
