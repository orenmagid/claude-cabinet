---
type: field-feedback
source: claudeconsult-maginnis
date: 2026-05-28
component: verify (cabinet-verify runtime)
---

## Human verdict steps should default to no timeout

**Friction:** The "ask the human" step definition inherits Cucumber's
default step timeout (30s), which causes every human-verdict pause to
fail in any real interactive run. Had to patch it locally with
`timeout: -1` on the step definition in the consuming project.

**Suggestion:** cabinet-verify's baseline step handler for
`ask the human {string}` should register with `timeout: -1` by default.
This is a one-line fix in the runtime package — the consuming project
shouldn't need to know about it.

**Session context:** First /verify learn run on the Maginnis Howard
mass-arb platform. Every interactive scenario timed out at the first
human-verdict pause until we patched it.
