# Mantine cabinet member silent during planning/execution

**Source:** article-rewriter (de[sic]ify) project, 2026-04-22 pre-beta audit.

## Observation

While triaging audit finding `mantine-quality-0005` (99% of `@mantine/hooks` is unused — debouncing, localStorage syncing, clipboard, mediaQuery all hand-rolled while `useDisclosure` is the only hook imported), the user observed:

> "I think this shows us the mantine cabinet member isn't being invoked during planning and execution. We should probably file /cc-feedback about this."

The cabinet-mantine-quality member is installed and active (it participated in the audit and produced valuable findings). But during the many prior planning + execution sessions that built features involving Mantine, nothing caused the mantine-quality lens to fire. The result: 7 hand-rolled forms instead of @mantine/form; 10+ hand-rolled localStorage syncs instead of useLocalStorage; 27 inlined `fontFamily: 'Georgia, serif'` instead of a theme override; `window.confirm()` for destructive actions instead of Mantine modals.

The audit found these — but only because mantine-quality runs standing-mandate during /audit. Between audits, the lens is silent.

## What the friction is

The cabinet lifecycle treats the audit phase as the main activation surface for framework-specific members. But framework quality is a LIVE concern at plan+execute time — every planning session that touches a React component should be asking "does Mantine already do this?" The way the directives are currently scoped, that question is only asked during audits, which happen too rarely to prevent 20 instances of hand-rolling before someone notices.

## Possible shapes for a fix (not prescribing)

1. Framework-specific cabinet members (mantine-quality, framework-quality, and future variants for other frameworks) ship with `standing-mandate: [plan, execute]` — not just `audit`. Their directive during plan: "Check whether the proposed approach already exists in the framework's primitives." Their directive during execute: "Flag hand-rolled patterns where a framework hook/component would fit."

2. Cross-portfolio activation based on file-path heuristics — when /plan or /execute touches a .tsx/.jsx file in a Mantine-using project, mantine-quality fires. (Similar idea to the domain-memories PreToolUse hook mentioned in orient's context.md.)

3. A separate "/framework-check" skill that runs opportunistically when planning UI work.

## Why this matters beyond this project

Any CC project adopting a UI framework (Mantine, Chakra, Material, Shadcn, Radix, etc.) will hit this same pattern. The framework-quality cabinet member is one of the most generalizable upstream assets, and its effectiveness is limited by when it activates. The fix isn't just for Mantine — it's for the whole family of framework-quality members.

## Concrete cost observed

In the 2026-04-22 audit, mantine-quality surfaced 8 findings worth fixing (~3-4 hours of consolidation work). If mantine-quality had been firing during plan/execute, most of these would have been caught at write-time (~0 extra work per instance). The audit → triage → plan → execute → re-audit loop for already-written patterns is the expensive path; framework-quality-at-write-time is the cheap path.
