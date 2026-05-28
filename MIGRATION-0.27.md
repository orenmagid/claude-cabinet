# Migrating to Claude Cabinet v0.27.0

If you've been using CC v0.10–v0.26 with the memory module, this
version changes how memory works. Most users need to run one
command. Everything's reversible.

## Do I need to do anything?

Probably one command:

```bash
npx create-claude-cabinet@latest --migrate-memory
```

That's the typical case. It exports your omega memories to Claude
Code's built-in memory layout, writes a backup, then disables
omega's hooks and MCP server. Idempotent — safe to re-run.

**You're already fine without running it if:**
- You never installed the `memory` module (check `.ccrc.json` —
  if `modules.memory` isn't there, you weren't using omega).
- You're upgrading via `/cc-upgrade` — that skill detects omega
  artifacts and offers migration with a dry-run-default prompt.

**Try the dry-run first if you're unsure:**

```bash
npx create-claude-cabinet@latest --migrate-memory --dry-run
```

It shows the 10 steps that would execute without mutating anything.

## What about my old memories?

**Preserved.** Migration writes them as plain markdown topic files
at `~/.claude/projects/<project-slug>/memory/`, indexed in
`MEMORY.md`. The omega database at `~/.omega/omega.db` is NOT
touched — it stays as the canonical source until you (or a future
CC version) explicitly archive it.

Each memory file looks like this:

```markdown
### YYYY-MM-DD — decision

We chose X over Y because Z.

_source: omega mem-XXXXXXXX_

## Related
- [[mem-YYYY]] - Contradicts
- [[mem-ZZZZ]] - Temporal Cluster
```

The `_source:` line preserves the original omega memory ID. The
`## Related` section captures omega's inter-memory edges. A
sidecar `edges.json` has the full edge graph.

Topic files are organized by type: `decisions.md`, `lessons.md`,
`preferences.md`, `constraints.md`, `session-summaries.md`. Memories
from other projects on this machine go into `cross-<project>.md`
files (e.g., `cross-flow.md`). Unattributed memories go to
`unscoped.md`.

**Already have native (non-omega) memory in that directory?**
Migration is additive — it never overwrites your existing files.
If the memory dir already has native memory that wasn't written by
a prior omega migration, the omega memories land in an
`omega-migrated/` subdirectory and an indexed section is appended to
your existing `MEMORY.md`. Your native files are left exactly as they
were, and the whole directory is backed up to
`<memory-dir>.pre-omega-merge-<timestamp>` first. (Earlier in the
v0.27.0 release this case was skipped, which meant omega memories
were silently not migrated for projects that already had native
memory — v0.27.1 fixes that with the merge.)

## What will I notice change?

**During sessions:**

- `/orient` no longer queries omega — it reads `MEMORY.md` and
  loads relevant topic files on demand.
- `/memory` is now the *reader* skill (browse, search, validate).
  Writing happens via `/cc-remember`.
- When you ask Claude to "remember X", it'll use `/cc-remember`
  to write a per-file curated entry and update MEMORY.md's index.
- `omega_store`, `omega_query`, etc. MCP tools no longer appear —
  the omega MCP server is unregistered.
- `cabinet-historian` no longer runs graph traversal queries — it
  reads the markdown directly.

**On disk:**

- No more Python venv at `~/.claude-cabinet/omega-venv/` (after
  Phase 9.1 cleanup; until then it just sits unused).
- Hooks in `~/.claude/settings.json` no longer include the 4
  omega entries.
- `~/.claude/CLAUDE.md` no longer has the OMEGA-managed block.

**No paywall.** The omega Pro tier ($/month) is gone from your
workflow. Built-in memory is fully local-file-based.

## What if I never used omega?

You can skip the migration command entirely. CC v0.27.0 won't
offer or install the memory module on fresh installs. Your
sessions will use Claude Code's built-in auto-memory directly.

If you ran the installer at some point and ended up with empty or
near-empty omega state (auto-captured during long sessions but
never reviewed), `--migrate-memory` is still safe to run — it'll
report a small migration count and proceed with the cleanup steps.
Or skip it entirely; no real difference.

## What if something goes wrong?

**Roll back:**

```bash
npx create-claude-cabinet@latest --unmigrate-memory
```

That restores all 4 backed-up files (`~/.claude/CLAUDE.md`,
`~/.claude/settings.json`, `~/.claude.json`, project `.mcp.json`)
from the backup directory recorded in
`.ccrc.json.migrated_from_omega.backupDir`. Omega resumes working
on next session start.

The migrated topic files at `~/.claude/projects/<slug>/memory/`
are preserved through unmigrate — you can keep them, delete them
manually, or leave them indexed alongside omega's content.

**If `--unmigrate-memory` isn't available** (very old install,
missing backup dir, etc.) the backup directory has a
`ROLLBACK.md` with manual restoration steps. Pin to v0.26.x as
the last-resort fallback.

**Concurrent sessions caveat:** if other Claude Code sessions
were running during your migration, they silently lost omega
capture for the rest of their lifetime. Restart them to fully
move them to built-in.

## Forward-compatibility note

The per-file curated layout is forward-compatible with future
memory-consolidation features (Anthropic's Dreams, currently API-
only for Managed Agents). When/if Dreams lands in Claude Code, no
re-migration is needed — Dreams works against the same on-disk
memory layout this migration produces.

## Why the change?

Six months of running omega across several projects surfaced four
recurring problems:

1. **Empty knowledge graph.** `omega stats` reported 0 edges
   across hundreds of memories. The auto-relate feature wasn't
   producing the connected graph the system advertised.
2. **Retrieval noise.** Basic queries returned hits at 0%
   similarity. Cross-project drift dominated single-project
   queries.
3. **Paywalled core.** `omega_protocol()` (the coordination
   playbook) is OMEGA Pro. Free-tier sessions get an error or
   a "buy Pro" stub.
4. **Recurring integration tax.** ONNX SIGSEGV, ESM type:module
   bug, hook PATH issues, infinite Stop hook loop, MCP server
   disconnects, packaging gap on `omega.protocol`. Every CC
   release shipped at least one omega-related fix.

Claude Code's built-in memory (markdown files at
`~/.claude/projects/<slug>/memory/`) covers ~80% of what omega was
doing, with no daemon, no paywall, no Python venv, no recurring
debugging. The remaining 20% (cross-project semantic recall) is
better served by `.claude/rules/` symlinks for shared rules than
by re-introducing another semantic stack.

The decision was deliberate and reversible: see
`prj:efd10e1d` in pib-db for the full plan + cabinet critique +
dissent recorded.

## Appendix: What the migration script actually does

`--migrate-memory` runs 10 steps in order, each individually
idempotent. State persists to `.ccrc.json.migrated_from_omega`
after every step — mid-run Ctrl-C leaves resumable state.

1. **snapshot** — captures pre-migration state (hooks, OMEGA
   block, MCP entries across all 3 locations, omega stats,
   project keys, git SHA) to
   `.claude/plans/omega-winddown-snapshot.json`.
2. **backup-files** — copies `~/.claude/CLAUDE.md`,
   `~/.claude/settings.json`, `~/.claude.json`, and project
   `.mcp.json` (if it has an omega entry) into
   `~/.claude-cabinet/migration-backup-<timestamp>-<pid>/`.
3. **write-rollback-doc** — writes `ROLLBACK.md` in the backup
   dir with restoration instructions.
4. **migrate-memories** — exports omega memories via
   `omega export-obsidian`, classifies by project key
   (worktree-aware, agent-aware, null-handling), writes per-type
   topic files + cross-project files + MEMORY.md index +
   edges.json sidecar at the project's memory dir.
5. **disable-omega-hooks** — strips omega-venv-matching hooks
   from `~/.claude/settings.json`.
6. **strip-omega-block** — removes the OMEGA-managed block from
   `~/.claude/CLAUDE.md`. Refuses if markers are malformed
   (backup is the source of truth).
7. **remove-mcp-entries** — strips omega from all 3 MCP config
   locations (`~/.claude/settings.json`, `~/.claude.json`,
   project `.mcp.json`).
8. **add-disabled-mcp** — appends `[omega, omega-memory]` to
   `~/.claude/settings.json.disabledMcpjsonServers` to prevent
   re-registration if you later pip-install omega-memory.
9. **remove-guard-hook** — strips `omega-memory-guard.sh` from
   project `.claude/settings.json` hooks.
10. **remove-installed-memory-skill** — removes project
    `.claude/skills/memory/` if SKILL.md matches upstream omega
    markers (i.e., untouched). Refuses with a warning if the
    skill was customized.

After all 10 complete, state flips to `complete` and re-runs are
no-ops unless `--force` is passed.

## Questions?

- File an issue at the CC repo (link in package.json's
  `repository` field).
- Or run `/cc-feedback` from any CC-installed project — it goes
  to the upstream outbox.
