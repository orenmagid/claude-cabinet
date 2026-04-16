# OMEGA MCP tools not available despite hooks being configured

**Source:** sic  
**Date:** 2026-04-14  
**Component:** omega (MCP server registration)

OMEGA hooks are present in ~/.claude/settings.json (session_start, auto_capture, assistant_capture, session_stop, surface_memories) and fire correctly. But mcpServers in the same file is empty {}, so none of the OMEGA MCP tools (omega_store, omega_query, omega_welcome, omega_protocol, etc.) are available to the assistant. The CLAUDE.md instructions say to call omega_welcome() and omega_protocol() at session start, but there's no way to do so. This means OMEGA's hooks collect data but the assistant can't query or store to OMEGA directly.

Suggestion: OMEGA setup should register its MCP server in mcpServers alongside the hooks, or the installer should verify both are present.

Session context: Mid-session in [sic] article-rewriter project, tried to store feedback memory via OMEGA and discovered the tools weren't available.
