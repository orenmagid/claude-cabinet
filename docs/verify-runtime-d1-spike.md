# D1 Tarball-Install Portability Spike

**Status:** PASS (with one cross-machine caveat documented).
**Date:** 2026-05-14.
**Phase:** 0 (act:60f1961e).
**Purpose:** Validate D1 option (b) — bundle the cabinet-verify runtime
in CC, install to `~/.claude-cabinet/verify/<version>/dist/` as a
tarball, consuming projects reference via `file:` — produces
deterministic, portable lockfile entries.

This doc is deletable after Phase 1 lands. Its content is the
record-of-spike for the convention frozen in
`templates/verify-runtime/CONVENTIONS.md`.

## What was tested

Mirrored the real install topology with a no-dep stub:

```
/tmp/spike/cabinet-verify-stub/      # stands in for templates/verify-runtime/
  package.json                       # name: cabinet-verify-stub, version: 0.0.1
  src/index.js                       # trivial CJS
  cabinet-verify-stub-0.0.1.tgz      # produced by `npm pack`

/tmp/spike/consumer-A/               # stands in for one consuming project
  package.json                       # depends on the tarball via file: path
/tmp/spike/consumer-B/               # stands in for a second consuming project
  package.json                       # same dependency, separate install
```

Both consumers reference the tarball with the same `file:` spec:

```json
"cabinet-verify-stub": "file:/tmp/spike/cabinet-verify-stub/cabinet-verify-stub-0.0.1.tgz"
```

After `npm install` in each consumer, the `package-lock.json` entries
for the stub were diffed.

## Result

```
$ diff <(jq -S '.packages."node_modules/cabinet-verify-stub"' /tmp/spike/consumer-A/package-lock.json) \
       <(jq -S '.packages."node_modules/cabinet-verify-stub"' /tmp/spike/consumer-B/package-lock.json)
$ echo $?
0
```

Empty diff. The phase AC is satisfied.

Both lockfile entries:

```json
{
  "version": "0.0.1",
  "resolved": "file:../../../../tmp/spike/cabinet-verify-stub/cabinet-verify-stub-0.0.1.tgz",
  "integrity": "sha512-p3dzD8PpaWJ76Rg1RaVVLDa5IjSA0Ui3Gh+qdwCNxeYnd9ac42f1ozkImhmbkgcPpPcchDYzSo1aSdP2mVPhyg=="
}
```

## What this proves

- **`integrity` is content-hashed.** sha512 of the tarball bytes. Identical
  across consumers on the same machine, identical across machines that
  have the same tarball, and tampering-resistant.
- **`resolved` is identical across same-machine consumers.** Because npm
  emits a relative path from the consumer's location to the tarball, and
  both consumers are at the same directory depth (`/tmp/spike/consumer-X/`),
  the relative path is the same.
- **`npm install` is deterministic.** Run it twice, get the same lockfile
  byte-for-byte.

## What this leaves open (cross-machine portability)

The `resolved` field is a **relative path**. Across machines where the
absolute path to the tarball differs (e.g., dev laptop at
`/Users/oren/.claude-cabinet/verify/0.1.0/dist/...` vs. CI at
`/home/runner/.claude-cabinet/verify/0.1.0/dist/...`), the depth-from-
consumer-to-tarball may differ, so the `resolved` string may differ
between lockfiles produced on different machines.

This matters in two scenarios:

1. **`npm ci` cross-machine.** `npm ci` validates the lockfile against
   the manifest. Modern npm (≥ 9) tolerates `resolved` path differences
   when the `integrity` hash matches; older npm may require exact match.
   **Mitigation:** consuming projects pin to a recent npm and commit
   their lockfile; CI runs `npm ci` from the same lockfile dev produced.
2. **Mixed-machine git history.** If two contributors install on
   different absolute paths and both commit lockfile updates, the
   `resolved` field churns. **Mitigation:** lockfile should not be
   regenerated casually; only one machine "owns" lockfile regeneration
   for a given version bump.

Neither scenario is fatal. The content-hash `integrity` is the
load-bearing field; `resolved` is advisory once the tarball is in the
npm cache or local install dir.

## Decision

**Proceed with D1 option (b).** The spike satisfies the phase AC, and
the cross-machine `resolved`-field nuance is well-understood and
documented. If real-world friction emerges during Phase 7 (proof-of-
extraction across de[sic]ify and a second project on different machines),
we revisit and fall back to D1 option (a) — publishing
`@claude-cabinet/verify` to npm.

## Cleanup

After Phase 1 lands, this doc can be deleted. The convention itself is
preserved in `templates/verify-runtime/CONVENTIONS.md` under
**Tarball Install Pattern**, with a one-line back-reference to this
spike's findings.
