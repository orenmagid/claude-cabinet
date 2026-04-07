---
name: work-tracker
description: |
  Open the work tracking UI. Starts the local server and tells you to
  open it in the browser. Use to review projects, actions, and plan
  progress visually. Use when: "work tracker", "show work", "open tracker",
  "show projects", "show actions", "/work-tracker".
related:
  - type: file
    path: scripts/work-tracker-server.mjs
    role: "Local HTTP server for work tracker UI"
  - type: file
    path: scripts/work-tracker-ui.html
    role: "Browser-based work tracking interface"
  - type: file
    path: scripts/pib-db.js
    role: "Data layer — projects and actions in pib.db"
---

# /work-tracker — Work Tracking UI

## Purpose

Open the visual work tracker so the user can review projects, actions,
and progress in a browser rather than through conversation.

## Steps

1. **Check database exists:**
   ```bash
   ls pib.db
   ```
   If missing, initialize it:
   ```bash
   node scripts/pib-db.js init
   ```

2. **Start the server:**
   ```bash
   node scripts/work-tracker-server.mjs --port 3458
   ```
   Run this in the background. If port 3458 is taken, try 3459.

3. **Tell the user** to open `http://localhost:3458` in their browser.

4. **Stay available.** The user may come back with questions about what
   they see, or ask you to create/update projects and actions based on
   their review. Use `scripts/pib-db.js` for any mutations they request.

## Notes

- The server must keep running for the UI to work. If the user ends
  the conversation, the server stops.
- The UI shows projects filterable by status (active, paused, done,
  dropped, someday) and their actions.
- Actions can be created, completed, and edited directly in the browser.
