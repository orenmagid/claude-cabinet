---
type: field-feedback
source: claudeconsult-maginnis
date: 2026-05-28
component: verify (generate phase + scenario-template)
---

## Pin Cucumber version and fix step timeout API in generated code

**Friction:** The generate phase emits `@cucumber/cucumber: "^11.0.0"`
(unpinned) in package.json. The scenario-template.md documents a step
timeout API (`Then({pattern: '...', timeout: -1}, fn)`) that doesn't
match Cucumber v11's actual signature (`Then('...', {timeout: -1}, fn)`
— options as second arg, not wrapping object). First run failed with
`Invalid first argument: should be a string or regular expression`.
Two issues in one: (1) unpinned dep means the generated code can break
when Cucumber ships a new major, and (2) the template's API example is
wrong for the version it installs.

**Suggestion:** Pin `@cucumber/cucumber` to a tested version in the
generated package.json. Update scenario-template.md's step timeout
example to match that version's API. If cabinet-verify ships its own
baseline handlers, test them against the pinned version.

**Session context:** First /verify learn cold start on Maginnis Howard.
Hit the API mismatch on the very first interactive run attempt.
