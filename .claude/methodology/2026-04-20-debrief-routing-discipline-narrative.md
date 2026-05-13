# Debrief Routing Discipline — Narrative

Claude Cabinet — v0.24.0 release summary
2026-04-20

## The problem

When a session ends, Claude has learned things: a decision was made, a
gotcha was discovered, a constraint emerged. Those learnings need a
home that survives — somewhere a future session will find them,
accurate and un-rotted, months later.

Without a disciplined answer to "where does this go?", debriefs
invent homes ad-hoc. We audited five "project-scoped feedback" files
in one consuming project and found that four had rotted within seven
days because the underlying code had changed and no forcing function
caught the staleness. Loose markdown files next to code, written once
and never re-examined, turn out to be a reliably bad destination.

## The approach

Claude Cabinet v0.24.0 ships a routing discipline for debrief outputs.
Every session artifact now has exactly one real home, and the home
must have a forcing function — something that keeps the content
accurate when the code it describes changes:

- **Decisions** (architectural choices, accepted tradeoffs) route to
  omega semantic memory, which has contradiction detection: when a
  later decision supersedes an earlier one, the old entry gets marked
  rather than silently rotting.
- **Project constraints** (dev-workflow quirks, load-bearing
  conventions) route to the project's `CLAUDE.md` or briefing files,
  which get edited whenever the underlying code changes because
  they're loaded every session.
- **Conditional revisits** ("add a token blocklist if we get multi-
  user") route to pib-db as deferred actions with trigger conditions,
  re-evaluated at the start of every session.
- **CC upstream friction** embedded in project observations gets
  split out and filed as field feedback back to the source repo.
- **Loose `.md` files written next to code** are explicitly an anti-
  pattern, named as such in the phase file and flagged by the next
  orient's wrong-write scan.

## Specifics and scale

The discipline landed as an instruction phase — `record-lessons.md` —
that ships to every consuming project automatically. It joins three
other instruction phases (audit-pattern-capture, methodology-capture,
upstream-feedback) that together define what CC always does at session
close, regardless of per-project customization.

The v0.24.0 release also fixed a related bug: the orient feedback
pipeline had accumulated 27 undelivered outbox entries because the
flush was write-only — it copied items to the feedback directory but
never marked the outbox. We added skip-if-exists and atomic reset. And
we migrated five rotted files in the one affected consumer: four
deleted as obsolete (the auth system they described was ripped out),
one promoted into `CLAUDE.md`, two CC-applicable patterns extracted
and filed upstream.

Installed and committed across four registered repositories in one
pass.

## What makes this work

The load-bearing insight is that **forcing functions**, not
discipline, prevent rot. Asking humans (or Claude) to remember to
invalidate a `.md` file when the underlying code changes is a
reliable way to have stale docs. Routing each output to a destination
that has structural invalidation — omega's contradiction graph,
CLAUDE.md's load-every-session forcing, pib-db's per-orient trigger
re-evaluation — converts "remember to update this" into "the system
catches when this drifts."

## How you'd know it's working

In three months, a random consumer's debrief produces decisions,
constraints, and conditional revisits. Count how many land as loose
`.md` files: zero. Count how many get re-evaluated by orient: the
trigger-gated ones. Count how many omega memories get superseded
when code changes: some of them. When those numbers look right, the
discipline is holding.
