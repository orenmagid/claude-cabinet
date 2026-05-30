---
name: handoff-add
description: |
  Add items to an existing handoff checklist mid-engagement. Preserves
  existing client progress. Use when: "handoff add", "/handoff-add",
  "add items to the checklist", "I need something else from the client".
manual: true
---

# /handoff-add — Add Items to an Existing Checklist

## Purpose

Amend a handoff checklist after the client has already started working
on it. New items appear as "not started" without affecting existing
progress.

## Workflow

1. Read existing `handoff.yaml`. If missing: "No checklist found. Run
   `/handoff-create` to build one first."

2. Show current structure: sections and item counts.

3. Ask: "What do you need to add?"
   - "Which section does this belong in?" (existing or new section)
   - Same item-creation flow as `/handoff-create`: kind, prompt, help,
     options, visibility rules.
   - "Any more items to add?"

4. Re-validate the updated checklist:
   - Cycle detection (new visibility rules may create cycles)
   - Orphan dependency check

5. Write updated `handoff.yaml`.

6. Send a `checklist_update` notification to the client via transport:
   - **Email subject:** `[Handoff] N new items added`
   - **Email body:** Structured JSON with the new items and their
     sections, so the client's `/handoff` or `/handoff-progress` can
     surface them.

7. Confirm: "Added N items. [Client name] will see them next time they
   run `/handoff` or `/handoff-progress`."
