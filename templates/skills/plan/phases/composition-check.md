# Composition Check — Reusable Component Duplication

Check whether the planned work duplicates existing reusable components
in your project. The /plan skill reads this file after drafting and
before cabinet critique.

When this file is absent or empty, the default behavior is: skip this
phase entirely. To explicitly opt out, write only `skip: true`.

## What to Include

- **What counts as a reusable component** — skills, plugins, middleware,
  shared libraries, utilities, templates
- **How to search** — grep patterns, directory scans, registry queries
- **What to check** — duplication of logic, missing dependency declarations

## Example Composition Check

Uncomment and adapt these for your project:

<!--
### Search for Duplication
When the plan involves creating or modifying a reusable component
(skill, plugin, middleware, etc.):

1. Search existing components for overlapping keywords (API endpoints,
   data-fetching patterns, routing logic).
2. If overlap exists, the plan should compose with the existing component
   (invoke it) rather than duplicate its logic.
3. If the new component depends on others, declare the relationships
   in the plan (e.g., `related` entries, dependency notes).

### Skip When
- The plan doesn't involve reusable components
- The plan is a one-off task (bug fix, configuration change)
-->
