---
name: handoff
description: |
  Walk through a consultant's handoff checklist conversationally. Collects
  decisions, information, and credentials from the client with progressive
  disclosure. Credentials are captured via secure OS dialog and encrypted
  before Claude ever sees them. Use when: "handoff", "/handoff", or the
  client needs to provide go-live credentials and configuration.
manual: true
---

# /handoff — Complete Your Checklist

## Purpose

Walk the client through a structured checklist their consultant prepared.
Each item is asked conversationally — decisions drive which follow-up
items appear, credentials are captured securely, and progress is saved
so the client can leave and come back.

## Workflow

### 1. Load and Validate

1. Locate `handoff.yaml` — check in order:
   a. Path provided as argument (the plugin's `/handoff` skill passes
      the absolute path to the config — this is the primary path for
      plugin-based handoffs)
   b. Project root: `./handoff.yaml`
   Use the first match found.
   - **Missing:** "No handoff.yaml found — has the plugin been installed?"
   - **Malformed:** Run validation via `handoff-checklist.mjs` and surface
     specific errors before conversation starts.
   - **Cycle detected:** "This checklist has a circular dependency between
     [keys] — contact your consultant to fix it."
   - **Public key missing:** Resolve `meta.public_key` relative to the
     directory containing `handoff.yaml`. Check that it exists. A missing
     key would only surface on the first credential item — catch it early.

2. **State file co-location:** The state file (`handoff-state.json`)
   lives in the same directory as `handoff.yaml`. Derive the state path
   from the checklist path: replace the filename. This ensures the
   plugin's config and state stay together regardless of install location.

3. Read `handoff-state.json` if it exists (resume mode).
   - **Corrupt state:** Offer "start fresh" vs "show me what's broken."
     Never silently skip items.

4. **Terminal state check:** If all items are complete/sent, warn:
   "This checklist was completed on [date]. Re-running will send
   duplicate credentials. Continue?" Do not silently re-prompt.

5. Show progress summary: "You've completed N of M items. Let's pick up
   with [next section]."

### 2. Check for Incoming Messages

Check the connected email MCP for incoming `[Handoff]` emails from the
consultant (notes, checklist updates, questions). Process and display
any new messages before starting the walk.

If no email MCP is connected, skip with no warning — the client may
be using file transport.

### 3. Walk Through Sections

Walk through sections in order. For each visible item:

**`decide`** — Present options conversationally. Record answer. After
answering, re-evaluate visibility — new items may appear. Tell the
client: "Great, since you chose [X], I'll need a few things from you
for that..."

**`provide`** — Ask for the value. Record in state.

**`confirm`** — Ask yes/no. Record in state.

**`credential`** — Explain what's needed. Show `help` text if present.
Invoke capture-and-encrypt:

```bash
node .claude/handoff/capture-and-encrypt.mjs \
  --prompt "<item prompt>" \
  --public-key <absolute path to meta.public_key, resolved relative to handoff.yaml's directory>
```

This returns ONLY the encrypted envelope (base64) on stdout. The
plaintext credential never enters this conversation or Anthropic's API.

**Important:** The stdout is a base64-serialized envelope. To send it
with the correct `envelope_id` in the email subject, base64-decode and
JSON-parse it to recover the envelope object before passing to
transport. The `envelope_id` field (e.g., `env_abc123`) is needed for
both the email subject and the state file entry.

Then send the envelope object via transport (using `handoff-transport.mjs`).
Pass `context.side = 'client'` so the transport addresses the email to
the consultant.

- **Transport failure:** Write `status: "send_failed"` + serialized
  envelope to state so retry is possible without re-prompting.
- **Dialog cancel (exit code 2):** Skip item, note in state, continue.
- **Success:** Record `status: sent` + `envelope_id` in state. Tell
  the client: "Got it — encrypted and sent. I never saw the value."

Save state after every answer (atomic write via `handoff-checklist.mjs`).

### 4. Completion

Show final summary: "All done! N of N items complete. [Consultant] will
be notified."

Send a `session_summary` with all non-credential answers via transport.

## Rules

- **Never** echo or reference a credential value in conversation
- **Never** store credential values in the state file
- If the client asks where to find something, teach them — this is
  Claude's advantage over a form
- If the client needs to leave, reassure them progress is saved
- Show a progress table at the start and end of each section
