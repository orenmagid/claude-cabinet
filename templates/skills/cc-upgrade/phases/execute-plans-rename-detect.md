# execute-plans → generate-plan-groups rename detection

In the plan→parallel-execution split, the all-in-one `/execute-plans`
skill was divided into `/generate-plan-groups` (scheduler) and
`/execute-group` (runner). The installer's manifest-key migration re-keys
the tracked files for hash continuity, but it does **not** delete the old
`.claude/skills/execute-plans/` directory on disk — the cleanup loop
classifies it as a non-template file and keeps it. So after a mechanical
upgrade, a project that had `execute-plans` ends up with the orphan
directory still present, and `/execute-plans` muscle-memory keeps invoking
the old checkpoint-dropping skill.

This phase detects and removes that orphan.

## Detection

This phase proceeds only if the orphan directory is actually on disk:

```bash
test -d .claude/skills/execute-plans && echo "HAS_ORPHAN=1"
```

If the directory is absent (fresh install, or already cleaned), skip this
phase silently — say nothing.

## What to explain to the user

When the orphan is present, explain the rename in plain terms:

> `/execute-plans` has been split into two skills:
> - **`/generate-plan-groups`** — finds plans that can run in parallel and
>   tags them into conflict-free groups (the old Steps 1–4).
> - **`/execute-group <label>`** — runs one group: worktree implementation
>   *plus* cabinet checkpoints (which the old skill claimed to run but
>   couldn't, because worktree agents can't spawn reviewers).
>
> Both new skills are now installed. The old `execute-plans/` directory is
> left over from before the rename and should be removed so `/execute-plans`
> stops resolving to the obsolete skill.

## Removal

The orphan is only safe to remove once its **direct replacement** —
`generate-plan-groups` (the renamed scheduler half) — is on disk. The
runner half, `execute-group`, may or may not be present (it ships in a
later piece / may be deselected); its absence must NOT block removal,
because the scheduler is the rename of the old skill. This single guard
covers both cases:

```bash
if [ -f .claude/skills/generate-plan-groups/SKILL.md ]; then
  rm -rf .claude/skills/execute-plans
  echo "Removed orphaned .claude/skills/execute-plans/"
  if [ ! -f .claude/skills/execute-group/SKILL.md ]; then
    echo "Note: /execute-group (the runner) is not installed — /generate-plan-groups"
    echo "persists groups; add the runner to execute them, or run /execute per plan."
  fi
else
  echo "WARN: generate-plan-groups not found — leaving execute-plans/ in place"
fi
```

Never remove the orphan if `generate-plan-groups/SKILL.md` is absent —
that would delete the only copy of the scheduler logic.

## Persisted-group note

If the project has actions tagged with `grp:` tokens (from a prior
`/generate-plan-groups` run), those tags remain valid — they reference
plans, not the skill directory. No migration of tags is needed.

## What this phase does NOT do

- It does not rewrite historical pib-db actions that mention
  `execute-plans` in their notes — that's history, left as-is.
- It does not touch the skill index (`_index.json`) — the installer
  regenerates that from the installed skills on every run.
