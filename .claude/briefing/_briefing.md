# Cabinet Briefing — Claude Cabinet

Split briefing files for this project:

| File | Summary |
|------|---------|
| `_briefing-identity.md` | What CC is, core principles, user context |
| `_briefing-architecture.md` | Single-layer Node CLI, codebase layout, tech stack |
| `_briefing-jurisdictions.md` | Where code, templates, docs, and data live |
| `_briefing-cabinet.md` | 20 active cabinet members, portfolio rules, invocation |
| `_briefing-work-tracking.md` | pib-db (SQLite), query/mutation via pib-db.mjs |

No `_briefing-api.md` — this project has no API.

## Entity Types

- **modules** (runtime) — named feature bundles: session-loop, hooks, work-tracking, planning, compliance, audit, lifecycle, validate
- **skills** (filesystem) — markdown-defined capabilities in `.claude/skills/`
- **phase files** (filesystem) — customization points within skills
- **cabinet members** (filesystem) — expert analysis lenses in `.claude/skills/cabinet-*/`
- **manifest** (`.ccrc.json`) — tracks installed files and their hashes

## Finding Format

```yaml
finding:
  cabinet-member: member-name
  severity: critical | significant | minor | informational
  category: what domain this falls under
  description: what was found
  evidence: specific file:line or observation
  recommendation: what to do about it
```
