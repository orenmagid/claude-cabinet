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

The adapter (`scripts/cabinet-memory-adapter.py`) is the single interface
to omega. All commands read JSON from stdin, output JSON to stdout, and
exit 0 even on failure. Always call it via the venv Python:

```bash
echo '<json>' | ~/.claude-cabinet/omega-venv/bin/python3 scripts/cabinet-memory-adapter.py <command>
```

| Command | Input | Output |
|---------|-------|--------|
| `welcome` | `{}` or hook JSON | `{ok, context}` — relevant memories |
| `store` | `{text, type, tags?, project?}` | `{ok, id}` — stored memory ID |
| `query` | `{text, limit?, type?, project?, scope?}` | `{ok, results}` — semantic search |
| `delete` | `{id}` | `{ok, deleted}` — requires full node_id |
| `list` | `{type?, project?, limit?}` | `{ok, memories, count}` — all memories with full IDs |
| `capture` | hook JSON with `compact_summary` | `{ok, stored}` — auto-capture count |
| `status` | `{}` | `{ok, ...health info}` |

Memory types: `decision`, `lesson`, `preference`, `constraint`, `pattern`,
`compaction`.

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

### Remember — user wants to store something

```bash
echo '{"text": "what to remember", "type": "preference"}' | \
  ~/.claude-cabinet/omega-venv/bin/python3 scripts/cabinet-memory-adapter.py store
```

Pick the type based on what the user said:
- `decision` — they made a choice and want it recorded
- `lesson` — they learned something
- `preference` — they want something done a certain way
- `constraint` — a limitation or prerequisite
- `pattern` — a convention or recurring approach

Confirm what was stored.

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
