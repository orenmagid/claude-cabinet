# Diff Upstream — Compare Project Against Claude on Rails Package

Compare the project's current adoption state (from detect-current) against
the upstream CoR package. Produce a categorized list of changes.

When this file is absent or empty, the default behavior is: look for
`.pib-upstream/` in the project root (staged by `npx create-claude-rails
upgrade`) and perform semantic diffs of all adopted skeletons. To
explicitly skip diffing, write only `skip: true`.

## Locating Upstream

Default: `.pib-upstream/` in the project root. This directory is created
by `npx create-claude-rails upgrade`, which fetches the latest package
from npm and stages its templates here for comparison. The directory is
gitignored — it's a transient diff target, not a permanent fixture.

If `.pib-upstream/` doesn't exist, prompt the user:
"Run `npx create-claude-rails upgrade` first — it fetches the latest
upstream and stages it for comparison."

If your project stores upstream elsewhere (a submodule, a symlinked
directory, a separate checkout), specify the path here.

## Diff Strategy

The diff is **semantic, not textual.** Line-by-line diffs of markdown
files are noisy and miss the point. Instead:

### For Each Adopted Skeleton SKILL.md

Compare section by section:
- **Purpose/description** — has the framing changed?
- **Workflow steps** — are there new phases? Removed phases? Reordered?
- **Phase summary table** — do defaults differ?
- **Default behaviors** — for each phase, has the "absent/empty" behavior
  changed? This matters most for projects using defaults.
- **Calibration** — has the failure mode description evolved?
- **Extending section** — new extension examples?

### For Non-Adopted Skills

List any skills in upstream that the project hasn't adopted. For each,
note: name, one-line description, what problem it addresses.

### For Perspectives

- New perspectives in upstream that the project doesn't have.
- Updated perspectives where upstream content differs from project copy.
- New perspective groups.

### For Schema

Compare `pib-db-schema.sql` (or equivalent) column-by-column against
the project's actual database tables. Flag: new columns, changed types,
new tables, new indexes.

### For Infrastructure

- New hooks in upstream's recommended settings.
- New rules files in upstream's `.claude/rules/`.
- Changes to the CoR onboarding or seed skills.

## Output Format

A categorized change list, where each change has:
- **What** changed (specific file, section, or artifact)
- **Category** (1-6, matching the SKILL.md's change categories)
- **Summary** of the change in plain language
- **Impact** on the project (does this touch something the project customized?)

This feeds directly into the merge phase.
