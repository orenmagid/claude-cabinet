---
name: handoff-status
description: |
  Consultant's progress dashboard for active handoff engagements. Shows
  what the client has completed, surfaces messages, and retrieves
  encrypted credentials. Use when: "handoff status", "/handoff-status",
  "check on Ed's progress", "decrypt a credential", "any updates from
  the client".
---

# /handoff-status — Handoff Dashboard

## Purpose

Glanceable progress dashboard for the consultant. Shows what the client
has completed, displays incoming messages, and retrieves encrypted
credentials on demand.

## Workflow

### 1. Check for Incoming

Check the connected email MCP for incoming `[Handoff]` emails from the
client. Process each by type:

- **`session_summary`** — Update local progress view with the client's
  answers (non-credential values).
- **`credential`** — Queue for decryption (don't auto-decrypt).
- **`question`** — Display the message prominently.

If no email MCP connected, check `handoff-out/` for file-transport
deliveries. If neither available, show only local state.

### 2. Show Progress

For each active handoff (each `handoff.yaml` in the project), show:

```
## Maginnis Go-Live (7/12 complete)

### Hosting Setup
[x] hosting_provider: Railway
[x] railway_token: sent (env_abc123) — decrypt?
[ ] railway_project_id: waiting

### Email Service
[x] email_provider: Postmark
[ ] postmark_token: not started

### Messages
- Ed (May 30, 12:30): "Where do I find the GTM container ID?"
```

### 3. Credential Retrieval

When the consultant asks to decrypt a credential (or says "decrypt" for
a specific envelope):

1. Locate the envelope: search email for `[Handoff] env_<id>` subject,
   or read from `handoff-out/<id>.enc` for file transport.
2. Extract the base64 envelope string.
3. Invoke the decrypt CLI — it handles passphrase capture via secure
   OS dialog internally (passphrase never enters conversation):

   ```bash
   node .claude/handoff/decrypt-credential.mjs \
     --envelope <base64-envelope-string> \
     --private-key keys/consultant.priv.jwk.enc
   ```

   - **Exit 0:** stdout is the decrypted plaintext. Display once.
   - **Exit 2:** User cancelled the passphrase dialog. Skip.
   - **Exit 5:** Wrong passphrase. Surface "Wrong passphrase — try
     again?" and re-invoke on confirmation.
   - **Exit 3/4:** Dialog unavailable or decrypt error. Surface the
     JSON error from stderr.

4. Advise the consultant to copy the value now — it won't be stored.

## Rules

- Decrypted credential values are displayed once and not stored
- Passphrase capture uses the same secure OS dialog as client-side
  credential capture — it never enters conversation
- If the consultant asks to re-decrypt, re-prompt for passphrase
  (don't cache it)
