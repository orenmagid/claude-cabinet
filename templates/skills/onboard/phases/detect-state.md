# Detect State — Scan Claude Cabinet Artifacts and Determine Mode

Scan the project for existing CoR artifacts to determine whether this is
a first run, early re-run, or mature re-run. The mode determination
drives how every subsequent phase behaves.

When this file is absent or empty, the default behavior is: scan for the
standard CoR artifact set, classify each artifact's richness, and
determine the mode. To explicitly skip state detection (force first-run
mode), write only `skip: true`.

## Fast Path

Check for `_briefing.md` (or `cabinet/_briefing.md`).
If it doesn't exist, the mode is **first-run** — skip the full scan and
move to the interview immediately. No need to check 10 artifact types
when the primary signal is absent.

Also read `.corrc.json` if it exists — it records which modules the CLI
installed and which were skipped (with reasons). The interview phase uses
this to skip redundant questions.

## User-Level State

Before scanning the project, check the user-level layer:

- **`~/.claude/CLAUDE.md`** — does a user profile exist? If yes, the
  interview can skip identity questions. If it's sparse or stale (e.g.,
  mentions a role the user seems to have moved past), flag it for the
  interview phase to offer an update.
- **`~/.claude/cor-registry.json`** — how many other projects does this
  user have? The interview phase uses this to ask about relationships
  between projects. If the registry doesn't exist, skip — the user may
  have installed via npm instead of the shell installer.

## Full Scan (re-runs only)

Only when `_briefing.md` exists, scan these artifacts to distinguish
early vs mature re-run:

| Artifact | Path Pattern | Indicates |
|----------|-------------|-----------|
| System status | `system-status.md` | State tracking exists |
| Orient phases | `.claude/skills/orient/phases/*.md` | Session loop is wired |
| Debrief phases | `.claude/skills/debrief/phases/*.md` | Session loop is wired |
| Work tracking DB | `pib.db` | Work tracking is active |
| Cabinet committees | `committees.yaml` or `cabinet/committees.yaml` | Audit system configured |
| Memory patterns | `memory/patterns/*.md` or `.claude/memory/patterns/*.md` | Feedback loop is active |
| CLAUDE.md | Root `CLAUDE.md` | Project instructions exist |
| Rules files | `.claude/rules/*.md` | Scoped instructions exist |
| Hook config | `.claude/settings.json` or `.claude/settings.local.json` | Enforcement hooks exist |

**Early re-run:** Fewer than 5 of the above are populated.
**Mature re-run:** 5 or more are populated.

## Output

For first-run: `Mode: first-run` — that's it. Move on.

For re-runs, report a structured summary that subsequent phases can
reference:

```
Mode: early-rerun | mature-rerun

Artifacts found:
  - system-status.md: populated
  - orient phases: 3 files (context.md, work-scan.md, health-checks.md)
  - pib.db: absent
  - memory patterns: 4 files
  ...

Summary: Early re-run. Session loop is wired but work tracking and
audit are not yet active. Context layer is 3 weeks old.
```

This summary is not presented to the user directly — it feeds into the
interview phase so questions can be targeted. The user sees the mode
reflected in the questions they're asked, not as a diagnostic report.
