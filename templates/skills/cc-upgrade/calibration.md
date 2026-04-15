# cc-upgrade Calibration

**Core failure this targets:** Process improvements published upstream
never reach adopted projects, or reach them but nobody understands
what changed.

## Without Skill (Bad)

New CC version is out. The user re-runs the installer. Files update
silently. The user has no idea what changed — was it just bug fixes?
New features? Did a skill they rely on change its workflow? They also
don't realize the new debrief skill references a `§ Friction Captures`
section in _briefing.md that their project doesn't have, so the upstream
feedback phase silently does nothing. Three weeks later they wonder
why no friction is being captured.

## With Skill (Good)

New CC version is out. The user runs `/cc-upgrade`. The installer
updates all upstream files mechanically — fast, deterministic, safe
(phase files untouched). Then Claude explains: "You went from v0.4.1
to v0.5.0. The big change: debrief now has an upstream feedback phase
that captures CC friction. It references `_briefing.md § Friction
Captures` — let's add that section to your briefing file." "The plan
skill's critique step now uses three cabinet members instead of one. Your
existing phase files are fine — this is a default behavior change."
"There's a new `investigate` skill for deep-dive debugging. Want to
try it?" Everything is explained. Non-manifest concerns are handled.
The project gets better without confusion.
