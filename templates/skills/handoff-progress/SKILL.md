---
name: handoff-progress
description: |
  Check handoff progress without re-entering the full checklist flow.
  Shows what's completed, what's pending, and any messages from the
  consultant. Use when: "handoff progress", "/handoff-progress",
  "how much is left", "any messages from the consultant".
---

# /handoff-progress — Check Your Progress

## Purpose

Lightweight status check for the client. Shows progress and incoming
messages without starting the full checklist walk.

## Workflow

1. Locate `handoff.yaml` — check in order: path from args, then
   project root (`./handoff.yaml`). Read `handoff-state.json` from
   the same directory as the checklist (state file is co-located).
   - If no state file: "You haven't started this checklist yet. Run
     `/handoff` to begin."
   - If no checklist: "No handoff.yaml found — has the plugin been
     installed?"

2. Check the connected email MCP for incoming `[Handoff]` emails from
   the consultant. Process and display any new messages (notes, checklist
   updates, questions).
   - If no email MCP connected, skip silently.

3. Show progress table:

   ```
   ## Maginnis Go-Live (7/12 complete)

   ### Hosting Setup (3/3)
   [x] hosting_provider: Railway
   [x] railway_token: sent
   [x] railway_project_id: provided

   ### Email Service (1/2)
   [x] email_provider: Postmark
   [ ] postmark_token: not started

   ### Domain & DNS (3/7)
   ...
   ```

4. If new items were added by the consultant via `/handoff-add`,
   highlight them: "[Consultant] added N new items since your last
   session."

5. Offer: "Ready to continue? Run `/handoff` to pick up where you
   left off."
