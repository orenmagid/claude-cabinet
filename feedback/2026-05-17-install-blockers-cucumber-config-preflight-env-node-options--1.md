# Install blockers: cucumber config, preflight env, NODE_OPTIONS on Node 22

Source: flow
Component: verify (install.sh + generated package.json)
Date: 2026-05-17

## Friction

A fresh `/verify learn` bootstrap on Node 22 cannot run a single step out of the box. Three install-day blockers stack:

1. **`cucumber.js` config's `import` key is silently ignored.** install.sh generates:
   ```js
   import: ['steps/**/*.ts', 'support/**/*.ts'],
   ```
   cucumber-js v11 (the version cabinet-verify 0.1.0 resolves) does not honor this key when feature paths come from positional CLI args, and arguably not even otherwise. Every step shows `Undefined` until you add explicit `--import` flags to each npm script.

2. **`cabinet-verify-preflight` does not load `.env.local`.** The generated `"preflight": "cabinet-verify-preflight"` script fails immediately with `cabinet-verify-preflight: no URL specified. Pass --url <url> or set CABINET_VERIFY_DEV_URL.` because nothing loads `.env.local` first.

3. **`NODE_OPTIONS='--env-file=.env.local'` is rejected.** A natural fix to (2) is to add `--env-file` to `NODE_OPTIONS`, but Node 22+ refuses: `node: --env-file= is not allowed in NODE_OPTIONS`.

## What works

Replacing the generated scripts with this pattern works on Node 22 and is what every consuming project will end up doing:

```json
"preflight": "node --env-file=.env.local node_modules/cabinet-verify/dist/src/cli/preflight.js",
"verify": "npm run preflight && node --env-file=.env.local --import tsx/esm node_modules/@cucumber/cucumber/bin/cucumber.js --import 'steps/**/*.ts' --import 'support/**/*.ts' --tags '@free and not @manual'",
"verify:scenario": "npm run preflight && node --env-file=.env.local --import tsx/esm node_modules/@cucumber/cucumber/bin/cucumber.js --import 'steps/**/*.ts' --import 'support/**/*.ts'"
```

## Suggestion

Update `.claude/skills/verify/install.sh`'s `PACKAGE_JSON` heredoc to ship the working pattern by default. Probably also drop the `cucumber.js` import key (or document that it doesn't do what it looks like) since CLI `--import` flags are now load-bearing.

## Session context

Flow project, ran `/verify learn` cold-start. Fresh `npm install && npm run install:browsers && npm run verify` produced 31 Undefined steps before any of the above was discovered. Took ~30 min to chase down all three issues. Every new consumer will hit at least (1) and (2).
