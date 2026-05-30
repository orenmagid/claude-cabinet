# Plan: Skill-Based Handoff — CC Module

> Supersedes the standalone Handoff/Packet service (`prj:e104930c`,
> `.claude/plans/packet-standalone.md`). Two rounds of cabinet analysis
> (architecture, security, anti-confirmation, user-advocate) concluded:
> skill-first is the right architecture when the client already has Claude
> Code installed. The standalone hosted service is deferred until a
> non-CC client needs it.

## Problem

Consulting engagements need secure credential handoff and structured
checklist collection from clients. The original Handoff plan proposed a
full Rails + Postgres + Railway service (~60 files, 8 phases, 6 pending
decisions). But when the client already uses Claude Code with a plugin
installed, the plugin IS the interface — a separate web app adds friction
and infrastructure burden for no UX gain.

The cabinet found: Claude does progressive disclosure *better* than a
form ("You said Railway — great, I'll need three things..."), threaded
Q&A is Claude's native capability, and credentials captured via OS-level
dialogs have a *smaller* attack surface than a hosted service (no server
to compromise, no first-view-delete race conditions, no link-preview
URL burning).

Three design problems identified by anti-confirmation that this plan
must solve: (1) transport mechanism, (2) cross-platform secure input,
(3) checklist definition format.

## Approach

A new `handoff` CC module (opt-in, `lean: false`) shipping:

- **Checklist definition format** — YAML that drives the conversation:
  items with types, dependencies, and credential flags
- **Six skills** across both sides of the engagement:
  - `/handoff` (client) — walk through the checklist conversationally
  - `/handoff-progress` (client) — check progress + see consultant messages
  - `/handoff-ask` (either side) — send a free-text message to the other party
  - `/handoff-create` (consultant) — build the checklist YAML conversationally
  - `/handoff-add` (consultant) — amend the checklist mid-flight
  - `/handoff-status` (consultant) — progress dashboard + credential retrieval
- **Capture-and-encrypt primitive** — cross-platform OS dialog that
  captures a credential, encrypts it in-process, and returns only the
  sealed envelope. Plaintext never exits the child process, never
  enters Claude's context window or Anthropic's API.
- **Crypto utilities** — RSA-OAEP key generation + AES-GCM envelope
  encryption (same Web Crypto approach from the Packet plan, but
  client-side only — no server)
- **Pluggable transport** — how encrypted payloads move from client to
  consultant. Three built-in transports: `mcp` (call an existing MCP
  tool), `email` (via Gmail MCP), `file` (local write for manual
  transfer)

The consultant's public key ships with the client plugin. Only the
consultant's private key can decrypt — the client's machine, Claude's
context, and Anthropic's API never see plaintext credentials.

### Three-Layer Architecture

This module introduces a new CC pattern: **CC → consultant → client**.

| Layer | Provides | Example |
|-------|----------|---------|
| **CC (upstream)** | Engine: skills, crypto, transport, checklist schema | `/handoff` skill, `capture-and-encrypt.mjs` |
| **Consultant project (midstream)** | Configuration: the specific checklist, keypair, transport choice | `handoff.yaml` with 12 Maginnis items |
| **Client plugin (downstream)** | Distribution: packages the config for the client | Plugin ships checklist YAML + public key |

The plugin is thin — it's configuration, not code. The `/handoff` skill
engine comes from CC's module (installed on the client's machine). The
plugin just says "here's what to collect and where to send it."

This pattern may apply to other consulting capabilities beyond handoff.
Document as a first-class CC composition pattern after Maginnis
validates it.

**Concrete flow for a new engagement:**

1. **Consultant** installs CC with the handoff module on their project
   (`npx create-claude-cabinet --modules handoff`)
2. **Consultant** runs `/handoff-create` → interviews them → generates
   `handoff.yaml` + keypair. The YAML names both parties' emails.
3. **Consultant** copies `handoff.yaml` + `consultant.pub.jwk` into
   the client plugin directory (alongside the plugin's existing skills
   and MCP server)
4. **Client** installs the plugin (already happening — e.g., the
   maginnis-howard plugin). The plugin ships the checklist + public key.
5. **Client** installs CC with the handoff module on their project
   (already done for Maginnis — Ed has CC installed)
6. **Client** runs `/handoff` → Claude walks them through the checklist
7. **Both sides** use `/handoff-ask` for ad-hoc questions, `/handoff-add`
   for new items, and their respective status skills to check progress
8. Email carries everything — notifications, answers, credentials,
   messages

## Implementation

### Phase 0 — Checklist Definition Format

Define the YAML schema that drives structured collection. This is the
contract between consultant (who defines the checklist) and the
`/handoff` skill (which reads it).

```yaml
# handoff.yaml — placed in the client's project by the plugin
meta:
  title: "Maginnis Go-Live Credentials"
  consultant: "Oren Magid"
  public_key: "./keys/consultant.pub.jwk"

transport:
  type: email                    # or: mcp, file
  consultant: "oren.michael.magid@gmail.com"  # client sends here
  client: "ed@maginnishoward.com"             # consultant sends here
  # email transport auto-detects provider: Gmail MCP, Outlook MCP, or
  # any future email MCP. Falls back to file transport if no email MCP
  # is connected.

sections:
  - key: hosting
    title: "Hosting Setup"
    items:
      - key: hosting_provider
        prompt: "Which hosting provider are you using?"
        kind: decide             # decide | provide | confirm | credential
        options: [Railway, Vercel, Fly.io, Other]

      - key: railway_token
        prompt: "Your Railway API token"
        kind: credential
        help: "Find this at railway.app → Account Settings → Tokens"
        visibility:
          depends_on: hosting_provider
          value_in: [Railway]

  - key: email
    title: "Email Service"
    items:
      - key: postmark_token
        prompt: "Your Postmark server API token"
        kind: credential
        help: "Find this in your Postmark server → API Tokens tab"
```

**Item kinds:**
- `decide` — choose from options (answers drive visibility of other items)
- `provide` — free-text answer (not sensitive)
- `confirm` — yes/no acknowledgment
- `credential` — sensitive value captured via OS dialog, encrypted,
  never in conversation context

**Visibility rules:** An item with `visibility.depends_on` is hidden
until the referenced item has an answer matching `value_in`. Transitive:
if B depends on A and C depends on B, hiding A hides both B and C.

**Cycle detection:** At checklist load time (before any conversation),
run topological sort on the visibility dependency graph. Reject the
checklist with a clear error if a cycle exists. Never attempt to
resolve circular dependencies at runtime.

**State file** (`handoff-state.json`, gitignored):

```json
{
  "checklist": "handoff.yaml",
  "started_at": "2026-05-30T12:00:00Z",
  "updated_at": "2026-05-30T12:30:00Z",
  "answers": {
    "hosting_provider": {
      "value": "Railway",
      "answered_at": "2026-05-30T12:05:00Z"
    },
    "railway_token": {
      "status": "sent",
      "envelope_id": "env_abc123",
      "sent_at": "2026-05-30T12:10:00Z"
    }
  }
}
```

Credential items store `status` + `envelope_id`, never the plaintext
value. Non-credential answers store the value directly (hosting choice
isn't a secret).

**File:** `templates/handoff/schema.md` documents the format.
**File:** `templates/handoff/example-checklist.yaml` ships as a starter.

### Phase 1 — Capture-and-Encrypt Primitive

**Critical security design (from cabinet security critique):** The Bash
tool returns subprocess stdout to Claude's context window. If capture
and encrypt were separate steps, the plaintext credential would appear
in the Bash tool result and hit Anthropic's API. Therefore, capture and
encryption MUST happen in a single subprocess — the plaintext never
exits the child process.

**File:** `templates/handoff/capture-and-encrypt.mjs`

This script:
1. Opens a cross-platform OS dialog with hidden input
2. Captures the credential value in-process (never on stdout)
3. Reads the public key from the path specified in args
4. Encrypts immediately using AES-GCM + RSA-OAEP key wrapping
5. Outputs ONLY the serialized envelope (base64) to stdout
6. The plaintext credential is garbage-collected — it never leaves
   this process

Cross-platform dialog support:
- **macOS:** `osascript` with `with hidden answer` (prompt strings
  escaped via `escapeAppleScript()` to prevent shell injection)
- **Linux:** `zenity --password` → fallback `read -s` in terminal
- **Windows:** PowerShell `Read-Host -AsSecureString`

Error handling:
- **Dialog cancelled** (user clicks Cancel): exit with code 2 and
  a JSON error `{"error": "cancelled"}`. The skill detects this and
  re-prompts or skips.
- **Dialog not available** (no zenity, no GUI): exit with code 3 and
  `{"error": "no_dialog", "platform": "linux"}`. The skill falls back
  to `read -s` terminal mode.
- **Encryption failure** (bad public key): exit with code 4 and
  `{"error": "encrypt_failed", "detail": "..."}`.

**Usage by the skill:**
```bash
node .claude/handoff/capture-and-encrypt.mjs \
  --prompt "Your Railway API token" \
  --public-key ./keys/consultant.pub.jwk
# stdout: base64-encoded envelope (ciphertext only — never plaintext)
```

**File:** `templates/handoff/secure-input.mjs` — the platform-detection
and dialog invocation logic, imported by `capture-and-encrypt.mjs`.
Exported separately for the consultant's passphrase entry in
`/handoff-status` (where the value is a passphrase used in-process
for key decryption, not transported).

### Phase 2 — Crypto Utilities

RSA-OAEP keypair for asymmetric encryption. The consultant generates
a keypair once; the public key ships with the client's plugin. Each
credential is encrypted with a random AES-GCM key, and the AES key
is wrapped with the consultant's RSA public key. Standard hybrid
encryption.

**File:** `templates/handoff/handoff-crypto.mjs`

Functions:
- `generateKeypair()` → `{ publicKey: JWK, privateKey: JWK }`
  Consultant runs once. Private key saved locally (encrypted with
  passphrase via PBKDF2). Public key exported for plugin distribution.
- `encryptCredential(plaintext, publicKeyJWK)` → `{ ciphertext, iv,
  wrappedKey, envelope_id }` — AES-GCM encrypt, RSA-OAEP wrap the
  AES key.
- `decryptCredential(envelope, privateKeyJWK)` → plaintext — unwrap
  AES key, decrypt ciphertext.
- `serializeEnvelope(envelope)` → base64 string (for transport)
- `deserializeEnvelope(base64)` → envelope object

All via Node's `crypto.subtle` (Web Crypto API). No external
dependencies.

**File:** `templates/handoff/generate-keys.mjs` — CLI script the
consultant runs once: `node generate-keys.mjs --passphrase "..."`.
Writes `keys/consultant.priv.jwk.enc` and `keys/consultant.pub.jwk`.

### Phase 3 — Transport Layer

Pluggable dispatch for moving encrypted payloads from client to
consultant. The transport type is declared in the checklist YAML.

**File:** `templates/handoff/handoff-transport.mjs`

Three built-in transports:

**`email`** — Provider-agnostic email transport. Auto-detects which
email MCP server is connected (Gmail, Outlook/Microsoft 365, or any
future email MCP that exposes send/search capabilities) and dispatches
through it. Sends an email (not draft) with the encrypted envelope as
the body (base64). Subject uses only a reference ID:
`[Handoff] env_<envelope_id>` — no item keys or credential type names
in the subject (metadata leakage risk from security critique). The
consultant's `/handoff-status` skill searches for `[Handoff]` subjects
and retrieves envelopes by ID.

Detection order: scan available MCP tools for email-send capability
(Gmail `create_draft`+`send` / Outlook equivalent / generic). If no
email MCP is found, **automatically falls back to `file` transport**
with a warning: "No email MCP connected — credentials written locally.
Transfer manually or connect an email MCP server."
- Pros: zero infrastructure, works across any engagement, auditable,
  provider-agnostic (Gmail, Outlook, etc.)
- Cons: requires some email MCP connected on both sides (degrades to
  file if absent)

**`mcp`** — Calls an existing MCP tool to POST the encrypted payload.
Config specifies the tool name and parameter mapping. Works with any
API-wrapping MCP server (like the Maginnis platform server).
- Pros: uses existing infrastructure, real-time
- Cons: requires a receiving endpoint on some hosted service

**`file`** — Writes encrypted envelopes to a local directory
(`./handoff-out/<envelope_id>.enc`). The consultant retrieves files
manually (e.g., shared folder, airdrop, USB, email attachment). Also
serves as the automatic fallback when `email` transport is selected but
no email MCP server is connected.
- Pros: zero infrastructure, zero dependencies
- Cons: manual transfer step, no confirmation of delivery

Each transport function: `send(envelope, config)` → `{ delivered: bool,
ref: string }`. The ref is stored in the state file as `envelope_id`.

### Phase 4 — Bidirectional Email Sync

Email is both the transport and the notification channel. When something
happens on one side, an email goes to the other side. The email IS the
notification — you see it in your inbox. The email body is structured
JSON the receiving skill can parse; the subject is human-readable.

**Payload types** (all travel as `[Handoff] <summary>` emails):

| Type | Direction | Subject example | Body |
|------|-----------|-----------------|------|
| `credential` | client → consultant | `[Handoff] env_a1b2c3` | Encrypted envelope (base64) |
| `session_summary` | client → consultant | `[Handoff] Ed completed 3 items` | JSON: answers from this session |
| `question` | either direction | `[Handoff] Question from Ed` | Free-text message |
| `checklist_update` | consultant → client | `[Handoff] 2 new items added` | Updated YAML diff or full YAML |
| `note` | consultant → client | `[Handoff] Note from Oren` | Free-text message |

**Credential emails** use a generic subject with only the envelope ID
(no item keys or credential type names — metadata leakage risk from
security critique). All other email types can be descriptive.

**Session batching:** During a `/handoff` session, answers accumulate
locally. At the end of the session (or on explicit send), one
`session_summary` email goes out with all non-credential answers.
Credential envelopes are individual emails (security isolation).

**Incoming mail processing:** When either side runs their skill, it
checks the connected email MCP (Gmail, Outlook, etc.) for incoming
`[Handoff]` emails, processes them (applies updates, shows messages),
then continues with the main workflow. If no email MCP is connected,
incoming mail processing is skipped with an advisory — the user can
still receive payloads via file transport.

### Phase 5 — Client-Side Skills

#### `/handoff` — Walk through the checklist

**File:** `templates/skills/handoff/SKILL.md`

Workflow:
1. Read `handoff.yaml` from the project root (or path from args).
   **Guard:** If missing, surface "No handoff.yaml found — has the
   plugin been installed?" If malformed, validate schema immediately
   and surface specific errors before conversation starts. Run cycle
   detection on visibility graph. Validate `meta.public_key` path
   exists — a missing key file would only surface on the first
   credential item, which is too late.
2. Read `handoff-state.json` if it exists (resume mode). **Guard:**
   Validate state file schema on load. If corrupt, offer "start fresh"
   vs "show me what's broken" — never silently skip items.
3. **Terminal state check:** If all items are complete/sent, warn:
   "This checklist was completed on [date]. Re-running will send
   duplicate credentials. Continue?" Do not silently re-prompt.
4. Show progress summary: "You've completed 7 of 12 items. Let's
   pick up with Postmark."
5. Walk through sections in order. For each visible item:
   - `decide`: Present options conversationally. Record answer. After
     answering, re-evaluate visibility — new items may appear. Tell
     the client: "Great, since you chose Railway, I'll need a few
     things from you for that..."
   - `provide`: Ask for the value. Record in state.
   - `confirm`: Ask yes/no. Record in state.
   - `credential`: Explain what's needed. Show `help` text if present.
     Invoke `capture-and-encrypt.mjs` via Bash (returns only the
     sealed envelope — plaintext never in Claude's context). Send
     envelope via transport. **On transport failure:** write
     `status: "send_failed"` + serialized envelope to state so retry
     is possible without re-prompting the client. **On dialog cancel:**
     skip item, note in state, continue to next item. Record
     `status: sent` + `envelope_id` in state on success. Tell the
     client: "Got it — encrypted and sent. I never saw the value."
6. Save state after every answer (atomic write: tmp + rename)
7. On completion: "All done! 12 of 12 items complete. Oren will be
   notified."

**Key behavioral rules for the skill:**
- Never echo or reference a credential value in conversation
- Never store credential values in the state file
- If the client asks where to find something, teach them (this is
  Claude's advantage over a form)
- If the client needs to leave and come back, reassure them progress
  is saved
- Show a progress table at the start and end of each section

#### `/handoff-progress` — Check progress without re-entering the flow

**File:** `templates/skills/handoff-progress/SKILL.md`

Lightweight status check for the client. Reads the state file and
incoming consultant messages without starting the full checklist walk.

Workflow:
1. Read `handoff-state.json` and `handoff.yaml`
2. Check Gmail for incoming `[Handoff]` emails from consultant
   (notes, checklist updates). Process and display any new messages.
3. Show progress table: items completed, items pending, items blocked
4. If new items were added by the consultant, highlight them:
   "Oren added 2 new items since your last session."
5. Offer: "Ready to continue? Run `/handoff` to pick up where you
   left off."

### Phase 6 — Consultant-Side Skills

#### `/handoff-create` — Build the checklist conversationally

**File:** `templates/skills/handoff-create/SKILL.md`

Interviews the consultant to build the checklist YAML, rather than
writing YAML by hand. This is where the engagement-specific
configuration gets created.

Workflow:
1. "Who's the client contact? What's their email?"
2. "What's this handoff for?" (title)
3. "What sections should the checklist have?" (group related items)
4. For each section: "What does the client need to provide?"
   - For each item: kind (decision, credential, free-text, confirm),
     prompt text, help text, options if applicable
   - "Does this item depend on a prior answer?" (visibility rules)
5. Validate: run cycle detection, check for orphan dependencies
6. Generate `handoff.yaml` and write to the project
7. Generate consultant keypair if none exists (`generate-keys.mjs`)
8. Show summary: "Checklist with N items across M sections. N
   credentials, N decisions. Transport: email."

#### `/handoff-add` — Amend the checklist mid-flight

**File:** `templates/skills/handoff-add/SKILL.md`

Adds items to an existing checklist after the client has already
started. Preserves existing state — new items appear as "not started."

Workflow:
1. Read existing `handoff.yaml` and current state
2. Interview: "What do you need to add?" (same item-creation flow
   as `/handoff-create` step 4)
3. Append to the YAML, re-validate (cycle detection)
4. Send the updated checklist to the client via transport
   (`checklist_update` email). Next time the client runs `/handoff`
   or `/handoff-progress`, new items appear.

#### `/handoff-status` — Progress dashboard + credential retrieval

**File:** `templates/skills/handoff-status/SKILL.md`

Glanceability for the consultant.

Workflow:
1. Check Gmail for incoming `[Handoff]` emails from the client.
   Process: `session_summary` → update local progress view,
   `credential` → queue for decryption, `question` → display.
2. For each active handoff, show progress table:
   ```
   ## Maginnis Go-Live (7/12 complete)

   ### Hosting Setup
   [x] hosting_provider: Railway
   [x] railway_token: sent (env_abc123) — decrypt?
   [ ] railway_project_id: waiting (depends: hosting_provider ✓)

   ### Email Service
   [ ] postmark_token: not started

   ### Messages
   - Ed (12:30): "Where do I find the GTM container ID?"
   ```
3. On request, retrieve and decrypt a credential:
   - Search Gmail for the envelope by ID, extract base64 body
   - Prompt for private key passphrase (via `secure-input.mjs` —
     OS dialog, passphrase never in context). **On wrong passphrase:**
     catch error, surface "Wrong passphrase — try again" with retry.
   - Display the decrypted value once, then clear

#### `/handoff-ask` — Send a message to the other side

**File:** `templates/skills/handoff-ask/SKILL.md`

Works for both consultant and client. Sends a free-text message via
the email transport.

Workflow:
1. "What do you want to say?"
2. Send as a `question` or `note` email to the other party
3. Confirm: "Message sent to [name]."

### Phase 7 — CC Module Wiring

**File:** `lib/cli.js` — add `handoff` to MODULES:
```javascript
handoff: {
  label: 'Handoff',
  description: 'Skill-based credential handoff for consulting engagements',
  default: false,
  lean: false,
  templates: [
    'templates/skills/handoff/SKILL.md',
    'templates/skills/handoff-progress/SKILL.md',
    'templates/skills/handoff-ask/SKILL.md',
    'templates/skills/handoff-create/SKILL.md',
    'templates/skills/handoff-add/SKILL.md',
    'templates/skills/handoff-status/SKILL.md',
    'templates/handoff/schema.md',
    'templates/handoff/example-checklist.yaml',
    'templates/handoff/capture-and-encrypt.mjs',
    'templates/handoff/secure-input.mjs',
    'templates/handoff/handoff-crypto.mjs',
    'templates/handoff/handoff-transport.mjs',
    'templates/handoff/generate-keys.mjs',
  ],
}
```

Module installer:
- Copies skill files to `.claude/skills/handoff/` and
  `.claude/skills/handoff-status/`
- Copies utility scripts to `.claude/handoff/` (co-located with
  `.claude/` infrastructure — resolved per architecture critique)
- Adds `handoff-state.json` and `handoff-out/` to `.gitignore`
- Does NOT add hooks (this module is skill-only)

### Phase 8 — Maginnis Integration (First Consumer)

Separate from the CC module — this is project-specific setup in the
maginnis-howard plugin:

1. Write `handoff.yaml` with the 12 go-live items (credentials Ed needs
   to provide: Postmark token, GTM ID, Turnstile keys, Railway token,
   etc.)
2. Generate consultant keypair, bundle public key in plugin
3. Configure transport (email is simplest — both sides have Gmail MCP)
4. Test end-to-end: Ed runs `/handoff`, captures a test credential,
   Oren retrieves via `/handoff-status`

This phase is tracked as a separate action in the Maginnis project,
not in this CC plan.

## Surface Area

- files: lib/cli.js (modified — add handoff MODULES entry)
- files: templates/skills/handoff/SKILL.md (new)
- files: templates/skills/handoff-progress/SKILL.md (new)
- files: templates/skills/handoff-ask/SKILL.md (new)
- files: templates/skills/handoff-create/SKILL.md (new)
- files: templates/skills/handoff-add/SKILL.md (new)
- files: templates/skills/handoff-status/SKILL.md (new)
- files: templates/handoff/schema.md (new)
- files: templates/handoff/example-checklist.yaml (new)
- files: templates/handoff/capture-and-encrypt.mjs (new)
- files: templates/handoff/secure-input.mjs (new)
- files: templates/handoff/handoff-crypto.mjs (new)
- files: templates/handoff/handoff-transport.mjs (new)
- files: templates/handoff/generate-keys.mjs (new)
- files: CLAUDE.md (modified — document the handoff module)
- files: system-status.md (modified — add handoff module)

## Acceptance Criteria

- [auto] `node -c lib/cli.js` passes with handoff module added
- [auto] `node bin/create-claude-cabinet.js --dry-run --modules handoff`
  lists all handoff templates without error
- [auto] `node templates/handoff/handoff-crypto.mjs test` generates a
  keypair, encrypts a test string, decrypts it, asserts roundtrip match
- [auto] `node templates/handoff/capture-and-encrypt.mjs --test` detects
  the current platform, reports which dialog method would be used, and
  verifies the encrypt-in-process flow with a mock value (without
  actually invoking the OS dialog)
- [auto] Cycle detection: a checklist with `A.depends_on: B` and
  `B.depends_on: A` is rejected at load time with a clear error
- [auto] Checklist YAML with visibility rules: a test script loads the
  example checklist, simulates answering `hosting_provider: Railway`,
  and asserts `railway_token` becomes visible while `vercel_token`
  stays hidden. Transitive: hiding a parent hides grandchildren.
- [auto] State file roundtrip: create state, write answers, reload,
  verify resume produces correct progress count
- [auto] Transport `file` mode: encrypt a test credential, write to
  handoff-out/, read back, decrypt, assert match
- [manual] On macOS: `node secure-input.mjs --prompt "Test"` shows an
  OS dialog with hidden input; entered value is captured but not echoed
- [manual] `/handoff-create` interviews consultant, generates valid
  `handoff.yaml` with sections, items, visibility rules, and transport
  config. Generated YAML passes schema validation and cycle detection.
- [manual] `/handoff` skill reads example checklist, walks through items
  conversationally, captures a credential via OS dialog, encrypts and
  sends via email transport. Credential value never appears in Claude's
  conversation. At session end, sends a `session_summary` email with
  all non-credential answers batched.
- [manual] `/handoff-progress` shows progress table with items completed,
  pending, and blocked. Displays incoming consultant messages if any.
- [manual] `/handoff-add` appends items to existing checklist, sends
  `checklist_update` email to client. New items appear on client's next
  `/handoff` or `/handoff-progress` run.
- [manual] `/handoff-ask` sends a free-text message via email from either
  side. Message appears on the other side's next status check.
- [manual] `/handoff-status` shows progress table with checkmarks,
  incoming client messages, and queued credentials. Consultant can
  retrieve and decrypt a sent credential.
- [deferred] End-to-end Maginnis test: Ed runs `/handoff` on his
  machine, provides a test credential, Oren retrieves it via
  `/handoff-status` on consultant machine

## Key Design Decisions

1. **Skill-based, not hosted service.** Claude's conversational
   progressive disclosure is better than a web form for clients who
   already use Claude Code. Defers the hosted Handoff service until a
   non-CC client needs it.
2. **RSA-OAEP + AES-GCM hybrid encryption.** Consultant's public key
   ships with the plugin. No shared secret exchange needed. Same crypto
   primitives the Packet plan used, but client-side only.
3. **Pluggable transport.** Email (Gmail MCP), MCP tool, or local file.
   No single infrastructure dependency. Email is the default — zero
   infrastructure, works for any engagement.
4. **State file, not database.** JSON file in the client's project,
   gitignored. Simple, portable, no dependencies. Credential values
   are never in the state file — only delivery status.
5. **Cross-platform secure input with graceful degradation.** osascript
   (macOS) → zenity (Linux GUI) → read -s (Linux terminal) → PowerShell
   (Windows). Always works, best experience on macOS.

## Relationship to Existing Work

- **Supersedes** `prj:e104930c` (Handoff standalone) for CC-using
  clients. The standalone plan at `.claude/plans/packet-standalone.md`
  is deferred, not deleted — it remains the right approach for clients
  without Claude Code.
- **Absorbs** the credential-capture primitives from feedback
  `2026-05-30-secure-credential-handoff-should-be-cc-primitives-not-a-standalone-packet-app-1.md`.
- **Reuses** the crypto design (Web Crypto AES-GCM, first-view concepts)
  from the Packet plan's security critique.
- **New module** — total becomes twelve (session-loop, hooks, work-
  tracking, planning, compliance, memory, audit, lifecycle, validate,
  verify, site-audit, handoff).

## Cabinet Critique Summary (2026-05-30)

Three critics reviewed: **security**, **architecture**, **boundary-man**.

**Security (conditional → resolved):** The critical finding was that
the Bash tool returns subprocess stdout to Claude's context, so
separate capture + encrypt steps would leak plaintext to Anthropic's
API. Fixed: merged into `capture-and-encrypt.mjs` — plaintext never
exits the child process. Also: osascript prompt escaping, email subject
metadata stripped to reference ID only.

**Architecture (conditional → resolved):** Utility install destination
resolved to `.claude/handoff/`. Email transport clarified as send (not
draft). `/handoff-status` belongs in CC module (parameterized, not
hardcoded).

**Boundary-man (continue):** Seven boundary conditions identified and
all guards added to Phase 4 skill workflow: YAML validation on load,
dialog cancel handling, transport failure recovery with retry state,
wrong passphrase retry, cycle detection at load time, state file
schema validation, and completed-checklist duplicate warning.

## Resolved Questions

1. **Transport for Maginnis:** Email (Gmail MCP). Zero infrastructure.
   Both sides have Gmail MCP connected.
2. **Private key storage:** Encrypted file with passphrase. Simpler,
   cross-platform. Consultant enters passphrase via OS dialog each
   session when decrypting.
3. **Three-layer pattern:** Document after Maginnis validates it.
4. **Access control:** Anyone with the plugin installed can see checklist
   items and non-credential answers. Credentials are safe regardless
   (encrypted in-process, never in state file). Acceptable for current
   engagements; revisit if multi-party access control is needed.
