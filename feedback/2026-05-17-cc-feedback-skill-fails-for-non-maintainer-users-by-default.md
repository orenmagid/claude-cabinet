# /cc-feedback skill fails for non-maintainer users by default

**Surfaced:** 2026-05-17 during cabinet-verify extraction debrief
**Severity:** medium — feedback from external users silently dies on
their machines; the maintainer never sees it
**Classification:** prevent (skill-design fix)

## What goes wrong

The /cc-feedback skill in `templates/skills/cc-feedback/SKILL.md`
delivers feedback differently based on context:

1. **CC source repo** → writes to local `feedback/` directly (correct)
2. **Consuming project** → writes to `~/.claude/cc-feedback-outbox.json`
   (local-only) AND optionally offers a GitHub issue if `gh` is
   installed

The outbox path makes sense for the maintainer because their own
sessions in the CC source repo can pick up the outbox into the
repo's `feedback/`. For external users (friends, downstream
consumers), the outbox sits on their machine forever — no session
on their side ever propagates it to the upstream repo.

The GH issue is **optional** ("Also send as a GitHub issue for faster
visibility?"). If the friend says no, or doesn't have `gh` installed
(no prompt appears at all), the feedback is lost.

## How it surfaced

User reported that their friend (Flow-only consumer) had used
`/cc-feedback` and the maintainer never received it. Investigation
showed the skill behaved as designed — the design itself is wrong
for the non-maintainer case.

## Suggestion

Invert the default for consuming projects:

- **CC source repo:** local `feedback/` write (unchanged)
- **Consuming project + gh available:** **file GitHub issue as
  primary path (default: yes, not asked)**; write outbox as backup
- **Consuming project + no gh:** print clear instructions ("Install
  `gh` and re-run, OR paste this draft into
  github.com/orenmagid/claude-cabinet/issues") — don't just save
  to outbox silently

Treats the outbox as a maintainer convenience, not the primary
delivery mechanism for everyone else.

## Workaround for now

Tell external users to install `gh` and say yes to the GH issue
prompt when it appears. Drafted a message for the user to send to
their friend in the 2026-05-17 session; reproduced in the action
notes if filed.

## Why this matters

The whole point of /cc-feedback is that field friction reaches
upstream quickly. The current default fails the people who most
need it — early adopters trying CC for the first time who don't
know the maintainer's expected workflow.
