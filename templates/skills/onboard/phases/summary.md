# Summary — Present What Was Generated or Changed

Close the onboard session with a clear accounting of what happened,
what was deferred, and what comes next. The user should leave knowing
exactly what files exist, what they do, and what the next step is.

When this file is absent or empty, the default behavior is: present a
structured summary as described below. To explicitly skip the summary,
write only `skip: true`.

## First-Run Summary

Present three sections:

### Files Generated

List every file that was created, with a one-line description of what
it does and where it's read:

```
Created:
  cabinet/_briefing.md
    Project identity and configuration. Read by all cabinet members.

  system-status.md
    Current state tracking. Read by orient, updated by debrief.

  .claude/skills/orient/phases/context.md
    What orient reads at session start. Points at _briefing.md and
    system-status.md.

  .claude/skills/orient/phases/data-sync.md
    How to pull fresh data from [remote store]. Runs at session start.
```

### Modules Adopted

List which modules were selected and what they provide:
```
Adopted:
  Session loop (orient + debrief) — MANDATORY
  Work tracking (pib-db) — set up with initial backlog

Deferred:
  Planning — will revisit when task complexity increases
  Compliance stack — no recurring patterns to encode yet
  Audit loop — codebase too small for systematic review
  Capability seeding — not needed yet
```

### What to Do Next

Concrete next steps, not abstract advice:
- "Run `/orient` to start your first CC session. It will read the
  briefing files we just generated."
- "After your first working session, run `/debrief` to close the loop."
- "The briefing files are rough. After 3-5 sessions, run `/onboard` again
  to refine based on what you've learned."

Emphasize progressive refinement: these files are a starting point. The
session loop will reveal what's missing, and re-running onboard captures
those discoveries.

## Re-Run Summary

For re-runs, present a before/after view:

### Changes Made

Show each file that was modified with a summary of what changed and why:
```
Updated:
  _briefing.md
    Added scan scope for tests/ directory (orient wasn't checking tests).
    Updated architecture section to reflect new API layer.

  orient/phases/health-checks.md
    Added deploy pipeline check (user reported stale deploys going unnoticed).

  Removed:
    orient/phases/auto-maintenance.md
      Symlink check was running every session but symlinks haven't changed
      in 6 weeks. Retired.
```

### Unchanged

Note what was reviewed but left as-is, so the user knows it was
considered:
```
Reviewed, no changes:
  system-status.md — still accurate
  debrief/phases/update-state.md — working as intended
```

### Module Status Changes

If any modules were adopted or retired during this re-run:
```
Newly adopted:
  Compliance stack — added first .claude/rules/ file for API conventions

Retired:
  (none this run)

Still deferred:
  Audit loop — revisit when codebase grows
```

### Next Steps

Same as first-run but adapted to the project's maturity:
- What to watch for in the next few sessions
- When to consider the next re-run
- Any manual steps that onboard couldn't automate

## Tone

Keep it factual and brief. The user just had a conversation — they don't
need the conversation summarized back to them. They need to know what
files exist, what changed, and what to do next. Every line in the summary
should be actionable or informational, not decorative.
