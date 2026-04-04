# Detect State — Scan PIB Artifacts and Determine Mode

Scan the project for existing PIB artifacts to determine whether this is
a first run, early re-run, or mature re-run. The mode determination
drives how every subsequent phase behaves.

When this file is absent or empty, the default behavior is: scan for the
standard PIB artifact set, classify each artifact's richness, and
determine the mode. To explicitly skip state detection (force first-run
mode), write only `skip: true`.

## Pre-Check: Is the CLI Installed?

Before scanning artifacts, check whether `create-claude-rails` has been
run in this directory. The signal is `.pibrc.json` at the project root.

**If `.pibrc.json` is absent:** The CLI hasn't been run. The skeleton
skills, hooks, and settings aren't installed yet. Run the CLI first:

```bash
npx create-claude-rails --yes
```

Use `--yes` to accept defaults — the interview (this skill) handles all
the intelligent configuration. The CLI just puts files in place.

After the CLI finishes, read `.pibrc.json` and tell the user what was
installed:

> "I just set up Claude on Rails for this project. Here's what was
> installed: [list modules from .pibrc.json]. We'll configure everything
> in a moment — first, let me learn about your project."

Do not ask the user to run the CLI manually — just run it.

**If `.pibrc.json` exists:** The CLI has been run. Proceed to scanning.

## What to Scan

Check for these artifacts and classify each as absent, empty, or populated:

| Artifact | Path Pattern | Indicates |
|----------|-------------|-----------|
| Project context | `_context.md` or `.claude/skills/perspectives/_context.md` | Context layer exists |
| System status | `system-status.md` | State tracking exists |
| Orient phases | `.claude/skills/orient/phases/*.md` | Session loop is wired |
| Debrief phases | `.claude/skills/debrief/phases/*.md` | Session loop is wired |
| Work tracking DB | `pib.db` | Work tracking is active |
| Perspective groups | `_groups.yaml` or `.claude/skills/perspectives/_groups.yaml` | Audit system configured |
| Memory patterns | `memory/patterns/*.md` | Feedback loop is active |
| CLAUDE.md | Root `CLAUDE.md` | Project instructions exist |
| Rules files | `.claude/rules/*.md` | Scoped instructions exist |
| Hook config | `.claude/settings.json` or `.claude/settings.local.json` | Enforcement hooks exist |

## Mode Determination

**First run:** `_context.md` does not exist. No PIB context layer has been
generated yet. Even if other artifacts exist (e.g., a CLAUDE.md written
by hand), the absence of the generated context file means onboard hasn't
run before.

**Early re-run:** `_context.md` exists but the artifact set is sparse.
Fewer than 5 of the scanned artifacts are populated. The session loop
may be wired but modules like work tracking, audit, and enforcement are
not yet active. The project is young — it has been through a few sessions
but hasn't accumulated rich process infrastructure.

**Mature re-run:** `_context.md` exists and 5 or more scanned artifacts
are populated. The project has a working session loop, some form of work
tracking, and at least one additional module (audit, enforcement, or
memory). The context layer has had time to accumulate gaps and drift.

## Output

Report findings as a structured summary that subsequent phases can
reference:

```
Mode: first-run | early-rerun | mature-rerun

Artifacts found:
  - _context.md: populated (last modified 2026-03-15)
  - system-status.md: populated
  - orient phases: 3 files (context.md, work-scan.md, health-checks.md)
  - debrief phases: 2 files (inventory.md, update-state.md)
  - pib.db: absent
  - memory patterns: 4 files
  ...

Summary: Early re-run. Session loop is wired but work tracking and
audit are not yet active. Context layer is 3 weeks old.
```

This summary is not presented to the user directly — it feeds into the
interview phase so questions can be targeted. The user sees the mode
reflected in the questions they're asked, not as a diagnostic report.
