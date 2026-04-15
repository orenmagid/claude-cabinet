# debrief Extending and Calibration

## Extending

To customize a phase: write content in the corresponding `phases/` file.
To skip a phase: leave the file empty or don't create it.
To add a phase the skeleton doesn't define: create a new file in
`phases/` with a description of when it runs relative to the core
phases. Claude reads whatever phase files exist at runtime.

Examples of phases mature projects add:
- Project completion scanning (auto-close projects with zero open items)
- Prep/research passes on open work items
- Evening preview (tomorrow's calendar, due items, prep needed)
- Compliance checks (verify required skills were invoked)
- Machine/environment drift detection

## Calibration

**Core failure this targets:** Ending a session without closing loops,
leaving completed work marked as open, unrecorded lessons, and stale
state that degrades the next session's orient.

### Without Skill (Bad)

Session ends. Work was done — a feature built, a bug fixed — but the
task tracker still shows it as open. Feedback that was addressed stays
unresolved. A lesson learned about a tricky API behavior isn't written
down. Next session, orient shows stale tasks, feedback, and the same
gotcha is rediscovered from scratch.

The system is doing work but not learning from it. Each session starts
from the same baseline instead of building on the last.

### With Skill (Good)

Session ends. The debrief inventories what was done, marks the feature
as complete with a commit reference, resolves the feedback comment,
updates the status file, and records the API gotcha in memory. Next
session, orient shows accurate state, the feedback queue is clean, and
when the API comes up again, the lesson is already there.

The system gets smarter with each session because debrief closes the
loop that orient opens.
