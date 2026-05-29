---
type: field-feedback
source: claudeconsult-maginnis
date: 2026-05-29
component: site-audit-runtime (check modules)
---

## 4 installed check modules fail to run despite dependencies being present

**Friction:** After successful `npm install` (with 963 packages),
the following checks report "not available" or "error" despite their
npm packages being installed in node_modules:

1. **Linkinator** — `status: skip`, "not available". The `linkinator`
   package is installed but `detect()` apparently fails. Likely the
   `npx linkinator --version` spawn doesn't find the binary correctly.

2. **Pa11y** — `status: skip`, "not available". Same pattern — `pa11y`
   package is in node_modules but the detect spawn doesn't find it.

3. **Unlighthouse** — `status: skip`, "not available". Package installed
   but detection fails.

4. **axe-core** — `status: error`, "failed to parse axe-core JSON".
   This one gets past detect() (the binary runs) but its output isn't
   parseable. Likely `@axe-core/cli` output format doesn't match what
   the normalize function expects (version mismatch or different JSON
   structure).

**Root cause hypothesis:** The check modules use `npx <tool>` to
invoke tools, but the runtime is installed in a non-standard directory
(`~/.claude-cabinet/site-audit/0.1.0/`) where npx won't find the
local node_modules/.bin. The `cc-site-audit` binary likely needs to
set PATH or use the full path to `node_modules/.bin/<tool>` instead
of relying on npx resolution.

**Suggestion:** Either (a) resolve tool binaries relative to the
runtime's own `node_modules/.bin/` in `safeSpawn`, or (b) have the
CLI prepend its own `node_modules/.bin` to PATH before running checks,
or (c) use `require.resolve` to find the actual binary path.

**Session context:** First real-world run produced results from only
5/15 checks (Lighthouse, DNS, security-headers, SSL, meta-og,
structured-data, website-carbon). The other 8 were skip/error/phantom.
That's 47% coverage from tools that are installed and should work.
