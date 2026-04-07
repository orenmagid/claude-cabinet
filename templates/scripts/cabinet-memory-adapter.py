#!/usr/bin/env python3
"""
Cabinet Memory Adapter — single Python file wrapping all omega interaction.

Called by hook scripts via the venv Python. All omega calls go through here.
Designed for D2 (never block Claude Code) and D3 (graceful degradation).

Usage:
    cabinet-memory-adapter.py <command> [options]

Commands:
    welcome         Surface relevant memories for session start
    capture         Store a memory from hook input (PostCompact)
    store           Store a memory directly (called by debrief)
    query           Query memories by text
    status          Check omega health

All commands read JSON from stdin when applicable.
All commands output JSON to stdout.
All commands exit 0 even on failure (D2: never block).
"""

import json
import os
import sys

# Disable omega telemetry (PB2: opt-in only, we opt out)
os.environ["OMEGA_TELEMETRY"] = "0"


def _output(data):
    """Write JSON to stdout and exit cleanly."""
    print(json.dumps(data))
    sys.exit(0)


def _error(msg):
    """Log error to stderr, output empty result, exit 0 (D2: never block)."""
    print(f"cabinet-memory: {msg}", file=sys.stderr)
    _output({"ok": False, "error": msg})


def _read_stdin():
    """Read JSON from stdin, return dict or empty dict on failure."""
    try:
        return json.load(sys.stdin)
    except Exception:
        return {}


def _import_omega():
    """Import omega, returning the module or None on failure."""
    try:
        import omega
        return omega
    except ImportError:
        return None


def cmd_welcome():
    """Surface relevant memories for session start.

    Reads session context from stdin (session_id, cwd, source).
    Calls omega.welcome() to get relevant memories.
    Outputs memories as context text for SessionStart hook stdout.
    """
    data = _read_stdin()
    omega = _import_omega()
    if not omega:
        _error("omega not available")
        return

    try:
        cwd = data.get("cwd", os.getcwd())
        project_name = os.path.basename(cwd)

        result = omega.welcome(project=project_name)
        if not result:
            _output({"ok": True, "context": ""})
            return

        # welcome() returns a dict with memory count, recent memories, etc.
        if isinstance(result, dict):
            context = (
                result.get("observation_prefix", "")
                or result.get("summary", "")
                or result.get("context", "")
            )
            if not context and result.get("memory_count", 0) == 0:
                _output({"ok": True, "context": ""})
                return
            if not context:
                context = json.dumps(result, indent=2)
            _output({"ok": True, "context": context})
        elif isinstance(result, str):
            _output({"ok": True, "context": result})
        else:
            _output({"ok": True, "context": str(result)})
    except Exception as e:
        _error(f"welcome failed: {e}")


def cmd_capture():
    """Capture context from PostCompact summary.

    Reads compact_summary from stdin.
    Extracts key decisions, lessons, and reasoning chains.
    Stores them in omega.
    """
    data = _read_stdin()
    omega = _import_omega()
    if not omega:
        _error("omega not available")
        return

    summary = data.get("compact_summary", "")
    if not summary:
        _output({"ok": True, "stored": 0, "reason": "no summary"})
        return

    session_id = data.get("session_id", "unknown")
    cwd = data.get("cwd", os.getcwd())
    project_name = os.path.basename(cwd)

    try:
        result = omega.auto_capture(
            summary,
            event_type="compaction",
            session_id=session_id,
            project=project_name,
        )
        count = 0
        if isinstance(result, dict):
            count = result.get("stored", 0)
        elif isinstance(result, (list, tuple)):
            count = len(result)

        _output({"ok": True, "stored": count})
    except Exception as e:
        _error(f"capture failed: {e}")


def cmd_store():
    """Store a memory directly.

    Reads JSON from stdin with fields:
        text: the memory content (required)
        type: event_type for omega (default: "lesson")
        tags: list of tags (stored in metadata, optional)
    """
    data = _read_stdin()
    omega = _import_omega()
    if not omega:
        _error("omega not available")
        return

    text = data.get("text", "")
    if not text:
        _error("no text provided")
        return

    try:
        event_type = data.get("type", "lesson")
        metadata = {}
        if data.get("tags"):
            metadata["tags"] = data["tags"]
        result = omega.store(
            text,
            event_type=event_type,
            metadata=metadata if metadata else None,
        )
        _output({"ok": True, "id": result if isinstance(result, str) else None})
    except Exception as e:
        _error(f"store failed: {e}")


def cmd_query():
    """Query memories by text.

    Reads JSON from stdin with fields:
        text: the query text (required)
        limit: max results (default: 5)
    """
    data = _read_stdin()
    omega = _import_omega()
    if not omega:
        _error("omega not available")
        return

    text = data.get("text", "")
    if not text:
        _error("no query text provided")
        return

    try:
        limit = data.get("limit", 5)
        event_type = data.get("type")
        results = omega.query(
            text,
            limit=limit,
            event_type=event_type,
        )

        # query() returns a formatted string of results
        if isinstance(results, str):
            _output({"ok": True, "results": results})
        elif isinstance(results, (list, tuple)):
            memories = []
            for r in results:
                if isinstance(r, dict):
                    memories.append({
                        "text": r.get("content", r.get("text", str(r))),
                        "type": r.get("event_type", "unknown"),
                        "score": r.get("score", 0),
                    })
                else:
                    memories.append({"text": str(r)})
            _output({"ok": True, "memories": memories})
        else:
            _output({"ok": True, "results": str(results)})
    except Exception as e:
        _error(f"query failed: {e}")


def cmd_status():
    """Check omega health status."""
    omega = _import_omega()
    if not omega:
        _output({"ok": False, "status": "omega not available"})
        return

    try:
        result = omega.status()
        if isinstance(result, dict):
            _output({"ok": True, **result})
        else:
            _output({"ok": True, "status": str(result)})
    except Exception as e:
        _error(f"status failed: {e}")


COMMANDS = {
    "welcome": cmd_welcome,
    "capture": cmd_capture,
    "store": cmd_store,
    "query": cmd_query,
    "status": cmd_status,
}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        cmds = ", ".join(COMMANDS.keys())
        _error(f"usage: cabinet-memory-adapter.py <{cmds}>")
    else:
        try:
            COMMANDS[sys.argv[1]]()
        except Exception as e:
            # Outermost catch — D2: never block, never crash
            _error(f"unexpected error: {e}")
