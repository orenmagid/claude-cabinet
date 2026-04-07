# Auto-Maintenance — Recurring Session-Start Tasks

Define automated tasks that should run every session. These are operations
that would decay if left to human memory — the anti-entropy principle
applied to session management.

The distinction from health checks: health checks DETECT problems;
auto-maintenance DOES work. A health check reports "data is stale."
An auto-maintenance task runs the sync to fix it.

When this file is absent or empty, this step is skipped. (`skip: true`
is equivalent to absent here.)

## Omega Memory Hygiene

If omega is active (`~/.claude-cabinet/omega-venv/bin/omega` exists),
run these maintenance tasks every session:

### Consolidate (every session)

Prune zero-access memories older than 30 days and deduplicate. Silent,
non-destructive — only removes never-accessed entries and exact duplicates.

```bash
~/.claude-cabinet/omega-venv/bin/omega consolidate --prune-days 30 2>&1
```

Report only if something was actually pruned or merged (non-zero counts).

### Compact (weekly)

Cluster and summarize similar memories by type. Only run if 7+ days
since last compact. Check by looking for the most recent `compaction`
type memory via the adapter:

```bash
echo '{"type": "compaction", "limit": 1}' | \
  ~/.claude-cabinet/omega-venv/bin/python3 scripts/cabinet-memory-adapter.py list
```

If the most recent compaction memory is older than 7 days (or none exists):

```bash
~/.claude-cabinet/omega-venv/bin/omega compact -t lesson_learned 2>&1
~/.claude-cabinet/omega-venv/bin/omega compact -t decision 2>&1
~/.claude-cabinet/omega-venv/bin/omega compact -t error_pattern 2>&1
```

Report results only if clusters were found and compacted.

### Discover Connections (weekly)

Scan for unlinked memories that should be related and create graph edges.
Auto-relate runs after each store but only checks the 3 nearest memories.
discover_connections does a broader sweep, turning isolated memories into
a connected knowledge graph. Runs alongside compact (same weekly cadence).

```bash
~/.claude-cabinet/omega-venv/bin/python3 -c "
from omega.bridge import discover_connections
result = discover_connections(lookback_hours=168)  # 7 days
print(result if result else 'No new connections found')
"
```

Report: "Discovered N new connections between memories" if non-zero.

### Backup (weekly)

Back up the omega database. Runs alongside compact (same weekly cadence).
Omega keeps the last 5 backups automatically.

```bash
~/.claude-cabinet/omega-venv/bin/omega backup 2>&1
```

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
