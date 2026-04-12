# "Built With Claude Cabinet" — Interactive Timeline Demo

## Concept

An interactive, scroll-driven timeline that walks through the story of
building the article-rewriter project with Claude Cabinet. Not a feature
tour — a transformation arc. CC shows up naturally in how things get done,
never as the headline.

**Target:** Single self-contained HTML file. No build step, no dependencies.
Visually premium — this is a product showcase, not an internal tool.

## Narrative Arc

Frustration → Philosophy → Extraction → Synthesis → Craft → Validation →
Expansion → Hardening

### Chapter 1: "The Problem"
A counseling student reads an academic article and can't understand it — not
because the ideas are hard, because the writing is hostile. He writes a paper
arguing that Rogers's facilitative conditions apply to prose, not just therapy.

- **Surface:** 2-3 sentences. The frustration. The thesis. The personal origin.
- **Expansion:** The COUN 6000 paper, the four source authorities, Rogers
  applied to writing (congruence = no jargon theater, empathy = moment-by-moment
  attention to meaning, UPR = never imposing comprehension as a condition of worth).
- **CC visible:** Nothing. Pure origin story.

### Chapter 2: "Scaffolding in 20 Minutes"
Day 1, session 1. Install CC, run /onboard, get plugin structure + briefing
files + 7-phase plan approved by cabinet. Structure before a single line of
product code.

- **Surface:** "From empty directory to approved plan in one session." Plan slug,
  7 phases, three skills that will be built.
- **Expansion:** The onboard interview. The /plan output with cabinet critique
  (QA insisting on testable criteria, architecture pushing settings system).
  First pib-db project. Plugin scaffold.
- **CC visible:** /onboard, /plan, cabinet critique, pib-db, briefing files.

### Chapter 3: "Reading Four Books"
Claude reads 4 source PDFs (15MB), extracts 83 writing principles, each tagged
to its source. Two sessions, ~6 hours of extraction.

- **Surface:** "83 principles extracted from 4 authorities." Source breakdown:
  Sword (27), Zinsser (16), Pinker (26), Williams & Bizup (14).
- **Expansion:** What extraction means — actionable rewriting operations, not
  summaries. Example principles. The 127KB raw extraction file.
- **CC visible:** /orient maintaining session continuity. Omega memory preserving
  decisions across context windows.

### Chapter 4: "83 Become 56"
Overlapping principles merge into multi-case principles. 83 raw → 56 active,
organized into 4 sequential passes (sentence → paragraph → document → fidelity)
plus 5 meta-principles.

- **Surface:** "Four passes. Sentence mechanics first. Fidelity last. Nothing
  deleted — everything merged or absorbed." Pass breakdown: 21 + 12 + 10 + 13.
- **Expansion:** Source concordance. Example merges. Application sequence within
  Pass 1. Context tags.
- **CC visible:** Plan Phase 5 executing. Decisions in omega. Status updated.

### Chapter 5: "Three Skills, One Framework"
Three skills (/rewrite, /summarize, /ask) share a settings system with 5
independent knobs and 4 named presets. Jargon taxonomy: structural (earn),
field shorthand (replace + footnote), decorative (cut).

- **Surface:** Three skills, one line each. Four presets as a spectrum from
  light touch to full transformation.
- **Expansion:** Settings knob design. Natural-language interpreter. Jargon
  taxonomy. /ask juxtaposition technique. Framework reference architecture.
- **CC visible:** pib-db tracking actions. Architectural decisions.

### Chapter 6: "Testing Against Reality"
Skills tested against a real article. All four presets produce meaningfully
different output. PDF pipeline built. Comparison view emerges — original and
rewritten side by side with principle annotations.

- **Surface:** "Four presets, four meaningfully different rewrites of the same
  passage." Before/after snippet.
- **Expansion:** Preset comparison test. What "meaningfully different" means.
  PDF pipeline. Comparison grid. Principle glossary.
- **CC visible:** Plan executing. pib-db actions completing.

### Chapter 7: "What Else Could This Be?"
Plugin → platform. Three strategic explorations: web app (React + Mantine +
FastAPI), medico-legal extension for plaintiff attorneys, business models.

- **Surface:** "From plugin to platform." Three directions in one sentence each.
- **Expansion:** Web app architecture research. Medico-legal opportunity (the
  attorney quote, UMLS API, Gigerenzer rules, $350/hr undercut). Business model
  analysis. 15 tracked actions across 2 active pib-db projects.
- **CC visible:** /plan for each workstream. Cabinet members (goal-alignment,
  architecture, vision) on strategy. pib-db tracking. Omega preserving context.

### Chapter 8: "Hardening"
Friction-tested against harder article. Real problems surface: chunking, PDF
extraction failures, annotation capture. Five hardening actions, all completed.

- **Surface:** "46 comparison footnotes on a real chapter. Every friction point
  found and fixed."
- **Expansion:** Five hardening actions. CC upgrades (v0.15.0, v0.16.0) mid-project
  with zero disruption. Validation results.
- **CC visible:** New pib-db project, 5 actions all completed. /debrief capturing
  lessons. CC upgrades as invisible infrastructure.

## Three Reading Depths

| Depth | Time | What You See |
|-------|------|-------------|
| Skim | 30s | 8 card titles + one compelling number each |
| Read | 3 min | 2-3 sentence surface content per card, full narrative |
| Explore | 10 min | Expanded artifacts: plan output, before/after, cabinet critique |

## CC Activity Representation

Don't label CC features. Show the *type of cognitive work*:
- **Orienting** — loading context, reading state (/orient, omega, briefings)
- **Planning** — structuring work, getting critique (/plan, cabinet, pib-db)
- **Executing** — doing the work (/execute, skills, file creation)
- **Reflecting** — evaluating, testing, recording (/audit, /debrief, omega)
- **Evolving** — upgrading infrastructure (/cc-upgrade, hardening, feedback)

CC feature names appear only in expanded detail layer.

## Visual Design

### Parallax Constellation Background
- Starts as stark dark plane (empty project)
- Early chapters: subtle grid lines form (structure emerging)
- Mid-timeline: faint interconnected nodes appear (growing process web)
- End: rich constellation of connected nodes (cabinet alive)
- Implementation: 3-4 fixed SVG/canvas layers with different parallax rates

### Chapter Cards
- Glassmorphic: `backdrop-filter: blur(12px)`, semi-transparent dark bg
- 1px gradient border by chapter type (blue=orient, amber=audit, green=decision, purple=cabinet)
- Hover: lift with spring easing, soft shadow increase
- Ghost chapter number: `font-weight: 200; font-size: 72px; opacity: 0.15`
- Type icon top-left (compass, magnifying glass, gavel, speech bubble)
- Monospace timestamp: "Session 3 / Day 2 / 14:23"

### Scroll-Driven Interactions
- `scroll-snap-type: y proximity` (gentle catch, not mandatory)
- `animation-timeline: view()` for card entrance animations
- Scroll-pause disclosure: IntersectionObserver + 400ms timeout → `.lingered` class
- Each chapter `min-height: 80vh`

### Typed-Replay Terminal Blocks
- Frame appears instantly (dark bg, window chrome dots)
- Content streams at ~3x speed with realistic pauses
- Key moments get color pulses (amber for findings, member accent colors)
- Click anywhere to complete animation instantly
- CSS `@keyframes` with `steps()` + `clip-path` per line

### The Meta-Move (Final Frame)
Background constellation freezes. Single prompt appears:
> "This timeline was built with Claude Code.
> The process that built it was managed by Claude Cabinet."
Small, understated CTA.

## What Gets Cut
- CC installation mechanics (.ccrc.json, manifest, npx commands)
- Raw session transcripts (extract key moments only)
- Git diffs and upgrade commits
- CC feature names at surface level
- Cabinet member names at surface level

## What Must Stay
- The personal origin (Chapter 1 makes it a story, not a tech demo)
- Before/after text (single most compelling proof point)
- The medico-legal pivot (side project → potential business)
- Numbers that show scale (83, 56, 46, $350/hr)
- The friction-and-fix cycle (CC supporting iteration)

## Tech Stack
- Single self-contained HTML file
- CSS: `scroll-timeline`, `animation-timeline: view()`, glassmorphism
- JS: `IntersectionObserver`, small `<canvas>` for constellation
- No dependencies, no build step
- Target: under 200 lines of JS

## Build Order
1. One premium card (visual foundation)
2. Scroll-driven reveal system
3. Terminal replay blocks
4. Background constellation
5. Content curation from real article-rewriter history
6. CC impact moments integration + polish

## Open Questions
- Which 2-3 moments get counterfactual treatment?
- What specific before/after text excerpt to feature?
- Theater-cheater as alternative/additional subject?
- Where to host the final demo?

## Source Material
- Project: /Users/orenmagid/article-rewriter
- 15 commits, 9 session transcripts, 56-principle framework
- 3 skills, 2 active follow-on projects, 15 tracked actions
- Strategic docs in docs/ (web app, medico-legal, business models)

## Evidenced CC Impact Moments

These are concrete, observed moments where CC process infrastructure made a
measurable difference — not speculation about what might have gone wrong.

### 1. "They are literally just titles!!!" (Session 1)
Claude bypassed /plan and manually created shallow pib-db actions. User caught
it. After running proper cabinet critique, QA imposed scope caps and testable
criteria, architecture pushed file split decision. Correction captured as
memory — never happened again. 12 detailed work items replaced paper-thin titles.

### 2. Orient catches stale state (Session 7)
Orient reported: "system-status.md says 'Next: test skills against real articles'
but that action is already completed per pib-db." User immediately knew the
status file was wrong and could decide what to actually work on.

### 3. Friction capture → hardening project (Sessions 8-9)
Annotation quality was ~80% when reconstructing comparison footnotes after the
fact. Friction captured, promoted to 5-action project, fixed — capture now
happens during passes. Validated with 46 footnotes on real chapter.

### 4. Historian catches 3 uncaptured decisions (Debrief, Session 9)
During debrief, historian found 3 of 8 session decisions not persisted anywhere.
Flagged before context was lost.

### 5. Record-keeper catches invisible docs (Debrief, Session 9)
Medico-legal extension and business model docs existed but weren't reflected in
system-status.md. Record-keeper proposed fixes, committed as ed2d035. Next
session's orient would have been blind to two new workstreams.

### 6. "No speculation" memory prevents repeat friction
User said "how do I know? This doesn't exist yet" when asked speculative
questions. Captured as memory. Never happened again. One correction, permanent fix.

### 7. Upstream feedback loop
4 real dogfooding friction items (port collision, plugin indexing gap, CLI UX,
missing skill) filed to CC source repo. Later addressed in CC releases.

### The Numbers
- 9 sessions over 3 days, 5 opened with /orient
- 36 actions across 5 projects tracked in pib-db
- 3 projects completed (all actions done, project closed)
- 5 persistent memories + omega semantic memory
- 1 enforcement pattern consolidated from 3+ observations
- 4 upstream feedback items filed to CC

## Cabinet Input
- **UI Experimentalist:** Fog-of-war progressive disclosure, typed-replay
  terminals, parallax constellation, card physicality, meta-move finale
- **Information Designer:** 8-chapter narrative arc, three reading depths,
  cognitive work verbs instead of feature labels, what to cut/keep
- **Process Therapist:** 8 concrete impact points with evidence, friction-to-
  fix cycle, plan critique shaping the build, memory preventing repeat errors
- **Workflow Cop:** Session lifecycle evidence (5/9 with orient), work tracking
  numbers (36 actions/5 projects), debrief maintaining doc accuracy, upstream
  feedback loop closing
