# Context File System — Guide

The perspective system uses **split context files** instead of a single
monolithic `_context.md`. Each file focuses on one domain of project
knowledge, and perspectives declare which files they need in their
frontmatter. This keeps context loading focused — a perspective that
only needs identity and scopes doesn't load API configuration or work
tracking details.

## Architecture

A **hub file** (`_context.md`) indexes the focused context files that
exist for this project. Perspectives read the specific files they need
rather than parsing one large document.

```
_context.md                  ← Hub/index (always exists)
_context-identity.md         ← What the project is (always exists)
_context-architecture.md     ← System structure, codebase layout
_context-scopes.md           ← Where to look (scan scopes)
_context-cabinet.md          ← Active perspectives, lane rules
_context-work-tracking.md    ← Work item storage and interfaces
_context-api.md              ← API config, entity types
_context-{domain}.md         ← Domain extensions (see below)
```

## File Descriptions

### `_context.md` — Hub/Index
**Always created.** Lists which context files exist and a one-line
summary of each. This is what perspectives fall back to if they don't
declare specific context needs.

### `_context-identity.md` — Project Identity
**Always created.** What the project is, core principles, user context.
Every perspective needs this — it calibrates all findings. Template:
`_context-identity-template.md`.

### `_context-architecture.md` — Architecture
System structure, codebase layout, technology stack. Needed by
perspectives that evaluate code structure or need to understand where
things live. Template: `_context-architecture-template.md`.

### `_context-scopes.md` — Scan Scopes
Where to look for different kinds of code and configuration. Sections
are referenced by name (e.g., "App Source", "Data Store"). Only fill in
sections relevant to the perspectives you adopt. Template:
`_context-scopes-template.md`.

### `_context-cabinet.md` — Perspective Cabinet
Which perspectives are active, lane rules, invocation patterns.
Needed by meta-perspectives that evaluate the perspective system itself.
Template: `_context-cabinet-template.md`.

### `_context-work-tracking.md` — Work Tracking
How the project tracks planned work — storage, query interface,
mutation interface. Referenced by /plan, /execute, /orient, /debrief.
Template: `_context-work-tracking-template.md`.

### `_context-api.md` — API Configuration
Endpoints, auth, entity types. Only create this if the project has an
API. Template: `_context-api-template.md`.

## Perspective-to-Context Mapping

Which perspectives need which context files (identity is always loaded):

| Perspective           | architecture | scopes | cabinet | work-tracking | api |
|-----------------------|:---:|:---:|:---:|:---:|:---:|
| accessibility         |     |  x  |     |     |     |
| anti-confirmation     |     |     |     |     |     |
| architecture          |  x  |  x  |     |     |     |
| boundary-conditions   |  x  |  x  |     |     |     |
| cor-health            |     |  x  |  x  |     |     |
| data-integrity        |  x  |  x  |     |     |  x  |
| debugger              |  x  |     |     |     |     |
| documentation         |     |  x  |     |     |     |
| historian             |  x  |     |     |     |     |
| meta-process          |     |  x  |  x  |     |     |
| mobile-responsiveness |     |  x  |     |     |     |
| organized-mind        |  x  |     |     |     |     |
| performance           |  x  |  x  |     |     |     |
| process               |     |  x  |     |     |     |
| qa                    |  x  |  x  |     |     |     |
| security              |  x  |  x  |     |     |  x  |
| skills-coverage       |     |     |  x  |     |     |
| system-advocate        |     |     |  x  |     |     |
| technical-debt        |  x  |     |     |     |     |
| usability             |     |  x  |     |     |     |

## Domain Extension Files

Specialized perspectives may need domain-specific context that doesn't
fit the standard files. These are created by `/seed` when a specialized
perspective is adopted:

- **`_context-methodology.md`** — For methodology-compliance or GTD
  perspectives. Contains methodology rules, review cadences, horizon
  definitions.
- **`_context-design-system.md`** — For framework-quality or
  information-design perspectives. Contains design tokens, component
  conventions, layout patterns.
- **Any `_context-{domain}.md`** — A perspective can declare any context
  file it needs in its frontmatter. If the file doesn't exist, the
  perspective falls back to the hub.

## Files Are Optional

Only create context files relevant to your project. A CLI tool with no
UI doesn't need `_context-scopes.md` App Source. A project without an
API skips `_context-api.md` entirely. The hub `_context.md` lists what
exists so perspectives know what's available.

## How These Files Get Created

- **/onboard** generates the initial set from interview answers. It
  always creates the hub and identity file. Other files are created
  only if the interview produced content for them.
- **/seed** adds domain extension files when specialized perspectives
  are adopted.
- **/cor-upgrade** can migrate a monolithic `_context.md` into the
  split format.

## Backward Compatibility

The old monolithic `_context.md` format still works. If a perspective
declares context files in its frontmatter but those files don't exist,
or if no `context` field is present, the system falls back to reading
`_context.md` directly. This means:

- Existing projects with a monolithic `_context.md` continue to work
  without changes.
- Projects can migrate incrementally — split out one file at a time.
- `/cor-upgrade` handles the full migration when the project is ready.

## Finding Format

When producing audit findings, use this structure:

```yaml
finding:
  perspective: perspective-name
  severity: critical | significant | minor | informational
  category: what domain this falls under
  description: what was found
  evidence: specific file:line or observation
  recommendation: what to do about it
```
