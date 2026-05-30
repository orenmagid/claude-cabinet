---
name: handoff-ask
description: |
  Send a free-text message to the other side of a handoff engagement.
  Works for both consultant and client. Use when: "handoff ask",
  "/handoff-ask", "message the consultant", "message the client",
  "ask Ed", "send a note".
---

# /handoff-ask — Send a Message

## Purpose

Send a free-text message to the other party in a handoff engagement.
Works for both sides — the client can ask the consultant a question,
and the consultant can send a note to the client.

## Workflow

1. Read `handoff.yaml` for transport config and party identifiers.
   - Determine which side we are: if `keys/consultant.priv.jwk.enc`
     exists locally, we're the consultant. Otherwise we're the client.
     (The public key exists on both sides — only the private key
     distinguishes them.)
   - Recipient is the other side's email from `transport` config.

2. Ask: "What do you want to say to [other party name]?"

3. Send as a `question` payload via transport:
   - **Email subject:** `[Handoff] Question from [sender name]`
   - **Email body:** The free-text message as structured JSON:
     ```json
     {
       "type": "question",
       "from": "sender name",
       "message": "the message text",
       "sent_at": "ISO timestamp"
     }
     ```

4. Confirm: "Message sent to [recipient name]."

5. If email transport falls back to file: "Message written to
   `handoff-out/`. Transfer it manually or connect an email MCP
   server."
