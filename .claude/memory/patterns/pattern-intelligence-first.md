---
name: pattern-intelligence-first
description: Intelligence over regex — use structured JSON between tools, don't let regex gatekeep LLM access, research thoroughly before coding
type: pattern
sources:
  - feedback-intelligence-vs-regex.md
  - feedback-intelligence-not-regex.md
  - feedback-research-before-iterating.md
  - feedback-use-framework-docs-mcp.md
enforcement: guide
promotion_candidates: []
---

## Principle

When the task is semantic (understanding structure, classifying items,
extracting meaning), regex is the wrong tool. It creates brittle parsers
that break on edge cases the author didn't anticipate. Similarly, when
building detection or integration features, blind iteration wastes hours
that 30 minutes of research would have saved. **Use intelligence for
semantic work and research for unfamiliar territory.**

## Rules

- **Use structured output (JSON) not brittle delimiter parsing** for
  tool-to-tool data pipelines. When an LLM produces output that another
  tool consumes, use JSON — never regex over free text.
- **Never let regex gatekeep LLM access to content.** If content needs
  semantic understanding, try focused LLM extraction first, fall back to
  full content only if needed.
- **Research thoroughly before coding** detection/integration features.
  Don't iterate blind — 30 minutes of research saves hours of wrong
  approaches.
- **Check framework-docs MCP before web-searching.** If a library/service
  has an `llms.txt`, add it to `.mcp.json`. The docs are faster and more
  accurate than web search.

## When This Applies

When building parsers, data pipelines between tools, content extraction
systems, or any feature that integrates with unfamiliar APIs or platforms.
