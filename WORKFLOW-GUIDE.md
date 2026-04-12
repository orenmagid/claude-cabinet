# How to Use Claude Cabinet

You've installed Claude Cabinet and run `/onboard`. You know the basic
habit: `/orient` at the start, `/debrief` at the end. This guide covers
everything else — when to use which command, what the cabinet is actually
doing for you, and how the system grows with your project.

## The Daily Habit

Every session follows the same shape:

```
/orient → do your work → /debrief
```

**`/orient`** reads what happened last time, checks what's on your plate,
and tells you what needs attention. It takes about 30 seconds. If you're
in a hurry, `/orient-quick` gives you just the essentials.

**`/debrief`** records what you accomplished, closes finished tasks,
captures lessons, and prepares the briefing for next time. It also
checks if your docs are up to date and flags anything that drifted.
If you're in a hurry, `/debrief-quick` does the core work without
the full report.

**The habit is the whole point.** Without it, every session starts from
scratch. With it, each session picks up where the last one left off.
Skip orient and you spend the first 10 minutes re-explaining. Skip
debrief and the next orient shows stale information.

## When to Use What

### You want to build something

**Start with `/plan`.** Don't just dive into building. Tell Claude what
you want and say `/plan`. Claude will:

1. Research your codebase to understand what exists
2. Draft a plan with specific steps, files to change, and testable
   success criteria
3. Run the plan past relevant cabinet members — security might flag a
   missing auth check, QA might flag an untestable criterion
4. Present the plan for your approval

Once you approve, use `/execute` to implement it. Claude works through
the plan step by step with checkpoints — cabinet members review the
changes at each stage. When it's done, every success criterion gets
verified before the work is marked complete.

**Why not just say "build me X"?** You can. Claude will do it. But
without planning, you get code that misses edge cases, duplicates
existing work, and can't be verified. The plan takes 2 minutes. The
rework from skipping it takes 20.

### You need to understand something first

**Use `/investigate`.** Before planning a change, if you're not sure
how something works or why something is happening, say `/investigate`
followed by your question:

```
/investigate how does the payment processing work?
```

Claude systematically explores: gathers facts, forms hypotheses, tests
them, and gives you a structured answer. When the investigation reveals
something actionable, the next step is `/plan`.

### You want a quality check

**Use `/audit`.** This convenes your full cabinet — all 30 experts
review your project from their perspective. Security checks for
vulnerabilities. Accessibility checks for usability. Architecture
checks for structural problems. The record-keeper checks if your docs
match reality. Each expert stays in their lane and produces concrete
findings.

After the audit runs, use `/triage-audit` to review findings. You
decide what to fix, defer, or reject. Approved findings become work
items you can plan and execute.

**How often?** There's no rule. Run one when you've made significant
changes, when you're about to ship something, or when you just want
a health check. Some people audit weekly. Some audit before every
release. Find what works for you.

### You want to see your tasks

**Use `/work-tracker`.** This opens a visual interface showing your
projects and tasks. You can see what's open, what's done, what's
flagged. It's the same data that `/orient` reads from — just in a
browsable format.

### You want to talk to a specific expert

**Use `/cabinet`.** This shows you who's in your cabinet and lets you
consult one directly:

```
/cabinet architect
```

Claude adopts that expert's perspective and evaluates whatever you're
working on through that lens. Useful when you want a specific kind of
feedback without running a full audit.

### You want to see what's available

**Use `/menu`.** Shows every command with a description. If you forget
what something does, start here.

## What the Cabinet Does (Without You Asking)

The 30 cabinet members aren't just for audits. They activate
automatically at key moments:

**During planning** — When you `/plan`, relevant experts critique your
approach before you build. The security expert checks for auth gaps.
The QA expert checks if your success criteria are actually testable.
The architect checks if your approach fits the existing system.

**During execution** — When you `/execute`, experts review your changes
at checkpoints. They catch issues that code review alone would miss:
data integrity violations, boundary conditions, security gaps.

**During orient and debrief** — Some experts activate automatically at
session start and end. The historian verifies your decisions were
captured. The record-keeper checks your docs. The system advocate
tracks whether features you built are actually getting used.

**You don't manage this.** You don't pick which experts activate or
when. They self-select based on what you're doing. You'll see their
input in plan critiques, execution checkpoints, and session reports.
If an expert flags something, you decide what to do about it — they
advise, you decide.

## How Your Project Grows

Claude Cabinet adapts as your project evolves.

### New technology? New expert.

When you add a database, a framework, or a new dependency, run `/seed`.
Claude scans your project, notices what changed, and proposes building
a new expert to cover it:

> "I see you added SQLite. Want to set up a data integrity expert
> that watches for common SQLite issues during reviews?"

You build the expert together in conversation — Claude asks what
matters for YOUR project, not generic best practices. The result is
an expert tailored to your actual risks.

### Something keeps going wrong? Make a rule.

If the same problem keeps showing up — Claude keeps forgetting a
convention, a certain kind of bug recurs — that's a pattern. During
debrief, Claude captures lessons. Over time, recurring lessons get
promoted to rules (in `.claude/rules/`) or hooks (automated checks).
The enforcement pipeline turns friction into structure.

### Outgrowing defaults?

Every skill has sensible defaults. As your project matures, you can
customize any phase by editing the phase files in `.claude/skills/`.
The three states:

- **File doesn't exist** → skill uses its default behavior
- **File contains `skip: true`** → that phase is disabled
- **File has content** → your content replaces the default

You don't need to understand this upfront. Defaults work. Customize
when you discover something that doesn't fit.

## Common Patterns

### "I just finished a big chunk of work"

```
/debrief
```

Close the loop. Mark things done. Record what you learned.

### "I'm starting a new feature"

```
/orient
/plan add user authentication
```

Get briefed, then plan before building.

### "Something isn't working and I don't know why"

```
/investigate why are login requests timing out?
```

Systematic exploration before guessing.

### "I haven't touched this project in a while"

```
/orient
```

Orient catches you up no matter how long it's been. The briefing
includes everything that happened in previous sessions.

### "I want to check the overall health"

```
/audit
```

Then `/triage-audit` to review findings and decide what to address.

### "I'm done for today"

```
/debrief
```

Even if you didn't finish what you planned. Debrief captures partial
progress too — the next session picks up where you left off.

## Tips

- **Don't skip debrief.** It's tempting to just close the window.
  Don't. A 30-second debrief saves 10 minutes of catching up next time.
- **Trust the plan.** `/plan` before `/execute` catches problems before
  they're expensive. The 2 minutes of planning save the 20 minutes of
  rework.
- **You don't need to use everything.** The core habit is just orient
  and debrief. Everything else is there when you need it.
- **Ask Claude.** If you're not sure what to do, just ask. Claude knows
  what skills are available and can suggest the right one.
- **It gets better over time.** The cabinet learns your project. Lessons
  accumulate. Experts get sharper. The first session is the worst it'll
  ever be.
