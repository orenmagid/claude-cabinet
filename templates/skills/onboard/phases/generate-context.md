# Generate Context — Create or Update Context Files

Transform interview answers into the files that make the rest of Claude on Rails
functional. This is where conversation becomes infrastructure — but it
is always a proposal, never an imposition.

When this file is absent or empty, the default behavior is: generate
or update files as described below, always showing the user what will
be created or changed before writing. To explicitly skip context
generation, write only `skip: true`.

## First-Run Generation

Create split context files from interview answers. The perspective system
uses focused files instead of one monolith — see `_context-template.md`
for the full architecture guide.

### Always generate

**`_context.md`** — The hub/index file. Lists which context files were
created and a one-line summary of each. Always created first.

**`_context-identity.md`** — Use `_context-identity-template.md` as the
starting point. Populate from interview answers:
- **What This Project Is** — from identity questions
- **Core Principles** — from pain points and priorities
- **User Context** — from who works on the project

**`_context-architecture.md`** — Use `_context-architecture-template.md`.
Populate from interview answers:
- **System Structure** — from tech stack and architecture discussion
- **Codebase Layout** — from where code lives
- **Technology Stack** — from frameworks, libraries, databases discussed

### Generate if interview covered it

**`_context-scopes.md`** — Use `_context-scopes-template.md`. Only create
if the interview revealed specific paths and locations. Populate from
architecture discussion (where does code live, where is the DB, where
are deploy configs?). Only fill in sections that have real content.

**`_context-cabinet.md`** — Use `_context-cabinet-template.md`. Only
create after perspective selection (during or after onboard). Lists which
perspectives are active and how they're grouped.

**`_context-work-tracking.md`** — Use `_context-work-tracking-template.md`.
Only create if work tracking was discussed in the interview — where items
live, how to query them, how to mutate them.

**`_context-api.md`** — Use `_context-api-template.md`. Only create if
the project has an API and the interview covered endpoints, auth, or
entity types.

### Rules

- **Never generate empty files.** Only create a context file if the
  interview produced real content for it. An absent file is better than
  one full of placeholders.
- **The hub lists what exists.** After creating individual files, update
  `_context.md` to index them with one-line summaries.
- **Old monolithic format still works.** If migrating from an existing
  monolithic `_context.md`, `/cor-upgrade` handles the split. Don't
  rewrite an existing monolith during onboard re-runs — propose the
  migration instead.

### CLAUDE.md Additions

If the project already has a CLAUDE.md, propose additions — don't
overwrite. If it doesn't, generate an initial one with:
- Project description (1 paragraph)
- Key files and directories
- Conventions and constraints from the interview
- Any "Claude should always/never" rules that emerged

### system-status.md

Create an initial state tracking file with:
- What's built (current state of the project)
- What's active (current focus areas)
- What's planned (near-term intentions from the interview)

Keep it concise. This file gets updated every debrief — it doesn't
need to be comprehensive on day one.

## Re-Run Updates

For existing files, never overwrite silently. The protocol:

1. Read the current file content
2. Identify what the interview suggests should change
3. Present proposed changes as clear before/after diffs
4. Let the user approve, modify, or reject each change
5. Apply approved changes

Common re-run updates:
- Adding scan scopes that were missing (user said "perspectives never
  check my tests directory")
- Updating architecture sections after a stack change
- Adding new core principles discovered through use
- Updating work tracking configuration after switching tools
- Removing stale information that no longer applies

## Update Project Registry

After generating the context layer, update `~/.claude/cor-registry.json`
with what you learned from the interview. The installer registers the
project with just its folder name and an empty description — onboard
is where the real name and description get filled in.

Find this project's entry by path and update:
- **`name`** — the project's actual name (from the interview, not the
  folder name, unless they match)
- **`description`** — one line about what the project does

This is a silent update — don't ask the user to confirm registry changes
separately. The information already came from the interview.

## Quality Standards

- **Populated, not padded.** Every section should contain real project
  information, not generic advice or placeholder text.
- **Specific paths, not patterns.** "Server code lives in `src/server/`"
  not "The server code directory."
- **Decisions, not descriptions.** "We use PostgreSQL because X" carries
  more context than "Database: PostgreSQL."
- **The user's voice.** Use language from the interview. If they called
  it "the deploy pipeline" don't write "CI/CD infrastructure."
