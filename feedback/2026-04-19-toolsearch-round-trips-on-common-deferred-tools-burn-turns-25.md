# ToolSearch round-trips on common deferred tools burn turns

**Source:** Tool-loading protocol (deferred tool schema fetch)
**Impact:** In a session with varied tool use, TodoWrite, preview_*, omega_store, AskUserQuestion, and others start deferred. Each first-use requires a ToolSearch call which adds a "Tool loaded." turn. In this session I needed TodoWrite (early), preview tools (mid), omega_store (late) — ~3 extra turns of pure plumbing.

**Observation:** The deferred-tool mechanism is correct for context economy — loading all schemas upfront would balloon the system prompt. But the protocol means frequently-used tools like TodoWrite pay the round-trip in every long session. For tools that are empirically used >50% of non-trivial sessions, loading the schema by default in the system prompt might be net-cheaper than the repeated round-trips.

**Possible fixes upstream:**
1. Pre-load schemas for a small set of high-frequency tools (TodoWrite being the most obvious; MCP tools are user-configured and reasonably deferred)
2. Let projects opt into pre-loading certain tools via a config file (`.claude/tool-preload.json`)
3. Batch "expected-soon" schemas at session start based on the active skill (/execute pre-loads TodoWrite; /debrief pre-loads omega_store)

**Workaround:** Call ToolSearch earlier, batch multiple tools in one call. Already doing this.

**Session context:** Long multi-phase session running /execute with cabinet checkpoints + AC verification + /debrief. Not unusual.
