# Record Lessons — Capture What Was Learned

Define how to capture lessons from the session so future sessions are
smarter. This is the second irreducible purpose of debrief — without it,
the system does work but doesn't learn from it.

When this file is absent or empty, the default behavior is: ask whether
the session revealed anything future sessions need to know. To explicitly
skip lesson recording, write only `skip: true`.

Lessons are perishable. A lesson captured while context is fresh is worth
ten captured from memory next week. This is why recording happens during
debrief, not "sometime later."

## Where to Record — Omega Primary

Check whether omega memory is available:
- `~/.claude-cabinet/omega-venv/bin/python3` exists AND
- `scripts/cabinet-memory-adapter.py` exists

**When omega is available (primary path):** Write lessons to omega via
the adapter. This is the durable, semantic memory store that persists
across sessions and supports retrieval by meaning, not just keyword.

```bash
echo '{"text": "the lesson", "type": "lesson", "tags": ["tag1"]}' | \
  ~/.claude-cabinet/omega-venv/bin/python3 scripts/cabinet-memory-adapter.py store
```

Memory types to use:
- `decision` — architectural choices, tradeoff resolutions
- `lesson` — gotchas, discoveries, things that surprised
- `preference` — user corrections, style choices, workflow preferences
- `constraint` — limitations discovered, prerequisites found
- `pattern` — conventions established, recurring solutions

**When omega is NOT available (fallback):** Use the flat markdown memory
system (auto-memory in `~/.claude/projects/` memory directory). This is
the same system Claude Code uses natively. It works, but lacks semantic
retrieval.

## What to Look For

Review the session and ask:
- Did we learn something future sessions need to know?
  - A new pattern established
  - A gotcha discovered
  - A process gap identified
  - A user preference revealed
- Is this the second or third time something came up? If the same kind
  of problem keeps recurring, the lesson is "create a prevention mechanism"
  not just "remember this."
- Did the session's work contradict any existing recorded knowledge?
  If so, update or remove the stale record (in omega: use `query` to
  find it, then note the contradiction in the new memory).

## What NOT to Record
- Code patterns derivable by reading current files
- Git history (use git log)
- Debugging solutions (the fix is in the code)
- Anything already in CLAUDE.md files
- Ephemeral task details only relevant to this session

## After Storing — Link and Check

After storing each memory, omega auto-relates it to similar existing
memories. Surface this to the user:

```bash
~/.claude-cabinet/omega-venv/bin/python3 -c "
from omega import find_similar_memories
result = find_similar_memories('THE_NEW_MEMORY_ID')
print(result)
"
```

If the new memory is similar to existing ones, mention it:
"This connects to your earlier memory about [topic]."

Also check for contradictions — if the new memory conflicts with an
existing one, ask the user which is correct:

```bash
~/.claude-cabinet/omega-venv/bin/python3 -c "
from omega import SQLiteStore
s = SQLiteStore()
edges = s.get_edges_by_type('contradicts')
for e in edges: print(f\"{e['source_id']} <-> {e['target_id']} ({e['weight']:.2f})\")
"
```

## Report What Was Recorded
Tell the user what memories were created or updated so they know what
the system will remember next time. Include the count, types, and any
new connections discovered in the knowledge graph.
