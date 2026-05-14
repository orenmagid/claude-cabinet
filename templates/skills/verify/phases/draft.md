# /verify learn — Draft phase

Default behavior: group the DiscoveryReport from `phases/discover.md`
into scenarios. **MUST invoke cabinet-qa via subagent** for the
"what's worth a scenario" judgment.

## Why cabinet-qa, not heuristics

The temptation is to write a heuristic: "one scenario per persona, one
scenario per major route, one scenario per modal interaction". That
heuristic produces 30 scenarios from a medium-sized app. None of them
are bad; collectively, they're paralysis-inducing.

`/verify` owns the runnable harness and the journey-level abstraction.
`cabinet-qa` owns the testability judgment — including "what's worth a
scenario". The draft phase delegates that judgment by spawning a
cabinet-qa subagent with the DiscoveryReport.

If cabinet-qa is not installed in the project, fall back to the
heuristic and warn the user (the draft will likely need heavier
calibration).

**Detection:** check `.claude/skills/cabinet-qa/SKILL.md` exists
before dispatching. If absent, warn:

> cabinet-qa not installed — falling back to heuristic draft.
> Consider `/seed` to add it; the heuristic over-proposes, so plan
> to trim aggressively during calibrate.

## cabinet-qa subagent dispatch

Spawn a single cabinet-qa subagent with:

- Full SKILL.md of cabinet-qa
- Project briefing from `cabinet/_briefing.md`
- The DiscoveryReport (routes, components, memory hits, persona signals)
- This focused task:

> Given the DiscoveryReport, propose a scenario set for walkthrough
> verification. Each scenario is a single user-journey walkthrough
> (start → finish) — NOT a per-component check list. Group the
> discovered surfaces by what a real user would do in one sitting.
>
> Constraints:
> - **≤5 scenarios** in the initial draft. Force the user to ask for
>   more rather than ask them to delete.
> - Each scenario must be journey-shaped (sign-in → action → outcome),
>   not component-shaped ("verify the navbar renders").
> - Each scenario gets a persona tag (`@as-user` / `@as-admin` /
>   `@as-fresh`) and a cost tag (`@free` / `@api-small` / `@api-large`).
> - Skip surfaces that don't fit. The skill will surface "what was
>   left over" to the user during calibrate.
>
> Return:
> - `scenarios`: Array of `{name, persona, costTag, journey, surfaces}`
>   where `journey` is a 3–8 step plain-English flow and `surfaces` is
>   the list of DiscoveryReport routes/components this scenario exercises.
> - `leftover`: Array of `{surface, reason}` for items not assigned
>   to any scenario.

cabinet-qa returns the scenario set. The draft phase persists it to a
scratch file for the calibrate phase to read.

## Why the ≤5 cap

`/seed` over-proposes new cabinet members. Users end up triaging 12
proposals when they wanted 3. The same failure mode applies here —
nothing forces a stop, so the model keeps adding scenarios "for
coverage". Hard cap. If discovery surfaced 30 surfaces, cabinet-qa
should fold most of them into the 5 scenarios as steps, not propose
6+ scenarios.

The user can always say "add a 6th scenario for X" during calibrate.
The reverse — "we don't need this scenario, drop it" — is more
expensive (the user has to identify which to cut).

## Output shape

```ts
interface DraftReport {
  scenarios: Array<{
    name: string;
    persona: '@as-user' | '@as-admin' | '@as-fresh' | string;
    costTag: '@free' | '@api-small' | '@api-large' | string;
    journey: string[]; // 3-8 plain-English steps
    surfaces: string[]; // refs to DiscoveryReport entries
  }>;
  leftover: Array<{ surface: string; reason: string }>;
}
```

Written to scratch file. Calibrate reads it.
