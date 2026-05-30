---
type: field-feedback
source: claudeconsult-maginnis
date: 2026-05-30
component: Plugin architecture / Packet module
---

## Secure credential handoff should be CC primitives, not a standalone Packet app

**Friction:** Packet was designed as a standalone module for encrypted
credential handoff between consultant and client. But if the client already
has a Claude Code plugin installed, a separate app is unnecessary friction —
the plugin IS the interface. The client shouldn't need to learn a second tool.

**Suggestion:** Claude Cabinet should provide two primitives that plugins
consume through skills: (1) secure local input (e.g., osascript dialog on
macOS) that captures credentials without them entering conversation history
or hitting Anthropic's API, and (2) encrypt/transport tools (Web Crypto
envelope with consultant's public key + blob delivery mechanism). Client-side
plugin skill walks user through what's needed → secure input captures each
credential → plugin tool encrypts and sends → consultant-side skill receives
and decrypts. Each client plugin just declares what to collect and where to
send it. This replaces the Packet standalone module concept entirely.

**Session context:** Maginnis Howard engagement — 12 go-live blockers need
credentials from Ed (Postmark token, GTM ID, Turnstile keys, etc.).
