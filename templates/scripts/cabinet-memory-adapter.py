#!/usr/bin/env python3
"""
Cabinet Memory Adapter — single Python file wrapping omega interaction.

Called by skills and scripts via the venv Python. Provides project-scoped
tiered retrieval (omega's main gap) and a stable JSON-in/JSON-out interface.
Designed for D2 (never block Claude Code) and D3 (graceful degradation).

Note: Session-level hooks (welcome, capture, session start/stop) are handled
by omega's native hooks configured in ~/.claude/settings.json (global).
This adapter handles skill-invoked operations only.

Usage:
    cabinet-memory-adapter.py <command> [options]

Commands:
    store           Store a memory directly (called by debrief, /memory)
    query           Query memories by text (with project-scoped tiering)
    delete          Delete a memory by full node_id
    list            List all memories with full node_ids

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


def cmd_store():
    """Store a memory directly.

    Reads JSON from stdin with fields:
        text: the memory content (required)
        type: event_type for omega (default: "lesson")
        tags: list of tags (stored in metadata, optional)
        project: project name (default: basename of cwd)
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
        project = data.get("project", os.path.basename(os.getcwd()))
        metadata = {}
        if data.get("tags"):
            metadata["tags"] = data["tags"]
        result = omega.store(
            text,
            event_type=event_type,
            project=project,
            metadata=metadata if metadata else None,
        )
        _output({"ok": True, "id": result if isinstance(result, str) else None})
    except Exception as e:
        _error(f"store failed: {e}")


def cmd_query():
    """Query memories by text with tiered project scoping.

    Reads JSON from stdin with fields:
        text: the query text (required)
        limit: max results (default: 5)
        type: filter by event_type (optional)
        project: project name for scoping (default: basename of cwd)
        scope: "project" (default), "all", or "tiered"
            - "project": only memories from this project
            - "all": memories from all projects
            - "tiered": project-scoped first, then cross-project to fill limit
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
        project = data.get("project", os.path.basename(os.getcwd()))
        scope = data.get("scope", "tiered")

        def _parse_results(results):
            """Normalize query results into a list of dicts.

            omega.query() returns a formatted markdown string. We parse it
            back into structured data. Also queries the DB to get the project
            field for each memory (not included in the formatted output).
            """
            if isinstance(results, (list, tuple)):
                out = []
                for r in results:
                    if isinstance(r, dict):
                        out.append({
                            "text": r.get("content", r.get("text", str(r))),
                            "type": r.get("event_type", "unknown"),
                            "score": r.get("score", 0),
                            "project": r.get("project", ""),
                            "id": r.get("node_id", ""),
                        })
                    else:
                        out.append({"text": str(r)})
                return out

            if not isinstance(results, str) or not results.strip():
                return []

            # Parse formatted markdown from omega.query()
            # Format: ## N. [type] `mem-xxx` (str: 0.xx)\ncontent\n*timestamp*
            import re
            entries = []
            blocks = re.split(r'\n## \d+\.', results)
            for block in blocks:
                block = block.strip()
                if not block:
                    continue
                id_match = re.search(r'`(mem-[a-f0-9]+)`', block)
                type_match = re.search(r'\[(\w+)\]', block)
                score_match = re.search(r'str: ([\d.]+)', block)
                # Content is everything after the first line, minus the timestamp
                lines = block.split('\n')
                content_lines = [l for l in lines[1:] if not l.startswith('*')]
                content = '\n'.join(content_lines).strip()

                if not id_match:
                    continue  # skip header/noise lines
                entry = {
                    "text": content,
                    "type": type_match.group(1) if type_match else "unknown",
                    "score": float(score_match.group(1)) if score_match else 0,
                    "id": id_match.group(1) if id_match else "",
                    "project": "",
                }
                entries.append(entry)

            # Enrich with project from DB
            if entries:
                try:
                    import sqlite3
                    db_path = os.path.expanduser("~/.omega/omega.db")
                    conn = sqlite3.connect(db_path)
                    ids = [e["id"] for e in entries if e["id"]]
                    if ids:
                        placeholders = ",".join("?" * len(ids))
                        rows = conn.execute(
                            f"SELECT node_id, project FROM memories WHERE node_id IN ({placeholders})",
                            ids,
                        ).fetchall()
                        proj_map = {r[0]: r[1] or "" for r in rows}
                        for e in entries:
                            e["project"] = proj_map.get(e["id"], "")
                    conn.close()
                except Exception:
                    pass  # D3: project enrichment is best-effort

            return entries

        # All scopes fetch from omega broadly, then filter in the adapter.
        # omega.query() doesn't reliably pass project_path to the store,
        # so we do project filtering ourselves.
        over_fetch = limit * 3  # fetch extra so filtering still yields enough

        if scope == "all":
            results = omega.query(text, limit=over_fetch, event_type=event_type)
            parsed = _parse_results(results)[:limit]
            _output({"ok": True, "results": parsed, "scope": "all"})

        elif scope == "project":
            results = omega.query(text, limit=over_fetch, event_type=event_type)
            parsed = _parse_results(results)
            filtered = [m for m in parsed if m.get("project") == project][:limit]
            _output({"ok": True, "results": filtered, "scope": "project", "project": project})

        else:  # tiered (default)
            results = omega.query(text, limit=over_fetch, event_type=event_type)
            parsed = _parse_results(results)

            # Tier 1: project-scoped
            project_memories = [m for m in parsed if m.get("project") == project][:limit]
            for m in project_memories:
                m["tier"] = "project"

            # Tier 2: cross-project to fill remaining slots
            remaining = limit - len(project_memories)
            cross_memories = []
            if remaining > 0:
                seen_ids = {m["id"] for m in project_memories if m["id"]}
                for m in parsed:
                    if m.get("project") != project and m.get("id") not in seen_ids:
                        m["tier"] = "cross-project"
                        cross_memories.append(m)
                        if len(cross_memories) >= remaining:
                            break

            combined = project_memories + cross_memories
            _output({
                "ok": True,
                "results": combined,
                "scope": "tiered",
                "project": project,
                "project_count": len(project_memories),
                "cross_project_count": len(cross_memories),
            })

    except Exception as e:
        _error(f"query failed: {e}")


def cmd_delete():
    """Delete a memory by its full node_id.

    Reads JSON from stdin with fields:
        id: the full node_id (e.g. "mem-077e6037742e") (required)

    Note: omega uses full node_ids, not the truncated display IDs
    shown in timeline output. Query first to get the full ID.
    """
    data = _read_stdin()
    omega = _import_omega()
    if not omega:
        _error("omega not available")
        return

    memory_id = data.get("id", "")
    if not memory_id:
        _error("no id provided")
        return

    try:
        result = omega.delete_memory(memory_id)
        if isinstance(result, dict) and result.get("success"):
            _output({"ok": True, "deleted": memory_id})
        else:
            error = result.get("error", "unknown error") if isinstance(result, dict) else str(result)
            _error(f"delete failed: {error}")
    except Exception as e:
        _error(f"delete failed: {e}")


def cmd_list():
    """List all memories with their full node_ids.

    Returns all memories so delete can target the correct ID.
    Reads JSON from stdin with optional fields:
        type: filter by event_type (optional)
        project: filter by project (optional)
        limit: max results (default: 50)
    """
    data = _read_stdin()

    try:
        import sqlite3
        db_path = os.path.expanduser("~/.omega/omega.db")
        if not os.path.exists(db_path):
            _error("omega database not found")
            return

        conn = sqlite3.connect(db_path)
        event_type = data.get("type")
        project = data.get("project")
        limit = data.get("limit", 50)

        where_clauses = []
        params = []
        if event_type:
            where_clauses.append("event_type = ?")
            params.append(event_type)
        if project:
            where_clauses.append("project = ?")
            params.append(project)

        where = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        params.append(limit)

        rows = conn.execute(
            f"SELECT node_id, content, event_type, project, created_at FROM memories {where} ORDER BY created_at DESC LIMIT ?",
            params,
        ).fetchall()

        memories = [
            {"id": r[0], "text": r[1], "type": r[2], "project": r[3] or "", "created": r[4]}
            for r in rows
        ]
        _output({"ok": True, "memories": memories, "count": len(memories)})
    except Exception as e:
        _error(f"list failed: {e}")


COMMANDS = {
    "store": cmd_store,
    "query": cmd_query,
    "delete": cmd_delete,
    "list": cmd_list,
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
