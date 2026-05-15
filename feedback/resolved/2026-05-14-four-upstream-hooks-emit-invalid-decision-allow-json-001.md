**Friction:** Four CC-managed hooks emit `{"decision":"allow"}` on their non-blocking path, but `"allow"` is not a valid value for the root `decision` field per Claude Code's PreToolUse hook output schema (valid values are `"approve"` or `"block"`; the new schema uses `hookSpecificOutput.permissionDecision: "allow"|"deny"|"ask"`). Every tool call that hits these hooks surfaces a warning:

```
PreToolUse:Bash hook error
Hook JSON output validation failed — (root): Invalid input
```

Bash calls get the warning twice because two Bash-matched hooks (`git-guardrails.sh`, `work-tracker-guard.sh`) both emit the bad shape. Edit/Write calls get it from `omega-memory-guard.sh` and `cc-upstream-guard.sh` (and `domain-memories.sh` doesn't have this bug because it just prints memories to stderr and exits without JSON).

Affected files (all in `.ccrc.json` manifest, all on CC v0.24.0):
- `.claude/hooks/git-guardrails.sh` — bad JSON in three places (lines ~21, ~33, end-of-function)
- `.claude/hooks/work-tracker-guard.sh` — bad JSON in two places
- `.claude/hooks/omega-memory-guard.sh` — bad JSON on the "no adapter" path
- `.claude/hooks/cc-upstream-guard.sh` — bad JSON on the "not in manifest" path

The hooks still functionally do the right thing because Claude Code defaults to allowing the tool call when the hook output is rejected. But the warning lines clutter every transcript and obscure real hook failures when they happen.

**Suggestion:** On the allow-branch, either:
1. Just `exit 0` with empty stdout (allow is the default), or
2. Emit `{"continue": true}`, or
3. Emit `{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow"}}` for the new schema.

Option 1 is the simplest and avoids the schema-versioning question. Option 3 is the most future-proof.

The `"decision":"allow"` value was probably introduced when the schema was unclear or when an older draft accepted `"allow"`. It's plausible all four hooks were written against the same incorrect mental model — they all use the same pattern. Worth grepping the CC codebase for `"decision":"allow"` to catch any others.

**Session context:** Surfaced during a /orient-quick on flow project (CC v0.24.0). User confirmed via Claude Code output: warnings appear on every Bash call. cc-upstream-guard's own broken JSON means it would block me from patching the hooks locally even if I wanted to, which is a nice closed loop — the only correct fix is upstream.
