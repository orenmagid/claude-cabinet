# Handoff Checklist Schema

The checklist YAML (`handoff.yaml`) defines what to collect from a client.
It ships with the client's Claude Code plugin — the `/handoff` skill reads
it and walks the client through each section conversationally.

## Structure

```yaml
meta:
  title: "Project Go-Live Credentials"   # shown to client at start
  consultant: "Your Name"                 # who receives the credentials
  public_key: "./keys/consultant.pub.jwk" # RSA public key for encryption

transport:
  type: email        # email | mcp | file
  consultant: "you@example.com"   # client sends here
  client: "client@example.com"    # consultant sends here

sections:
  - key: section_id
    title: "Section Title"
    items:
      - key: item_id
        prompt: "What the client sees"
        kind: decide           # decide | provide | confirm | credential
        options: [A, B, C]     # only for decide kind
        help: "Optional help text"
        visibility:
          depends_on: other_item_key
          value_in: [A, B]     # show this item only when parent matches
```

## Item Kinds

| Kind | Captured via | Stored as | Use for |
|------|-------------|-----------|---------|
| `decide` | Conversation (choice) | Plaintext value | Decisions that drive visibility |
| `provide` | Conversation (free text) | Plaintext value | Non-sensitive information |
| `confirm` | Conversation (yes/no) | Boolean | Acknowledgments |
| `credential` | OS dialog (hidden input) | Encrypted envelope ID | API keys, tokens, passwords |

Credential values are captured through a secure OS dialog, encrypted
immediately with the consultant's public key, and transported as opaque
envelopes. The plaintext never enters Claude's context or Anthropic's API.

## Visibility Rules

Items with a `visibility` block are hidden until their dependency is met.
Visibility is transitive: if B depends on A and C depends on B, hiding A
hides both B and C.

Cycles are rejected at load time (before any conversation starts). The
checklist parser runs topological sort on the dependency graph and fails
with a clear error if a cycle exists.

## Transport Types

**`email`** (default) — Auto-detects the connected email MCP server
(Gmail, Outlook, etc.) and dispatches through it. Falls back to `file`
if no email MCP is available.

**`mcp`** — Calls a specific MCP tool to POST the encrypted payload.
Requires additional config: `tool_name`, `payload_param`, `extra_params`.

**`file`** — Writes encrypted envelopes to `./handoff-out/`. Also serves
as automatic fallback when email transport has no MCP connected.

## State File

Progress is tracked in `handoff-state.json` (gitignored). Non-credential
answers store the value directly. Credential items store only the
envelope ID and delivery status — never the plaintext.

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
