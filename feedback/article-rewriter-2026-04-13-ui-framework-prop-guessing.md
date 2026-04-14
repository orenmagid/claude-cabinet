---
type: feedback
date: 2026-04-13
skills:
  - execute
  - cabinet-mantine-quality
severity: moderate
---

# UI framework prop guessing wastes rounds

## What Happened

When building KnobDisplay with Mantine v9's Collapse component, we
guessed the boolean prop name three times: first `in` (Mantine v7
syntax), then `opened` (wrong guess), then finally `expanded` (correct
v9 API). Each guess required a build cycle to discover the error. Three
wasted rounds on something that could have been resolved in one.

## Root Cause

No rule enforces checking the actual type definitions before using an
unfamiliar component prop. The assistant relied on memory of older
Mantine versions and general intuition instead of reading the source of
truth.

## Suggested Fixes

1. **For execute skill:** Add a rule — when using a UI component prop
   you haven't verified in this session, read the `.d.ts` file in
   `node_modules` before writing the code. One `Read` call costs less
   than three failed builds.

2. **For cabinet-mantine-quality:** During review, flag any Mantine
   component usage where the prop names weren't verified against the
   installed version's type definitions. This catches version-mismatch
   bugs before they hit the build.

3. **General pattern:** This applies to any UI framework (MUI, Chakra,
   Radix) — when the project uses a version that may differ from
   training data, type definitions are the canonical reference.
