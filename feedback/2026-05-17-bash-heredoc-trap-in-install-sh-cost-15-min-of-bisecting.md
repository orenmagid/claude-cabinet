---
type: field-feedback
source: claude-cabinet (dogfood)
date: 2026-05-17
component: templates/skills/verify/install.sh (and any install.sh using $(cat <<'X' ... X))
---

## Bash `$(cat <<'TS' ... TS )` heredoc trap in install.sh template

**Friction:** Editing the `AUTH_TS` heredoc in
`templates/skills/verify/install.sh` triggered `bash -n` failures
that took ~15 minutes to bisect. The error message
(`unexpected EOF while looking for matching ` `` or `'`) points at
unrelated lines — including the closing `})` of the PREFLIGHT_TS
heredoc several blocks below — making the actual cause invisible.

Root cause: bash's `$(...)` parser pre-tokenizes the entire
substitution body to find the matching `)`. Even when a heredoc
inside `$()` uses a **quoted** delimiter (`<<'TS'`), bash still
counts apostrophes and backticks inside the heredoc body, looking
for matching pairs. An odd-count apostrophe in a comment (e.g.,
`// your project's sign-in flow`) or an unpaired backtick in a
markdown-fence rendering opens a quote/cmd-sub context bash never
closes — and the error fires at the END of the file (or the next
heredoc), not at the actual offending character.

This is documented bash behavior, not a bug — but it's a tripwire
for anyone editing the heredoc-heavy install.sh templates. The
pre-existing `AUTH_TS` happened to have 8 backticks and 16
apostrophes (both even) outside cmd-sub contexts; my edit knocked
the apostrophe count to 15 (odd) by deleting an `if (!email...)`
block and bash refused to parse, but the error message pointed at a
template-literal in PREFLIGHT_TS 40 lines later.

**Cost:** ~15 minutes of bisecting per occurrence. Will recur for
the next contributor editing these heredocs (act:8c31f99a also hit
it twice during this session, in both START_TEST_STACK and
README_MD heredocs — used unquoted delimiters there but the
apostrophe issue still triggered).

**Suggestion:** Three options, in increasing order of intrusiveness:

1. **Comment at the top of install.sh.** A leading "If you're
   editing these heredocs, note that bash counts apostrophes and
   backticks inside `$(cat <<'X' ... X)` bodies even with a quoted
   delimiter. Even-count both." 5-line comment block, costs nothing,
   surfaces the tripwire for anyone reading the file top-to-bottom
   before editing.

2. **A pre-commit hook on `templates/**/install.sh`** that runs
   `bash -n` and rejects the commit if syntax fails. The error
   message is bad but at least it surfaces at commit time instead
   of install-time.

3. **Refactor away from `$(cat <<'X')` toward `read -r -d '' VAR <<'X'`
   or direct `cat > file <<'X'`.** Both patterns sidestep the `$()`
   tokenizer. Cost: re-shaping `plan_write` (which takes a content
   string today). Option 3 is the principled fix but the most code
   to touch.

Option 1 alone would have saved today's 15 minutes. Recommend
shipping that immediately and reserving Options 2–3 for if the
issue recurs.

**Session context:** act:28b23fb7 (move 5 baseline steps into
cabinet-verify) edited AUTH_TS to add a `setSignInHandler(signInAs)`
registration and remove the env-check stub. Initial edits broke
bash -n. Bisected through V1–V7 minimal-repros before realizing the
issue was apostrophe parity in heredoc bodies. Captured in
`act:28b23fb7`'s breadcrumb and as omega memory `mem-615d5b80`,
but those are post-hoc — a contributor reading install.sh fresh
won't find them. The leading comment is what would actually
prevent the next occurrence.
