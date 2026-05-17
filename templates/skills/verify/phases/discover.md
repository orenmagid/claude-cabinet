# /verify learn — Discover phase

Default behavior for the discover phase. Customize this file per project
if your codebase has unusual conventions for finding UI surfaces.

## What discovery is for

Before drafting scenarios, /verify learn needs to know what surfaces
the consuming project actually exposes. Discovery is a fast pass that
catalogues:

- Routes and pages
- Top-level UI components (screens, layouts, modals)
- Personas (user roles inferred from auth/admin patterns)
- Existing project memory tagged with "key flows" or similar

The output of discovery is a structured summary (≤20 items per
category) that feeds into the `draft.md` phase.

## Parallel subagent fan-out (default)

Dispatch four parallel subagents in a single message. Each receives a
narrow scope and returns a structured summary. This protects the main
session's context from grep noise — the agents read excerpts, the
main session reads their summaries.

**Execution rules (Claude Code platform):**
- All Agent tool calls MUST appear in the SAME assistant message. The
  harness only parallelizes within-message tool calls; splitting into
  separate messages serializes them and loses the context-protection
  benefit.
- Use `subagent_type: 'Explore'` for subagents 1–3 (read-only search
  agents). Use `subagent_type: 'general-purpose'` for subagent 4 (the
  live UI crawl needs broader tool access for Playwright).
- Subagents cannot themselves spawn subagents — keep each subagent's
  task scope narrow enough to run inline.

### Subagent 1: Route scan

**Task:** Find all UI routes in the project. Look for the framework's
router config (react-router config file, Next.js app/ or pages/ tree,
SvelteKit routes/, Vue Router config, FastAPI route mounts for
server-rendered apps).

**Return:** Up to 20 entries of `{routePattern, file, description}`.
description is a one-line summary of what the route shows (read the
page component if needed, but don't read more than 50 lines).

### Subagent 2: Component scan

**Task:** Find top-level page/screen components. These are the
components most often referenced in user journeys — landing page, app
shell, settings page, admin dashboard.

**Return:** Up to 20 entries of `{componentName, file, description}`.

### Subagent 3: Memory scan

**Task:** Query omega memory (if `~/.claude-cabinet/omega-venv/bin/omega`
exists) for "key flows" / "critical user paths" / "important journeys"
type queries. Also scan `.claude/memory/` markdown files for similar.

**Return:** Up to 10 entries of `{topic, source, summary}`.

### Subagent 4 (optional): Live UI crawl

**Task:** Only if user opted in during calibrate. Launch Playwright,
visit the dev stack URL, crawl reachable pages by following links from
the landing page (depth 2). Capture screenshots.

**Return:** Up to 20 entries of `{url, title, captureBytes}`.

This subagent is opt-in because it requires the dev stack running. The
default skips it and relies on routes + components.

## Cap discovery output

20 items per category × 4 categories = up to 80 items handed to the
draft phase. The draft phase compresses these into ≤5 scenarios. If
discovery returns more than 80 items, the project is unusually large
and the user should narrow `/verify learn` to a specific surface
(e.g., "learn admin flows only"). For v0.1.0, the skill doesn't
support surface filtering — escalate to the user.

## Routing shape (path vs hash)

While scanning routes (subagent 1), determine whether the project uses
**path routing** (`/forecast`, `/people`) or **hash routing**
(`#forecast`, `#people`). Hash routing is common in projects with no
backend server, single-bundle SPAs deployed on static hosts, or
projects that started with React Router's `HashRouter` for legacy
reasons.

Signals that suggest hash routing:

- `import { HashRouter } from 'react-router-dom'` in the app entry
- `useHashTab`, `parseHash`, `window.location.hash` references in
  routing-adjacent files
- A route table where entries look like `{ hash: 'forecast', ... }`
  instead of `{ path: '/forecast', ... }`
- Any link element using `href="#foo"` for in-app navigation rather
  than anchor links to page sections

If hash routing is detected, emit a `routingShape: "hash"` field in
the discovery report so the generate phase produces `#route` instead
of `/route` in generated `.feature` files. Otherwise, default to
`routingShape: "path"`.

Without this probe, generated feature files use `When I navigate to
"/forecast"` against a `#forecast` app and every scenario fails at
step 1 — Flow's cold-start hit this exact mismatch.

## Persona signals

While running subagent 1 (route scan), look for auth/admin patterns
that suggest distinct personas:

- An `/admin` route prefix or RequireAdmin guard component → admin persona
- A `/signup` or `/invite/<token>` route → fresh-user persona
- Multiple auth providers (e.g., SSO + password) → potentially multiple personas

Persona signals feed into the calibrate phase ("I see admin routes but
only one admin in your project's auth fixtures — real persona or fold
into main?").

## Output shape

Discovery returns a single object passed to `draft.md`:

```ts
interface DiscoveryReport {
  routes: Array<{ routePattern: string; file: string; description: string }>;
  components: Array<{ componentName: string; file: string; description: string }>;
  memoryHits: Array<{ topic: string; source: string; summary: string }>;
  crawlHits?: Array<{ url: string; title: string }>;
  personaSignals: Array<{ signal: string; suggestedPersona: string }>;
  routingShape: "path" | "hash";
}
```

The main session writes this to a scratch file (e.g.,
`/tmp/verify-learn-discovery-<ts>.json`) for the draft phase to read.
Cleared after `learn` completes.
