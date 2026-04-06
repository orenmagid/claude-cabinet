# Briefing File System — Guide

The cabinet system uses **split briefing files** instead of a single
monolithic `_briefing.md`. Each file focuses on one domain of project
knowledge, and cabinet members declare which files they need in their
frontmatter. This keeps briefing loading focused — a cabinet member that
only needs identity and paths doesn't load API configuration or work
tracking details.

## Architecture

A **hub file** (`_briefing.md`) indexes the focused briefing files that
exist for this project. Cabinet members read the specific files they need
rather than parsing one large document.

```
_briefing.md                  ← Hub/index (always exists)
_briefing-identity.md         ← What the project is (always exists)
_briefing-architecture.md     ← System structure, codebase layout
_briefing-scopes.md           ← Where to look (paths)
_briefing-cabinet.md          ← Active cabinet members, portfolio rules
_briefing-work-tracking.md    ← Work item storage and interfaces
_briefing-api.md              ← API config, entity types
_briefing-{domain}.md         ← Domain extensions (see below)
```

## File Descriptions

### `_briefing.md` — Hub/Index
**Always created.** Lists which briefing files exist and a one-line
summary of each. This is what cabinet members fall back to if they don't
declare specific briefing needs.

### `_briefing-identity.md` — Project Identity
**Always created.** What the project is, core principles, user context.
Every cabinet member needs this — it calibrates all findings. Template:
`_briefing-identity-template.md`.

### `_briefing-architecture.md` — Architecture
System structure, codebase layout, technology stack. Needed by
cabinet members that evaluate code structure or need to understand where
things live. Template: `_briefing-architecture-template.md`.

### `_briefing-scopes.md` — Paths
Where to look for different kinds of code and configuration. Sections
are referenced by name (e.g., "App Source", "Data Store"). Only fill in
sections relevant to the cabinet members you adopt. Template:
`_briefing-scopes-template.md`.

### `_briefing-cabinet.md` — Cabinet
Which cabinet members are active, portfolio rules, invocation patterns.
Needed by meta cabinet members that evaluate the cabinet system itself.
Template: `_briefing-cabinet-template.md`.

### `_briefing-work-tracking.md` — Work Tracking
How the project tracks planned work — storage, query interface,
mutation interface. Referenced by /plan, /execute, /orient, /debrief.
Template: `_briefing-work-tracking-template.md`.

### `_briefing-api.md` — API Configuration
Endpoints, auth, entity types. Only create this if the project has an
API. Template: `_briefing-api-template.md`.

## Cabinet Member-to-Briefing Mapping

Which cabinet members need which briefing files (identity is always loaded):

| Cabinet Member        | architecture | scopes | cabinet | work-tracking | api |
|-----------------------|:---:|:---:|:---:|:---:|:---:|
| accessibility         |     |  x  |     |     |     |
| anti-confirmation     |     |     |     |     |     |
| architecture          |  x  |  x  |     |     |     |
| boundary-man          |  x  |  x  |     |     |     |
| cor-health            |     |  x  |  x  |     |     |
| data-integrity        |  x  |  x  |     |     |  x  |
| debugger              |  x  |     |     |     |     |
| record-keeper         |     |  x  |     |     |     |
| historian             |  x  |     |     |     |     |
| process-therapist     |     |  x  |  x  |     |     |
| small-screen          |     |  x  |     |     |     |
| organized-mind        |  x  |     |     |     |     |
| speed-freak           |  x  |  x  |     |     |     |
| workflow-cop          |     |  x  |     |     |     |
| qa                    |  x  |  x  |     |     |     |
| security              |  x  |  x  |     |     |  x  |
| roster-check          |     |     |  x  |     |     |
| system-advocate        |     |     |  x  |     |     |
| technical-debt        |  x  |     |     |     |     |
| usability             |     |  x  |     |     |     |

## Domain Extension Files

Specialized cabinet members may need domain-specific briefing that doesn't
fit the standard files. These are created by `/seed` when a specialized
cabinet member is adopted:

- **`_briefing-methodology.md`** — For methodology-compliance or GTD
  cabinet members. Contains methodology rules, review cadences, horizon
  definitions.
- **`_briefing-design-system.md`** — For framework-quality or
  information-design cabinet members. Contains design tokens, component
  conventions, layout patterns.
- **Any `_briefing-{domain}.md`** — A cabinet member can declare any briefing
  file it needs in its frontmatter. If the file doesn't exist, the
  cabinet member falls back to the hub.

## Files Are Optional

Only create briefing files relevant to your project. A CLI tool with no
UI doesn't need `_briefing-scopes.md` App Source. A project without an
API skips `_briefing-api.md` entirely. The hub `_briefing.md` lists what
exists so cabinet members know what's available.

## How These Files Get Created

- **/onboard** generates the initial set from interview answers. It
  always creates the hub and identity file. Other files are created
  only if the interview produced content for them.
- **/seed** adds domain extension files when specialized cabinet members
  are adopted.
- **/cor-upgrade** can migrate a monolithic `_briefing.md` into the
  split format.

## Backward Compatibility

The old monolithic `_briefing.md` format still works. If a cabinet member
declares briefing files in its frontmatter but those files don't exist,
or if no `briefing` field is present, the system falls back to reading
`_briefing.md` directly. This means:

- Existing projects with a monolithic `_briefing.md` continue to work
  without changes.
- Projects can migrate incrementally — split out one file at a time.
- `/cor-upgrade` handles the full migration when the project is ready.

## Finding Format

When producing audit findings, use this structure:

```yaml
finding:
  cabinet-member: member-name
  severity: critical | significant | minor | informational
  category: what domain this falls under
  description: what was found
  evidence: specific file:line or observation
  recommendation: what to do about it
```
