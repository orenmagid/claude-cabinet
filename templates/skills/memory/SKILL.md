---
name: memory
description: |
  Browse and search semantic memory. Shows what omega remembers — decisions,
  lessons, preferences, constraints. Use when: "what's in memory", "memory",
  "/memory", "what do you remember", "show memories", "search memory".
user-invocable: true
---

# /memory — Browse Semantic Memory

## Purpose

Give the user visibility into what omega remembers. Browse, search, and
manage the semantic memory store.

## Prerequisites

Check that omega is available:
- `~/.claude-cabinet/omega-venv/bin/python3` exists
- `scripts/cabinet-memory-adapter.py` exists

If not available, tell the user:
> Memory module is not set up. Run `npx create-claude-cabinet` to install it.

## Commands

Parse the user's intent from their prompt:

### Browse (default — no arguments)

Show the timeline and stats:

```bash
~/.claude-cabinet/omega-venv/bin/omega timeline 2>&1
~/.claude-cabinet/omega-venv/bin/omega stats 2>&1
```

Present both outputs. The timeline shows what's stored chronologically,
stats shows the type distribution.

### Search — user provides a topic

Query omega for memories matching the topic:

```bash
echo '{"text": "the user query", "limit": 10}' | \
  ~/.claude-cabinet/omega-venv/bin/python3 scripts/cabinet-memory-adapter.py query
```

Present the results conversationally — don't just dump JSON.

### Remember — user wants to store something

Store a new memory:

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

Look up the memory first with a query, show them what matched, confirm
which one to remove. Use omega's delete:

```bash
~/.claude-cabinet/omega-venv/bin/omega query "the topic" 2>&1
```

Then delete by ID:

```bash
echo '{"text": "delete mem-XXXX", "type": "memory"}' | \
  ~/.claude-cabinet/omega-venv/bin/python3 scripts/cabinet-memory-adapter.py store
```

Note: omega doesn't have a direct delete API in the adapter yet. For now,
tell the user the memory ID and that direct deletion requires the omega CLI.

## Presentation

Keep it conversational. Don't dump raw CLI output — summarize it.
For timeline, present as a readable list. For search results, highlight
the most relevant matches and their types.
