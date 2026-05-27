# Auto-Maintenance — Recurring Session-Start Tasks

Define automated tasks that should run every session. These are operations
that would decay if left to human memory — the anti-entropy principle
applied to session management.

The distinction from health checks: health checks DETECT problems;
auto-maintenance DOES work. A health check reports "data is stale."
An auto-maintenance task runs the sync to fix it.

When this file is absent or empty, this step is skipped. (`skip: true`
is equivalent to absent here.)

## Built-In Memory Hygiene

CC's built-in memory (per-file curated entries under
`~/.claude/projects/<slug>/memory/`) is file-based and does not require
periodic consolidation, compaction, or backup. Each memory file is its
own durable artifact; the filesystem handles persistence.

What *is* worth checking each session:

### Validate memory structure (every session)

```bash
node scripts/validate-memory.mjs --quiet 2>&1 || true
```

Catches orphan files (memory file written without index entry), broken
references (index points to a missing file), and exceeded caps
(MEMORY.md >200 lines / >25KB, topic files >50KB).

Report only violations — silent on pass. The `|| true` ensures orient
doesn't abort if the validator exits non-zero; orient surfaces issues
under "Attention Items" instead.

<!--
## Project-Specific Maintenance

Add your own recurring tasks below. For each task, provide:
- **What** — the operation to perform
- **Why every session** — what decays if this is skipped
- **Command** — how to run it
- **Auto-execute?** — yes (run silently) or surface (ask user first)

### Example: Process Pending Queue Items
```bash
curl -s https://your-api.example.com/api/queue/pending
```
Items queued from a UI or external integration since last session.
Auto-execute routine items; surface unusual ones for confirmation.
-->
