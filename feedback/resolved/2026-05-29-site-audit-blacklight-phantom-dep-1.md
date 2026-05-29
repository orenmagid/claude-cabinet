---
type: field-feedback
source: claudeconsult-maginnis
date: 2026-05-29
component: site-audit-runtime (package.json)
---

## Blacklight dependency doesn't exist on npm

**Friction:** `@themarkup/blacklight-collector@^1.0.0` is listed as a
hard dependency in the site-audit-runtime package.json. This package
does not exist on npm — The Markup's Blacklight is a web-based tool,
not a published npm module. `npm install` fails entirely with ETARGET,
blocking installation of the entire runtime including all *working*
checks.

**Workaround applied:** Moved Blacklight to `optionalDependencies` and
installed from the extracted tarball. The Blacklight check correctly
shows `status: skip` at runtime either way, so the runtime already
handles the missing-tool case gracefully — the dependency declaration
is the only problem.

**Suggestion:** Either (a) remove `@themarkup/blacklight-collector`
from dependencies entirely and have the check module detect it via a
different mechanism (e.g., check for a local binary or a vendored
script), or (b) move it to `optionalDependencies` so `npm install`
succeeds even when it's unavailable. Option (a) is cleaner since the
package genuinely doesn't exist.

**Session context:** First real-world `/cc-site-audit compare` run.
Installation was dead on arrival until this was manually patched.
