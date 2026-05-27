# Cross-Project Shared Rules

When you have multiple CC-installed projects on the same machine, some
rules are project-specific (`tsc must run from frontend/`) and some are
true everywhere you work (`always use pnpm`, `never commit without a
fid tag`). The cross-project ones don't belong in any single project's
`CLAUDE.md` — they belong in a place all your projects can read from.

CC ships two mechanisms for cross-project rule sharing. **The default
is symlinks; @imports are documented here as an alternative for cases
where you want the rules visible inside CLAUDE.md itself.**

## Mechanism 1 — Symlinks (default)

A central rules directory at `~/.claude-cabinet-shared/rules/` contains
the shared `.md` files. Each CC project has a symlink at
`.claude/rules/shared/` that points there.

```
~/.claude-cabinet-shared/rules/
├── workflow-conventions.md
├── coding-standards.md
└── git-discipline.md

<project>/.claude/rules/shared -> ~/.claude-cabinet-shared/rules/
```

**Why this is the default:**

- Claude Code's `.claude/rules/` directory officially supports symlinks
  (per [memory docs](https://code.claude.com/docs/en/memory)). Symlinks
  resolve normally; circular symlinks are detected.
- The shared rules appear inside the project's rule-loading priority,
  so they participate in `paths:` frontmatter scoping if you want.
- The link is project-local on disk, so git can see it and (if you want)
  ignore it via `.gitignore`. Edit once, all projects pick it up.
- Centralizes editing: one canonical location.

**How `/onboard` sets it up:**

The onboarding interview asks whether you want shared rules when you
have 2+ CC projects on the machine. On "yes", it:

1. Creates `~/.claude-cabinet-shared/rules/` if absent.
2. Creates `<project>/.claude/rules/shared` symlink → the central dir.
3. Adds an entry to `.gitignore` for `.claude/rules/shared` (the
   symlink itself), so each project can choose to track its own
   project-specific rules without leaking the symlink.

The `~/.claude-cabinet-shared/rules/` dir starts empty. You add
rules as you discover them — same workflow as adding any other rule
file, just write to the central location.

## Mechanism 2 — `@imports` (alternative)

CLAUDE.md supports `@path/to/file.md` imports that load the file's
content into the prompt at session start:

```markdown
# CLAUDE.md
@~/.claude/shared/conventions.md
@~/.claude/shared/git-discipline.md
```

**When to use this instead:**

- You want the shared content visible at the top of CLAUDE.md (as a
  reading aid for humans skimming the file).
- You don't want symlinks in your project tree.
- Your project's CLAUDE.md is the *only* memory layer you want loaded
  (no `.claude/rules/` priority interactions).

**Tradeoffs vs symlinks:**

- Imports load eagerly (always, on every session start) — no `paths:`
  scoping. Symlinks via `.claude/rules/` can be scoped.
- Each project's CLAUDE.md needs the `@` line — adding a new shared
  rule means editing every project's CLAUDE.md, not just creating the
  file.
- No git visibility per-project — the `@` reference is in CLAUDE.md
  but the actual file isn't in the project tree.

## Choosing between them

If you're not sure, **use symlinks (the default)**. The mental model
is cleaner: one central directory, per-project link, edit-once-update-
everywhere. Switch to `@imports` only if you have a specific reason
(typically: you want the shared content visible inside CLAUDE.md for
human reading, not just for Claude's context).

## What lives in shared rules vs project CLAUDE.md

| Content | Goes in |
| --- | --- |
| Project tech stack, deployment, framework | Project CLAUDE.md |
| "Always use pnpm" / "Always run validate before commit" | Shared rules |
| Project-specific gotchas ("tsc must run from frontend/") | Project CLAUDE.md |
| Coding-style preferences true across all your projects | Shared rules |
| "How this team works" / "Who owns what" | Shared rules (or team-level) |

When unsure, default to project CLAUDE.md — moving a rule from project
to shared is easier than discovering a shared rule that should have
been project-scoped.

## Adding a new shared rule

```bash
# 1. Write the rule to the central dir
$EDITOR ~/.claude-cabinet-shared/rules/my-new-rule.md

# 2. That's it. All linked projects pick it up automatically next session.
```

If you used `@imports` instead, add the import line to each project's
CLAUDE.md after writing the rule.

## Removing a shared rule

```bash
# 1. Delete from the central dir
rm ~/.claude-cabinet-shared/rules/old-rule.md

# 2. All linked projects stop loading it automatically.
```

Or move it to a project-specific location if it should still apply
somewhere:

```bash
mv ~/.claude-cabinet-shared/rules/old-rule.md <project>/.claude/rules/
```
