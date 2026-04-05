# Interview — Conversational Questions Adapted to Mode

The heart of onboarding. This is a dialogue, not a form — ask questions,
listen to answers, follow up on what's interesting or unclear. The quality
of the context layer depends directly on the quality of this conversation.

When this file is absent or empty, the default behavior is: ask mode-
adapted questions as described below, one at a time, with follow-ups.
To explicitly skip the interview (e.g., when generating context from
existing documentation), write only `skip: true`.

## System Introduction (First Run Only)

Before asking about the project, check: does the user know what Claude
on Rails does? Ask once:

> "Have you used Claude on Rails before, or is this your first time?"

If **first time**, give a brief walkthrough before the interview:

> "Let me explain how this works, then we'll set it up for your project.
>
> Claude on Rails gives your Claude Code sessions a **session loop** —
> a start and end routine that creates continuity between sessions.
>
> - **`/orient`** runs at the start. It reads where things stand — what
>   you were working on, what's due, what broke. Instead of starting
>   blind, Claude starts informed.
> - **`/debrief`** runs at the end. It records what happened — what got
>   done, what's still open, what you learned. That's what orient reads
>   next time.
>
> Beyond the session loop, there are optional modules: **work tracking**
> (a local task database), **planning** (structured plans with critique
> before you build), **audit** (expert perspectives that review your
> codebase), and more. We'll get to those after we talk about your project.
>
> The whole system is customizable through small files called phase files.
> You don't need to touch them now — that's what this onboarding does."

Then proceed to the interview. Keep it conversational — if they ask
questions about the system, answer them before moving on.

If **experienced** (they've used it before, or say "I know how it works"),
skip the walkthrough entirely and go straight to the interview.

## User Context (Read Before Interviewing)

Before asking any questions, read two global files if they exist:

1. **`~/.claude/CLAUDE.md`** — the user's identity and preferences.
   If this has an "About Me" section, you already know who they are
   and what they do. Don't re-ask questions this answers. Acknowledge
   it: "I see you run a real estate fund — let's talk about how this
   project fits into that."

2. **`~/.claude/cor-registry.json`** — a list of all their CoR projects.
   If they have other projects, ask how this one relates to them: "You
   also have [project X] and [project Y]. Does this project connect to
   either of those?" The answer goes into `_context.md` so orient and
   debrief can reference sibling projects when relevant.

If neither file exists, that's fine — the installer may not have created
them (npm install path, or the user skipped the identity questions).
Proceed normally.

## Communication Calibration

Don't ask the user how technical they are. Listen to how they talk.
Within the first 2-3 answers, you'll know whether they reference
technical concepts naturally or describe things in terms of outcomes.
Match their register — mirror their vocabulary, explain at the level
they're engaging at. Don't talk down, don't talk over.

This isn't a variable to detect ("technical_level: 3"). It's a
conversational stance: meet people where they are. Someone who says
"I need a REST API with PostgreSQL" gets different follow-ups than
someone who says "I need a way to track client appointments." Both
are valid starting points.

## First-Run Questions

The detect-state phase identified this as a first run (no CoR context
layer exists). But "first run" covers two very different situations:

### Greenfield (no project yet, or near-empty directory)

The user just ran the CLI in an empty or near-empty directory. There's
nothing to scan, no workflow to reflect on yet. Questions must be
**forward-looking** — about intentions, not retrospection.

**Questions (ask one at a time, in order — skip or reorder based on
what the conversation reveals):**
1. What are you trying to build?
2. What will you be using Claude Code for on this project?
3. How do you usually keep track of what needs to be done?
4. Will anyone else be working on this with you?
5. Have you struggled with anything on past projects that you'd want
   to get ahead of this time?
6. How big is this? A weekend project, something you'll be working on
   for months?
7. What does done look like, roughly?

**Follow-up instincts:**
- If they describe something ambitious, ask what the first milestone is
- If they mention past frustrations, dig into what specifically went wrong
- If they're vague about the project, that's fine — they may be figuring
  it out. Ask what they know so far and what's still open
- If they mention collaborators, ask how they'll coordinate

### Existing Project (source files, config, or meaningful content present)

The user ran the CLI in a project that already has substance. There are
files to scan — use them for tech detection instead of asking. Focus the
conversation on **work and pain**, not tooling.

**Before asking:** Scan the project for tech signals (package.json,
Cargo.toml, requirements.txt, Dockerfile, .github/, etc.). Note what
you find — it informs your follow-ups but doesn't replace the
conversation. Don't announce what you found; weave it in naturally.

**Questions (ask one at a time, in order — skip or reorder based on
what the conversation reveals):**
1. Tell me about this project. What does it do?
2. What are you mainly working on right now?
3. What tends to break or get forgotten?
4. What do you wish Claude knew about this project from the very start
   of every session?
5. Is there anything that fails silently — things that go wrong without
   anyone noticing until it's too late?
6. How do you currently keep track of what needs to be done?
7. What does a typical working session on this project look like?
8. Is there a deploy pipeline or remote environment?

**Follow-up instincts:**
- If someone mentions a pain point, ask *why* it happens and how often
- If someone says "it's just me," ask how they keep context between sessions
- If someone mentions a team, ask about handoff friction
- If someone describes their workflow, listen for things that could be
  automated or checked

## Early Re-Run Questions

The session loop has been running. Shift from "what is this" to "what
have you learned."

**Questions (ask one at a time, in order — skip or reorder based on
what the conversation reveals):**
1. What has the session loop taught you that the context files don't
   currently capture?
2. Does orient give you what you need at session start? What's missing?
3. Does debrief close the right loops? What falls through?
4. Where have you hit friction with the current setup?
5. Are there things you keep having to tell Claude that should already be
   in the context?
6. Any phase files that aren't pulling their weight?
7. Has the project changed since the initial onboard?
8. Are you ready for any of the modules you skipped last time?
9. Anything you've been doing manually that should be automated?

## Mature Re-Run Questions

The system has been running long enough to accumulate both value and
cruft. This is a health check.

**Questions (ask one at a time, in order — skip or reorder based on
what the conversation reveals):**
1. Which modules are you actually using regularly?
2. Anything that felt useful at first but you've stopped relying on?
3. Are there modules you adopted but never really configured properly?
4. What gaps have you noticed? Things the system should catch but doesn't.
5. Has the project's architecture or priorities shifted since the last
   onboard run?
6. Any new pain points that weren't there before?
7. Is anything ready to retire?
8. Could any of your custom phase files be simplified now that you know
   what you actually need?
9. Are there patterns in your memory/feedback that suggest a structural
   change rather than another rule?

## Scope Boundary

You are configuring the **process layer** — what Claude should know about
this project, how sessions start and end, what to track and check. You
are NOT:

- Recommending tech stacks, frameworks, or architecture
- Advising on what to build or how to build it
- Making product decisions

If the user asks "what should I use?" or "what do you recommend?" for
their actual project, redirect: "That's a great question for your first
working session after we finish setup. Right now I'm just learning about
your project so the session loop knows what to look for. What do you
know so far about what you'll be building?"

Record what they tell you about their intentions and tools — that goes
into `_context.md`. But choosing those tools is their decision, not
onboard's job.

## Conversation Guidelines

- **One question at a time.** Ask a single question, wait for the answer,
  then ask the next one. Never stack multiple questions in one message.
  The rounds below are a *sequence*, not a batch — each bullet is its own
  turn. Follow-ups based on the answer take priority over the next
  planned question.
- **Follow up on substance.** If an answer reveals something important,
  dig into it before moving on to the next topic.
- **Note CoR module signals.** When someone describes a pain point that
  maps to a specific module, note it internally for the modularity menu
  phase — but don't interrupt the conversation to pitch the module.
- **Don't assume answers.** Even if you can see the project's files, ask
  about things like pain points and priorities that only the user knows.
- **Earn the right to ask about specifics.** Don't ask about tech stack,
  deployment pipelines, or architecture until the conversation has shown
  the user has context to give a meaningful answer. Lead with open
  questions ("tell me about this project") and let specifics emerge
  naturally. If the user is non-technical or early in their thinking,
  those questions may never be appropriate — and that's fine.
- **Summarize before generating.** After the interview, reflect back what
  you heard: "Here's what I'm taking away from this conversation..." Let
  the user correct before generating files.
- **For skipped modules (.corrc.json):** If the CLI's `skipped` field
  shows a module was opted out with a reason, weave that into the
  conversation naturally. "I see you're tracking work somewhere else —
  tell me about that" rather than "Module work-tracking was skipped."
