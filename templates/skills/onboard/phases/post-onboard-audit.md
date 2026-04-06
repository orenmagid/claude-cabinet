# Post-Onboard Audit — Configuration Sanity Check

After generating all files and presenting the summary, run a lightweight
audit from the cc-health cabinet member to catch configuration issues before
the user starts their first session.

When this file is absent or empty, the default behavior is: run the audit
as described below. To explicitly skip it, write only `skip: true`.

## Why This Exists

Onboard generates a lot of files from conversation. The interview is
freeform — the user might mention a database but the data-sync phase
doesn't get wired. They might skip a module but a phase file references
it. They might describe a deployment pipeline but no health check covers
it. These gaps are invisible until orient runs and something is wrong.

A quick audit immediately after generation catches these before the user
starts relying on the configuration.

## What to Check

Run as the **cc-health cabinet member** but scoped to what onboard just
generated. This is NOT a full audit — it's a focused sanity check on
the fresh configuration.

### 1. Interview–Configuration Coherence

Compare what the interview revealed against what was generated:

- **Technologies mentioned** → Are they reflected in `_briefing.md` scan
  scopes and relevant phase files?
- **Pain points described** → Did at least one phase file or health check
  address each significant pain point?
- **Data sources mentioned** → Is `data-sync.md` wired if the project has
  remote data? Is it absent if the project is purely local?
- **Collaboration details** → If multiple people work on the project, are
  coordination-relevant checks present?

### 2. Module–Phase Alignment

Cross-reference `.corrc.json` (installed vs skipped modules) against the
generated phase files:

- **Skipped modules:** No phase file should reference a skipped module's
  infrastructure. If work-tracking was skipped, no phase should reference
  `pib.db` or `pib-db.js`. If audit was skipped, no phase should reference
  `committees.yaml` or cabinet member activation.
- **Installed modules:** Each installed module should have at least a
  minimal presence in the generated configuration. A module that's installed
  but has zero phase file references is a configuration gap.

### 3. Structural Basics

Quick filesystem checks:

- Every generated file is valid markdown (no truncated content, no
  template placeholders left unfilled)
- Phase files that reference other files point at files that exist
- `_briefing.md` has non-empty project description, stack, and scan scopes
- `system-status.md` exists and has initial content
- Hook scripts in `.claude/hooks/` are executable (if hooks module adopted)

### 4. Technology-Implied Cabinet Members

Check whether the project's technology signals suggest cabinet members that
aren't activated. Cross-reference the interview answers and detected
technologies against the cabinet member catalog:

- **UI framework detected** → usability, accessibility, small-screen
- **Database detected** → data-integrity
- **API server detected** → security, speed-freak
- **Complex architecture (3+ layers/services)** → architecture
- **Long-running project** → historian
- **Many skills (5+)** → roster-check
- **Features shipping regularly** → system-advocate

If implied cabinet members aren't in `committees.yaml` (or equivalent), note
it as a recommendation — not a blocker. The user may have good reasons
to skip them, or may want to add them later via `/seed`.

### 5. First-Session Readiness

Simulate what `/orient` will do on its first run:

- Walk through orient's phases mentally. For each phase that will run,
  verify the files it reads exist and have content.
- If orient would hit an empty phase that should have content (given what
  the interview revealed), flag it.
- If debrief would try to update a file that doesn't exist yet, flag it.

## How to Present

**If everything checks out:** One line after the summary:

> "Configuration looks clean — orient should work on first run."

**If issues are found:** Present them briefly, grouped by severity:

> "Before you run /orient, I noticed a few things:
>
> - data-sync.md references your PostgreSQL database, but no connection
>   details are in the phase file. Orient will try to sync and fail.
> - The security cabinet member is activated but _briefing.md doesn't include
>   API routes in its scan scopes — it won't find anything to review.
>
> Want me to fix these now?"

Fix issues immediately if the user says yes. This is not a deferred
finding — it's a pre-flight check.

## What This Is NOT

- **Not a full cc-health audit.** That runs periodically via /audit and
  covers telemetry, usage patterns, drift over time. This only checks
  what was just generated.
- **Not a product quality review.** Whether the _briefing.md is well-written
  or the health checks are comprehensive — that improves through use.
  This just checks that the configuration is structurally sound.
- **Not blocking.** If the audit finds issues and the user wants to move
  on, let them. The issues will surface again naturally when orient runs.
