---
name: handoff-create
description: |
  Build a handoff checklist conversationally. Interviews the consultant
  about what the client needs to provide, generates the YAML and keypair.
  Use when: "handoff create", "/handoff-create", "create a handoff",
  "build a checklist for the client", "set up handoff".
manual: true
---

# /handoff-create — Build a Handoff Checklist

## Purpose

Interview the consultant to build the `handoff.yaml` checklist that
drives the client's `/handoff` experience. Generates the keypair for
credential encryption. This is where engagement-specific configuration
gets created.

## Workflow

### 1. Gather Basics

Ask one question at a time:

1. "Who's the client? What's their name and email?"
2. "What's this handoff for?" (becomes `meta.title`)
3. "What transport should we use? Email is the default — it works
   with Gmail, Outlook, or any email MCP. Or file-based if you'll
   transfer manually." (becomes `transport.type`)
4. "What's your email for receiving handoff items?" (consultant email)

### 2. Build Sections

"What categories of items does the client need to provide? For example:
Hosting, Email Service, Domain, Analytics..."

For each section:
1. "What does the client need to provide for [section]?"
2. For each item, determine:
   - **Kind:** Is this a decision (choose from options), a credential
     (API key, token, password), free-text information, or a
     confirmation (yes/no)?
   - **Prompt:** What should Claude ask the client?
   - **Help text:** Where can the client find this? (optional)
   - **Options:** If it's a decision, what are the choices?
   - **Visibility:** "Does this item depend on a prior answer?"
     If yes, which item and which value(s) make it visible?
3. "Any more items in [section]? Or ready for the next section?"

### 3. Validate

Run validation on the constructed checklist:
- Cycle detection on visibility graph
- Orphan dependency check (depends_on references a non-existent key)
- Duplicate key detection

If issues found, surface them and help the consultant fix them
interactively.

### 4. Generate

1. Write `handoff.yaml` to the project root
2. Check if `keys/consultant.pub.jwk` exists. If not, generate a
   keypair:

   ```bash
   node .claude/handoff/generate-keys.mjs
   ```

   A secure OS dialog will prompt the consultant for a passphrase
   (never enters conversation). Explain: "A dialog will appear — create
   a passphrase to protect your private key. You'll need it when
   retrieving credentials via `/handoff-status`."

3. Show summary:
   ```
   Checklist: "Maginnis Go-Live Credentials"
   Sections: 4 | Items: 12 (3 credentials, 5 decisions, 4 info)
   Transport: email
   Public key: keys/consultant.pub.jwk
   ```

### 5. Deploy to Client Plugin

Auto-detect the client plugin by scanning for `*/.claude-plugin/plugin.json`
from the project root (one level deep). If multiple plugins found, ask
which one. Always run this scan from the project root directory.

If a plugin is found:

1. Create a `handoff/` directory inside the plugin root (sibling to
   `.claude-plugin/`, `skills/`, etc.):
   ```
   <plugin-root>/handoff/handoff.yaml
   <plugin-root>/handoff/consultant.pub.jwk
   ```

2. **Rewrite `meta.public_key`** in the deployed `handoff.yaml` copy.
   The original says `./keys/consultant.pub.jwk` (relative to the
   consultant's project). The deployed copy must say
   `./consultant.pub.jwk` (relative to the deployed `handoff/`
   directory where the key file now lives). Read the deployed YAML,
   update the path, write it back.

3. Create a `/handoff` skill in the plugin's `skills/` directory.
   This skill tells the client's Claude exactly where the config is
   using a path relative to the skill file itself — this works
   regardless of where Claude Code installs the plugin on the client's
   machine:

   **Write to `<plugin-root>/skills/handoff/SKILL.md`:**
   ```markdown
   ---
   name: handoff
   description: |
     Provide go-live credentials and configuration for your consultant.
     Credentials are captured via a secure dialog — they never enter
     this conversation or reach Anthropic's servers.
     Use when: "handoff", "/handoff", "provide credentials".
   manual: true
   ---

   # /handoff — Provide Your Credentials

   This plugin bundles a handoff checklist from your consultant.

   ## Locating the config

   This skill file lives at `skills/handoff/SKILL.md` within the
   plugin. The handoff config is two levels up in the `handoff/`
   directory:

   - Checklist: `../../handoff/handoff.yaml` (relative to this file)
   - Public key: `../../handoff/consultant.pub.jwk` (relative to this file)

   To get the absolute paths: take this skill file's absolute path,
   go up two directories, then into `handoff/`.

   ## What to do

   1. Resolve the absolute path to `handoff.yaml` as described above.
   2. Follow the `/handoff` skill workflow (from the project's CC
      installation) using that path as the config location.
   3. Read and write `handoff-state.json` in the same directory as
      `handoff.yaml` (the plugin's `handoff/` directory).
   ```

4. Confirm: "Deployed to [plugin-name]. When the client installs the
   plugin and runs `/handoff`, everything is ready."

If no plugin found:

Surface the manual steps:
```
No client plugin found in this project. To deploy manually:
1. Create a handoff/ directory in the client's plugin
2. Copy handoff.yaml into it (update meta.public_key to ./consultant.pub.jwk)
3. Copy keys/consultant.pub.jwk as handoff/consultant.pub.jwk
4. Add a /handoff skill to the plugin's skills/ directory (see schema.md)
```
