# /execute cabinet-default selection over-includes; projects want trim-to-signal

**Source:** .claude/skills/execute/SKILL.md step 2 cabinet-selection default
**Impact:** The skill's default cabinet-selection by "match standingMandate + file patterns + topic keywords" + "err toward inclusion" returns a long list. In this session the default produced ~7 matching members (anti-confirmation, boundary-man, debugger, historian, qa, security, architecture) for a typical backend+frontend refactor. The user explicitly trimmed with "not the ENTIRE cabinet, lol." Only 3 (debugger, boundary-man, security) carried real signal for this work.

**Observation:** "Err toward inclusion" is correct in principle — missing a concern costs more than running a redundant review — but the default produces a number that feels like noise to the user. The spawn-in-parallel step burns 3-5 min and a lot of context even when most members return "looks fine." The user's instinct in a mature project is to trim to top-3 by match strength.

**Possible fixes upstream (not implemented):**
1. Default to top-N (e.g., 3) with a note "spawn more if surface area is unusually broad"
2. Add a pre-spawn "here's who matched; trim?" gate — simple y/n list
3. Rate-weight members by historical signal-per-matched-session: members who've been low-signal on similar file patterns get lower priority

**Workaround used:** Explicit trim-before-spawn ("let me pick 3: debugger, boundary-man, security") rendered in final response before calling Agent tool.

**Session context:** Executing a plan with ~15 files changed across backend+frontend, clear file-group boundaries. Not unusual scope.
