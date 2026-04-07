---
name: memory
description: |
  Browse, search, and manage semantic memory. Shows what omega remembers —
  decisions, lessons, preferences, constraints. Supports browse, search,
  remember, and forget. Use when: "what's in memory", "memory", "/memory",
  "what do you remember", "show memories", "search memory", "forget",
  "delete memory", "remember this".
user-invocable: true
---

# /memory — Semantic Memory

## Purpose

Give the user visibility into what omega remembers. Browse, search, store,
and delete memories.

## Prerequisites

Check that omega is available:
- `~/.claude-cabinet/omega-venv/bin/python3` exists
- `scripts/cabinet-memory-adapter.py` exists

If not available, tell the user:
> Memory module is not set up. Run `npx create-claude-cabinet` to install it.

## Adapter Reference

The adapter (`scripts/cabinet-memory-adapter.py`) provides project-scoped
queries and a stable JSON interface. Session-level capture and recall are
handled by omega's native hooks (configured globally). The adapter handles
skill-invoked operations. All commands read JSON from stdin, output JSON
to stdout, and exit 0 even on failure.

```bash
echo '<json>' | ~/.claude-cabinet/omega-venv/bin/python3 scripts/cabinet-memory-adapter.py <command>
```

| Command | Input | Output |
|---------|-------|--------|
| `store` | `{text, type, tags?, project?}` | `{ok, id}` — stored memory ID |
| `query` | `{text, limit?, type?, project?, scope?}` | `{ok, results}` — semantic search with project scoping |
| `delete` | `{id}` | `{ok, deleted}` — requires full node_id |
| `list` | `{type?, project?, limit?}` | `{ok, memories, count}` — all memories with full IDs |

Memory types: `decision`, `lesson_learned`, `user_preference`, `constraint`,
`error_pattern`.

## Commands

Parse the user's intent from their prompt:

### Browse (default — no arguments)

Show the timeline and stats:

```bash
~/.claude-cabinet/omega-venv/bin/omega timeline 2>&1
~/.claude-cabinet/omega-venv/bin/omega stats 2>&1
```

Present both outputs conversationally. The timeline shows what's stored
chronologically, stats shows the type distribution.

### Search — user provides a topic

```bash
echo '{"text": "the user query", "limit": 10}' | \
  ~/.claude-cabinet/omega-venv/bin/python3 scripts/cabinet-memory-adapter.py query
```

**Scope options** (pass `scope` in the JSON):
- `"tiered"` (default) — project memories first, then cross-project to fill
- `"project"` — only memories from this project
- `"all"` — memories from all projects equally

The `project` field defaults to the current directory name. Results
include a `tier` field ("project" or "cross-project") in tiered mode.

Present results conversationally — highlight the most relevant matches,
their types, and which project they came from when cross-project results
appear.

**Graph enrichment:** For the top 1-2 results, check for related memories
via omega's graph traversal. This surfaces the knowledge network — not
just what matched, but what's connected to what matched:

```bash
~/.claude-cabinet/omega-venv/bin/python3 -c "
from omega import traverse
result = traverse('THE_MEMORY_ID', max_hops=2)
print(result)
"
```

If traversal returns connected memories, present them as "Related:"
under the main result. Edge types tell the story:
- `related` — semantically similar
- `evolution` — this understanding has developed over time
- `contradicts` — conflicts with another memory (surface both sides)
- `temporal_cluster` — captured in the same session

### Remember — user wants to store something

```bash
echo '{"text": "what to remember", "type": "preference"}' | \
  ~/.claude-cabinet/omega-venv/bin/python3 scripts/cabinet-memory-adapter.py store
```

Pick the type based on what the user said:
- `decision` — they made a choice and want it recorded (permanent)
- `lesson` — they learned something (maps to `lesson_learned`, permanent)
- `preference` — they want something done a certain way (maps to `user_preference`, permanent)
- `constraint` — a limitation or prerequisite (permanent)
- `error` — a failure pattern to avoid (maps to `error_pattern`, permanent)

The adapter maps friendly names to omega's native types for correct TTL.

Confirm what was stored. After storing, check for similar existing memories
and link them if relevant:

```bash
~/.claude-cabinet/omega-venv/bin/python3 -c "
from omega import find_similar_memories
result = find_similar_memories('THE_NEW_MEMORY_ID')
print(result)
"
```

If similar memories exist, tell the user: "This connects to N existing
memories about [topic]." Omega auto-relates on store, but surfacing it
builds user confidence that the knowledge graph is working.

### Link — user wants to connect memories

If the user says "link these" or "these are related":

```bash
~/.claude-cabinet/omega-venv/bin/python3 -c "
from omega import SQLiteStore
s = SQLiteStore()
s.add_edge('MEM_ID_1', 'MEM_ID_2', edge_type='related', weight=1.0)
print('Linked')
"
```

Edge types: `related`, `contradicts`, `supersedes`, `evolves`.

### Contradictions — user asks what conflicts

```bash
~/.claude-cabinet/omega-venv/bin/python3 -c "
from omega import SQLiteStore
s = SQLiteStore()
edges = s.get_edges_by_type('contradicts')
for e in edges:
    print(f\"{e['source_id']} <-> {e['target_id']} (confidence: {e['weight']:.2f})\")
if not edges: print('No contradictions found')
"
```

For each contradiction pair, query both memories to show the user what
conflicts. Ask which one is correct, then supersede the wrong one.

### Forget — user wants to remove something

**Step 1:** Find the memory. Use `list` to get full node_ids:

```bash
echo '{"type": "preference", "limit": 20}' | \
  ~/.claude-cabinet/omega-venv/bin/python3 scripts/cabinet-memory-adapter.py list
```

Or search by content:

```bash
echo '{"text": "the topic to forget"}' | \
  ~/.claude-cabinet/omega-venv/bin/python3 scripts/cabinet-memory-adapter.py query
```

**Step 2:** Show the user what matched. Confirm which one(s) to delete.

**Step 3:** Delete by full node_id (e.g. `mem-077e6037742e`, NOT the
truncated `mem-077e6037` shown in timeline):

```bash
echo '{"id": "mem-077e6037742e"}' | \
  ~/.claude-cabinet/omega-venv/bin/python3 scripts/cabinet-memory-adapter.py delete
```

The `list` command returns full node_ids. The `timeline` CLI shows
truncated IDs — always use `list` to get the correct ID for deletion.

## Presentation

Keep it conversational. Don't dump raw CLI output or JSON — summarize it.
For timeline, present as a readable list. For search results, highlight
the most relevant matches and their types. For forget, always confirm
before deleting.
