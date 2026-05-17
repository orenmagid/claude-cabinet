## cc-extract link detection: require.resolve check misses globally-installed CC

**Skill/phase:** `.claude/skills/cc-extract/SKILL.md`, step 4 ("File Proposals")

**Friction:** The skill instructs Claude to check `node -e "console.log(require.resolve('create-claude-cabinet'))"` to decide whether CC is locally linked. On my machine, CC is globally installed at `/opt/homebrew/lib/node_modules/create-claude-cabinet` (npm global install, bin-only — no `main` entry point, so `require.resolve` returns NOT_RESOLVABLE), but the source repo is also present at the canonical `~/claude-cabinet/` path with a populated `proposals/` directory (where the prior cabinet-deployment proposal lives). The require.resolve check incorrectly classified CC as "not linked" and would have sent me to the GitHub-issue fallback. User had to correct me: "CC is linked locally, dude!" The canonical filesystem path is the right signal, not Node's resolver.

**Suggestion:** Replace the require.resolve check with a filesystem check first:
1. Check if `~/claude-cabinet/proposals/` exists (or read CC source path from `~/.claude/cc-registry.json`). Use that as the primary signal.
2. Fall back to require.resolve only if the registry/canonical path is absent.
3. Or simpler: skip the link-detection branch entirely and always write to `~/claude-cabinet/proposals/` when the registry has a CC entry — the GitHub-issue fallback is only needed when CC isn't on the machine at all.

The require.resolve check works for projects that have `create-claude-cabinet` as a node_modules dep (e.g., when CC is the dev-time dep of itself), but globally-installed CC is the common shape and gets misidentified.

**Session context:** I was filing a cabinet-verify extraction proposal (e2e walkthrough verification harness → /verify skeleton skill + @claude-cabinet/verify runtime + plan/execute hooks). The proposal landed at `~/claude-cabinet/proposals/article-rewriter-cabinet-verify.md` and was committed as `f3b3f6f` on the CC main branch, alongside the prior `article-rewriter-cabinet-deployment.md`. The proposal itself filed fine because I noticed the dir existed despite the failed require.resolve — but a less attentive session would have followed the skill's instructions and filed a GitHub issue instead, splitting where proposals live.
