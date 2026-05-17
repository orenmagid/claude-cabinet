# Extraction Proposal: Platform-as-a-Service MCP detection

## Source
- Project: flow (`~/flow`)
- Artifact: pattern extracted from session friction; no implementation exists yet
- Type: phase extension (orient skill) + new generic registry

## What It Does

When a project uses a PaaS like Railway, Vercel, Fly, or Netlify, the platform almost always ships its own MCP server (Railway: `railway setup agent -y` → installs to `~/.claude.json`; Vercel, Fly, Netlify ship analogous tooling). These MCP servers give Claude structured access to platform state — deploys, logs, build errors, env vars — instead of having to parse CLI text output, which is often opaque and inconsistent.

CC's orient skeleton already detects PaaS choice via filesystem artifacts (`railway.toml`, `fly.toml`, `vercel.json`, `netlify.toml`) for the "Deployment method detection" briefing line. The proposal is to extend that detection by one step: check whether the corresponding MCP server is configured in `~/.claude.json`, and if not, surface a soft suggestion to install it. Same pattern as the existing LSP plugin check.

## Why It's Generic

Every CC-consuming project that deploys to a PaaS hits this. The detection logic doesn't depend on project domain — it's filesystem signal → MCP registry lookup → optional advisory. The registry of "platform → MCP install command" is a stable, slowly-growing list (Railway, Vercel, Fly, Netlify today; Cloudflare Workers, Render, Supabase plausibly tomorrow).

The session that prompted this proposal burned ~1 hour debugging Railway deploy failures via opaque CLI errors ("connection reset by peer", "Deployment does not have an associated build"). The actual error — surfaced after installing Railway's MCP — was "Failed to create code snapshot. Please review your last commit, or try again." The MCP made this immediately visible. The lost hour was pure preventable friction.

The smell that triggered this proposal: the Railway CLI itself prompted "IMPORTANT: Railway agent tooling not detected. Ask the user if they would like this agent to run `railway setup agent -y`". The CLI is doing CC's job. CC has the detection plumbing already; it just doesn't connect the dots.

## Suggested Generalized Form

**Where it lives:** Extend orient's `phases/context.md` default behavior (the "Deployment method detection" block). The skeleton already runs the filesystem-signal check; the proposal adds a follow-up step in the same block.

**Suggested skeleton logic (pseudo-bash):**

```bash
# After existing PaaS detection:
case "$PLATFORM" in
  railway)
    MCP_KEY="railway"
    MCP_INSTALL="railway setup agent -y"
    ;;
  vercel)
    MCP_KEY="vercel"
    MCP_INSTALL="vercel mcp install"   # placeholder — verify Vercel's actual command
    ;;
  fly)
    MCP_KEY="flyctl"
    MCP_INSTALL="fly mcp install"      # placeholder
    ;;
  netlify)
    MCP_KEY="netlify"
    MCP_INSTALL="netlify mcp install"  # placeholder
    ;;
esac

# Check ~/.claude.json for the MCP entry
if [ -n "$MCP_KEY" ] && ! python3 -c "import json; d=json.load(open('$HOME/.claude.json')); exit(0 if any('$MCP_KEY' in k.lower() for k in d.get('mcpServers',{}).keys()) else 1)" 2>/dev/null; then
  echo "⚠ $PLATFORM detected but its MCP server not installed."
  echo "  Install for better deploy observability: $MCP_INSTALL"
fi
```

**Registry shape:** Either inline in the skeleton (small enough today, ~5 entries) or a separate `phases/platform-mcp-registry.json` that consuming projects can extend. Inline-first is fine; extract when the list grows past ~10.

**What becomes phase-file-configurable:**

- `phases/context.md` can override platform detection if a project uses a non-standard signal (e.g., custom Dockerfile patterns).
- Consuming projects with private/internal PaaS can append to the registry via a project-specific phase file.

**What's advisory, not blocking:** Same model as the existing LSP plugin check. The orient briefing surfaces the suggestion; the user decides whether to act. Don't auto-install.

## What Stays Project-Specific

Almost nothing. The whole detection-and-suggestion loop is generic. The only project-specific knowledge is "is this platform actually in use," which the filesystem signals already answer.

## Assessment

- **Generalizability:** strong — applies to any CC-consuming project that uses a PaaS, which is the modal CC consumer.
- **Maturity:** early — the *concept* is proven (the existing PaaS-detection code is mature, and Railway's MCP just demonstrated the value), but the MCP-suggestion step hasn't been implemented anywhere yet. Implementation would be ~30 lines added to one phase file plus a small registry.
- **Complexity:** low — one block of bash in `phases/context.md`, plus a registry. No new skills, no new hooks, no schema changes.

## Source Artifact Content

*No source artifact exists in the consuming project — this is a pattern extracted from session friction, not a working implementation being upstreamed.*

The relevant existing detection code (in CC's orient skeleton `phases/context.md`, "Deployment method detection" block) already does the first half of the work:

```
| Indicator | Platform | Deploy command |
|---|---|---|
| railway.toml | Railway | railway up --detach |
| fly.toml | Fly.io | fly deploy |
| vercel.json or .vercel/ | Vercel | vercel --prod |
| netlify.toml | Netlify | netlify deploy --prod |
```

The proposed extension converts this into a (platform → MCP install command) map alongside (platform → deploy command), and adds a presence check against `~/.claude.json`.

## Note on cc-extract link detection

This proposal was filed by writing directly to `~/claude-cabinet/proposals/` after confirming the directory exists. The skill's stated `require.resolve('create-claude-cabinet')` check would have classified CC as "not linked" (CC is globally installed at `/opt/homebrew/lib/node_modules/create-claude-cabinet` with no `main` entry point) and routed me to the GitHub-issue fallback. The filesystem signal at `~/claude-cabinet/proposals/` is the correct primary check. Filed as separate `/cc-feedback` on 2026-05-14.
