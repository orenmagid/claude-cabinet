# Omega Migration Detection (cc-upgrade phase)

Runs ONLY when omega-era artifacts are detected on the user's machine.
The memory module shipped in CC v0.10–v0.26 and is removed in v0.27.0.
After the installer auto-removes omega from MODULES, the runtime
artifacts (omega venv, hooks, MCP entries, OMEGA block in
`~/.claude/CLAUDE.md`, installed memory skill, omega DB) remain on
disk until migrated.

## Detection

Return true if ANY of:

1. `.ccrc.json` has `modules.memory === true`
2. `~/.claude-cabinet/omega-venv/` directory exists
3. Any hook command in `~/.claude/settings.json` contains `omega-venv`
4. `~/.claude/settings.json.mcpServers` or
   `~/.claude.json.mcpServers` has any key matching
   `/^omega(-memory)?$/i` OR any command containing `omega-venv`
5. Any inert omega file artifact remains in the project (a migration
   that tore down the venv/hooks/MCP can still leave these on disk):
   `.claude/hooks/omega-memory-guard.sh`, `.claude/hooks/domain-memories.sh`,
   `scripts/cabinet-memory-adapter.py`, `scripts/migrate-memory-to-omega.py`

Full detection check:

```bash
HAS_OMEGA=0
test -d "$HOME/.claude-cabinet/omega-venv" && HAS_OMEGA=1
grep -q omega-venv "$HOME/.claude/settings.json" 2>/dev/null && HAS_OMEGA=1
python3 -c "
import json
for p in ['$HOME/.claude/settings.json', '$HOME/.claude.json']:
    try:
        d = json.load(open(p))
        mcps = d.get('mcpServers', {})
        for k, s in mcps.items():
            if 'omega' in k.lower(): raise SystemExit(0)
            cmd = (s or {}).get('command', '')
            if 'omega-venv' in cmd: raise SystemExit(0)
    except (FileNotFoundError, json.JSONDecodeError):
        pass
raise SystemExit(1)
" 2>/dev/null && HAS_OMEGA=1
for f in .claude/hooks/omega-memory-guard.sh .claude/hooks/domain-memories.sh \
         scripts/cabinet-memory-adapter.py scripts/migrate-memory-to-omega.py; do
  test -f "$f" && HAS_OMEGA=1
done
```

If `HAS_OMEGA=1`, proceed. If 0, skip this phase silently.

## Inert-artifact sweep (always runs when this phase proceeds)

A consumer whose omega was already migrated (`migrated_from_omega.state
=== 'complete'`, venv/hooks/MCP gone) can still carry inert omega files
that the teardown didn't remove. Remove them by exact name. This is
idempotent — `rm -f` no-ops when the file is absent, so it's safe to
run on every cc-upgrade:

```bash
rm -f .claude/hooks/omega-memory-guard.sh \
      .claude/hooks/domain-memories.sh \
      scripts/cabinet-memory-adapter.py \
      scripts/migrate-memory-to-omega.py
```

Report which files were actually removed (test before/after, or capture
`rm -v` output). Only remove these exact paths — do not glob or remove
anything else. If omega is still ACTIVE (conditions 1–4 above), run the
full migration flow below FIRST; the sweep cleans up what teardown
leaves behind, it does not replace migration.

Also strip stale omega permission entries from `.claude/settings.local.json`
if present. The migration cleans `~/.claude/settings.json` (global hooks/MCP)
but misses per-project permission allowlists:

```bash
if [ -f .claude/settings.local.json ]; then
  node -e "
    const fs = require('fs');
    const p = '.claude/settings.local.json';
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    const perms = d.permissions || {};
    let removed = 0;
    for (const key of Object.keys(perms)) {
      if (key.startsWith('mcp__omega-memory__') || key.startsWith('mcp__omega__')) {
        delete perms[key];
        removed++;
      }
    }
    if (removed > 0) {
      fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n');
      console.log('Removed ' + removed + ' stale omega permission entries from settings.local.json');
    }
  "
fi
```

Idempotent — no-ops when no omega entries exist.

## User-friendly prompt

Default to **dry-run** — a non-Oren user just upgrading CC shouldn't
be ambushed by destructive mutations. Lead with reassurance.

> CC's memory module is changing in v0.27.0.
>
> What you have now: omega-memory artifacts (Python venv at
> `~/.claude-cabinet/omega-venv/`, hooks in your global settings,
> MCP registrations, an OMEGA block in `~/.claude/CLAUDE.md`). The
> earlier memory module shipped these.
>
> What's replacing it: Claude Code's built-in memory at
> `~/.claude/projects/<slug>/memory/`. No Python, no daemon, no
> paywall. Your omega memories become markdown topic files
> indexed in MEMORY.md, plus per-file curated entries for what
> you capture going forward via `/cc-remember`.
>
> [1] Show me what would change (dry-run) — default
> [2] Migrate now (writes backup; reversible via `--unmigrate-memory`)
> [3] Skip — leave omega running for now (migrate later via
>     `npx create-claude-cabinet --migrate-memory`)

## Routing

### Default (Enter / option [1]): dry-run

Invoke:
```bash
npx create-claude-cabinet --migrate-memory --dry-run
```

Display the 10 steps that would execute. Then re-prompt:
**"Proceed with real migration now? (y/N)"**. Default is N — user
must affirmatively type y to proceed.

### Option [2]: migrate now

Invoke:
```bash
npx create-claude-cabinet --migrate-memory
```

On success, report:
- Backup location (from command output)
- Confirmation that `.ccrc.json.migrated_from_omega.state === 'complete'`
- The rollback command: `npx create-claude-cabinet --unmigrate-memory`

If the command exits non-zero, surface the error and DO NOT mark
cc-upgrade as complete — the user needs to know something went wrong.

### Option [3]: skip

Print a brief note:

> Skipping for now. Omega keeps running until you migrate. To
> migrate later: `npx create-claude-cabinet --migrate-memory`.
> Until then, omega and built-in memory may interleave —
> `omega-memory-guard` (if present) would block flat markdown
> writes if it weren't already removed by the installer.

## Reassurances to surface (especially for non-Oren users)

When asked or when the user hesitates:

- **"Your memories are not deleted."** Migration writes a backup,
  then rewrites your hooks/MCP/CLAUDE.md to point at the built-in
  path. The omega DB at `~/.omega/omega.db` is untouched until
  Phase 9.1's confidence-period cleanup (deferred-trigger gated).
- **"Other sessions will lose omega capture."** Other Claude Code
  sessions running on this machine during migration will silently
  lose omega capture for the rest of their lifetime. They keep
  working — already-loaded MCP tools and CLAUDE.md stay in their
  contexts — but new captures won't write to omega. Restart them
  after migration to fully move them to built-in.
- **"Rollback exists."** If anything goes wrong, run
  `npx create-claude-cabinet --unmigrate-memory` to restore
  everything from the backup. Topic files at the memory dir are
  preserved (delete manually if desired).
- **"This is a one-time migration."** v0.27.0+ doesn't ship a
  memory module. Future CC operations don't re-introduce omega.

## What this phase does NOT do

- Does not delete the omega DB or venv. Phase 9.1 handles that
  after a 2-4 week confidence period.
- Does not migrate sessions running in other Claude Code instances.
- Does not migrate other CC projects on the same machine — each
  consumer runs its own `--migrate-memory` (or invokes its own
  `cc-upgrade` to be prompted).
