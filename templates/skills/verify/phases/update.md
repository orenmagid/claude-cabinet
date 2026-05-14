# /verify update — Sync scenarios to a code change

Default behavior: take a change description, find affected feature files,
propose edits, write them on user approval.

## Three input shapes

The `<change>` argument can be one of three shapes. Dispatch by shape:

### Shape 1: pib-db action fid (`act:abc12345`)

1. Run `node scripts/pib-db.mjs query "SELECT * FROM actions WHERE fid='<fid>'"`
   (or the `pib_get_action` MCP tool if available).
2. Read the action's notes. Look for:
   - Component names (e.g., "FirstLoginBanner", "ArticleInputPanel")
   - Route paths (`/app`, `/admin/users`)
   - File paths in the surface area
   - Plain-English description of what changed
3. Search `e2e/features/*.feature` for steps mentioning these tokens.
4. Propose edits per the **Propose** section below.

### Shape 2: Diff snippet (multi-line input starting with `diff --git` or `---`)

1. Parse the diff for modified files and changed lines.
2. Identify components/routes by mapping file paths:
   - `webapp/frontend/src/pages/<Route>.tsx` → route hint
   - `webapp/frontend/src/components/<Component>.tsx` → component hint
   - Adapt mapping per project conventions
3. Search features for matching step text.
4. Propose edits.

### Shape 3: Free text (any other argument)

1. Treat the argument as a description of what changed.
2. Extract noun phrases that could be component/route names.
3. Search features for matching step text via fuzzy match (case-
   insensitive, substring).
4. Propose edits.

## Propose

Print proposed edits in this shape, one block per feature file:

```
features/01-desktop-rewrite.feature:
  ADD step after line 12:
    And check "1.04b first-login-banner" the FirstLoginBanner is dismissed

  MODIFY step at line 24:
    From: Then check "1.10 settings-bar-appears" the SettingsBar appears
    To:   Then check "1.10 settings-bar-appears" the SettingsBar appears
          And check "1.10b model-picker-absent" no model picker is visible
```

For each block, ask: "Apply this edit? (y/n/edit)". On `edit`, drop
into a sub-flow where the user supplies a custom edit text.

## Escalate to `learn` mode if no scenario fits

If the change description mentions a route or component that doesn't
appear in ANY existing feature file:

> "The change references [X] which doesn't appear in any feature file.
> This may be a new scenario, not an edit to an existing one. Run
> `/verify learn` to draft a scenario for [X], or describe the edit
> manually?"

Don't try to invent a new scenario inline — the `learn` flow's
calibrate phase is the right tool for that.

## Output

After approval, write the edits to the .feature files. Print a summary:

> "Updated 1 feature file:
> - features/01-desktop-rewrite.feature: +2 steps
>
> Run `npm run verify:scenario -- features/01-desktop-rewrite.feature`
> to verdict the new steps."

Don't auto-run the verification — let the user decide when to verdict.
