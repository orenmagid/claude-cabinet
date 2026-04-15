# Skill Best Practices

The local standard for writing SKILL.md files in a Claude Cabinet project.
Adapted from Anthropic's official guidance for Claude Cabinet's two-skill-type
architecture.

## Official References

- **Anthropic best practices:** https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- **Claude Code skills reference:** https://code.claude.com/docs/en/skills.md
- **Agent Skills open standard:** https://agentskills.io/specification

This doc is the **local standard**. Where CC deviates from official
guidance, each rule states why. Tooling (`skill-validator.sh`,
`/validate`, `cabinet-roster-check`) reads this as the normative
reference — cite specific sections when flagging violations.

## The Two Skill Types

Claude Cabinet has two distinct kinds of skills. Many rules apply to
both; some apply to only one. Be clear which type you're writing.

**Workflow skills** — user-invocable. The user types `/plan`,
`/audit`, `/debrief`. Examples: `plan/`, `audit/`, `orient/`,
`cc-upgrade/`, `menu/`. Directory name is anything that isn't
`cabinet-*`.

**Cabinet members** — not user-invocable. The framework activates
them programmatically during audits, planning, and execution.
Examples: `cabinet-security/`, `cabinet-qa/`,
`cabinet-architecture/`. Directory name starts with `cabinet-`.

The `cc-*` skills (`cc-upgrade`, `cc-link`, `cc-publish`, etc.) are
workflow skills despite the shared prefix — they're user-invocable
slash commands for CC maintenance.

---

## Rules That Apply to All Skills

These hold for every SKILL.md regardless of type.

### Body under 500 lines

The SKILL.md **body** — content after the closing `---` of
frontmatter — must be under 500 lines. Warn at 450+.

**Why:** Long SKILL.md files lose LLM attention. The skill's contract
with the model is "read this and act"; at 600+ lines, sections at the
end get skimmed or dropped. Split into reference files
(progressive disclosure).

**Extracting content:** When a SKILL.md grows, move self-contained
sections into sibling `.md` files and link to them. See
`templates/skills/cabinet-qa/` for an example — the SKILL.md links
to `patterns-project.md` one level deep.

### Description: present, useful, under 1024 chars

Frontmatter `description` must be:
- Present and non-empty
- Third person ("Evaluates whether..." not "I evaluate...")
- At most 1024 characters
- No XML tags (no `<tag>` patterns)
- At least 2 sentences — enough to convey **what** the skill does
  AND **when** to use it

**Why:** The description is what the model sees when deciding whether
to invoke the skill. A description that only says what (but not when)
leaves the model guessing about trigger conditions. A description with
only trigger conditions (but no what) leaves the model invoking a
skill whose capability it can't predict.

**Bad:** `description: Session close.`
**Good:** `description: Inventories work done, closes items, updates state. Use at the end of every working session to capture lessons and prepare the next session.`

**Bad:** `description: Runs audits.`
**Good:** `description: Convenes the full cabinet for a quality review. Each expert examines the project from their domain and reports findings. Use when preparing to ship, after significant changes, or periodically to catch drift.`

### Name: short, lowercase, safe

Frontmatter `name` must be:
- Present and non-empty
- At most 64 characters
- Lowercase letters, numbers, hyphens only (regex `^[a-z0-9-]+$`)
- No XML tags
- Must not start with `anthropic-` or `claude-`, and must not BE
  `anthropic` or `claude` (these prefixes are reserved for official
  Anthropic skills). Mid-name usage is fine when describing a topic —
  `cabinet-anthropic-insider` (an expert on the Anthropic platform) is
  allowed

**Why:** Names are used as directory names, file paths, and skill
identifiers in tooling. Constraining the charset eliminates a whole
class of shell-escape and filesystem bugs.

### One-level-deep reference files

SKILL.md may link to reference files (`./advanced.md`,
`./calibration.md`). Those reference files must **not** link further
into a third level.

**Bad:**
```
SKILL.md → advanced.md → implementation-details.md
```

**Good:**
```
SKILL.md → advanced.md
SKILL.md → implementation-details.md
```

**Why:** Deep reference chains are effectively hidden from the model
— by the time it has followed two indirections, the context of why
it's reading has faded. Keep related content one link away from the
entry point.

Links to files outside the skill's directory (e.g.,
`templates/cabinet/skill-best-practices.md`, `_briefing.md`) don't
count — those are shared references available at any depth.

### Reference files over 100 lines have a TOC

Any `.md` file in the skill's directory longer than 100 lines must
have a Table of Contents at the top.

**Why:** A 200-line reference file is a document. Documents need
navigation. Readers (both human and model) skim the TOC first.

### No time-sensitive information

Don't write "as of March 2026" or "the current way is..." Skills live
for years; dated claims decay. If you need to document deprecated
behavior, put it in a section explicitly labeled "Old patterns" or
"Historical" — readers know to discount it.

**Why:** Skills get read long after they're written. Time-anchored
claims become silently wrong.

### Consistent terminology

If you call it a "cabinet member" in one paragraph, don't call it a
"cabinet expert" or "advisor" in the next. Pick one term and use it
throughout.

**Why:** Inconsistent terminology inside a single skill makes the
model uncertain whether two terms refer to the same thing — which
causes it to hedge in its output ("the cabinet member (or advisor)
should...").

### Forward slashes in paths

Use `path/to/file.md`, not `path\to\file.md`. Even in examples that
will run on Windows.

**Why:** Forward slashes work everywhere. Backslashes break on Unix
and have to be escaped in most string contexts.

---

## Rules for Workflow Skills Only

### Imperative verb naming

Name a workflow skill after the verb its command invokes: `plan`,
`audit`, `orient`, `validate`, `debrief`, `seed`.

**CC deviation from official guidance.** Official best practices
recommend gerund naming (`planning`, `auditing`). CC uses imperative
verbs because slash commands read as actions: `/plan X` is natural
English; `/planning X` is not. The user is asking the skill to do
something, so the name should be the verb form of what it does.

The gerund convention fits document-processing skills (`excel-reader`,
`pdf-filler`) — those describe a capability, not a command. Workflow
skills are commands; they take the imperative form.

### "When to use" = user trigger

In the description and body, state "when to use" in terms of what the
user does, sees, or needs:

- "Use at the start of every session" ✓
- "Use after completing a working block" ✓
- "Use when you can't remember a skill name" ✓
- "Activated during audit to check authentication" ✗ (that's a cabinet
  member phrasing)

**Why:** Workflow skills are invoked by users. The trigger is a user
action or situation. Cabinet members are activated by the framework,
so they phrase triggers differently.

### argument-hint when accepting arguments

If the skill accepts arguments (like `/loop 5m /foo` or `/plan quick`),
add an `argument-hint` to frontmatter:

```yaml
---
name: loop
description: Run a prompt on a recurring interval.
argument-hint: [interval] <prompt-or-slash-command>
---
```

**Why:** `argument-hint` appears in autocomplete UI. Without it, users
don't know what to type after the slash command.

### Good workflow skill examples

```yaml
name: audit
description: Convenes the full cabinet for a quality review. Each cabinet member examines the project from their domain — security, performance, accessibility, and so on — and reports what they find. Use when preparing to ship, after significant changes, or periodically to catch drift.
```

```yaml
name: orient
description: Session briefing. Reads project state, syncs data, scans work items, runs health checks, then briefs you so the session starts informed. Use at the start of every session.
```

```yaml
name: debrief
description: Session close. Inventories what was done, closes work items, updates state, captures lessons, and prepares the briefing for next time. Use at the end of every working session.
```

---

## Rules for Cabinet Members Only

### cabinet-{domain} naming

Cabinet members are named `cabinet-{domain}`: `cabinet-security`,
`cabinet-qa`, `cabinet-architecture`. The prefix is how tooling
identifies members vs workflow skills.

**Why:** A single grep or directory glob can select all cabinet
members. Mixed naming (`security-reviewer` vs `cabinet-security`)
would require enumerating a list.

### "When to use" = standing-mandate contexts

Cabinet members activate in specific contexts (audit, plan, execute,
orient, debrief, seed). The description's second sentence should
state those activation contexts explicitly:

- "Activated during audit to check auth, input validation, and secret
  handling." ✓
- "Activated during audit, plan, and execute." ✓ (if the member
  participates in all three)
- "Used by developers when they want security review." ✗ (that's a
  workflow skill phrasing)

**Why:** The framework reads the description when deciding whether
to convene a member for a given context. An explicit list of contexts
is the signal the framework uses.

### Second sentence = convening criteria triggers

Per the cabinet member template, the second sentence of the description
states when the member convenes (contexts + any file patterns or
keywords that trigger non-default activation).

**Why:** This gives the framework a single scannable location for
convening logic without parsing the whole SKILL.md body.

### Follow the 7-section structure

Cabinet members must have these sections in this order:

1. Identity
2. Convening Criteria
3. Investigation Protocol (Stage 1: Instrument, Stage 2: Analyze)
4. Scan Scope
5. Portfolio Boundaries
6. Calibration Examples
7. Historically Problematic Patterns

See `templates/cabinet/_cabinet-member-template.md` for the full
template and `cabinet-security/SKILL.md` for a reference
implementation.

**Why:** Consistent structure lets auditors and tooling reason about
cabinet members as a class. Missing sections are usually missing
capability — a member with no Calibration Examples produces
unpredictable findings.

### user-invocable: false

Cabinet members must have `user-invocable: false` in frontmatter.

**Why:** This hides them from the user-facing slash command menu.
They're framework-activated only — surfacing them as slash commands
would be confusing.

### Good cabinet member examples

```yaml
name: cabinet-security
description: Security engineer who evaluates whether the system's data and infrastructure are protected from accidental exposure. Activated during audit, plan, and execute to check authentication, input validation, secret handling, and deployment configuration.
user-invocable: false
```

```yaml
name: cabinet-qa
description: QA engineer who replaces automated tests. Activated during plan to ensure testable acceptance criteria, and during execute to actively test API endpoints, UI interactions, and edge cases.
user-invocable: false
```

---

## How to Get a Skill Validated

### Mechanical checks — skill-validator.sh

Run the validator against one or more SKILL.md files:

```bash
bash scripts/skill-validator.sh templates/skills/plan/SKILL.md
bash scripts/skill-validator.sh templates/skills/*/SKILL.md
```

It checks:
- Line count (body only, ≤500)
- Name validity (charset, length, reserved words)
- Description validity (presence, length, sentence count, no XML)
- Reference depth (one level)
- Path slashes (forward only)
- Skill type rules (workflow vs cabinet)

Output includes remediation hints for every failure.

### Full validation sweep — /validate

The `/validate` skill runs `skill-validator.sh` alongside other
structural checks (manifest drift, etc.). Use before committing
large changes.

### Judgment-based review — cabinet-roster-check

`cabinet-roster-check` activates during `/audit`. It reads this doc
as the normative reference and evaluates the **judgment-based**
quality dimensions that a script can't: is the description clear? Is
the scope right? Does the skill compose well with the rest of the
cabinet?

Mechanical checks enforce correctness; roster-check enforces quality.

---

## Progressive Disclosure (When SKILL.md Grows Too Long)

When a SKILL.md approaches 500 lines, extract sections rather than
trimming content. Sections that are good candidates:

- **Calibration examples** — large, self-contained, rarely change
- **Historically problematic patterns** — accumulate over time
- **Detailed checklists** — reference material, not orchestration
- **Lessons learned** — historical, not operational

Extract to `{section-name}.md` in the same directory. Keep a one-line
summary and a link in SKILL.md. Register the new file in
`lib/cli.js MODULES` if it ships with the installer.

**Don't confuse with phase files.** Phase files (`phases/*.md`) are
for consuming-project customization, not progressive disclosure.
Reference files are shipped content; phase files are override points.

---

## Checklist When Writing a New Skill

- [ ] Name is lowercase, hyphenated, ≤64 chars, no reserved words
- [ ] Description is 2+ sentences, covers what + when, ≤1024 chars
- [ ] Skill type is obvious from directory name (`cabinet-*` or not)
- [ ] If workflow: description uses user-trigger language
- [ ] If cabinet: description names activation contexts; `user-invocable: false`
- [ ] If cabinet: all 7 required sections present
- [ ] Body under 500 lines
- [ ] Reference files one level deep only
- [ ] Reference files over 100 lines have TOC
- [ ] Forward slashes in paths
- [ ] Consistent terminology throughout
- [ ] No dated claims ("as of X")
- [ ] Ran `bash scripts/skill-validator.sh {path}` and it exits 0
