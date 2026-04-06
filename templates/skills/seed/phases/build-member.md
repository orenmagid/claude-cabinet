# Build Cabinet Member — Collaborative Expertise Construction

For each new technology without a matching cabinet member, run a collaborative
conversation with the user to build project-specific expertise. The /seed
skill reads this file when there are gaps to fill.

When this file is absent or empty, the default behavior is: co-author
a cabinet member through structured conversation following the template
below. To explicitly skip building, write only `skip: true`.

## What to Include

Define your building strategy:
- **Research steps** — how to gather information about the technology
  before asking the user
- **Conversation structure** — what questions to ask, in what order
- **Output format** — where to create the cabinet member file, what template
  to follow
- **Wiring** — how to register the cabinet member in committees and make it
  discoverable

## Default Build Process

For each gap the user wants to fill:

### Step 1: Research

Before asking the user anything, gather what you can:
- Read the technology's documentation (use available MCP tools, web search)
- Check how it's configured in this specific project (read config files,
  look at usage patterns in the codebase)
- Identify common pitfalls and best practices for the technology
- Note what version is in use and any version-specific concerns

This research gives you informed questions to ask rather than generic ones.

### Step 2: Collaborative Conversation

Walk through these areas with the user:

**Identity.** "Who is this expert? What do they care about most?"
- Draft a one-paragraph identity statement based on your research
- Ask the user what's missing or wrong about it
- Refine until it captures the right concerns for this project

**Research Method.** "What should this cabinet member examine?"
- Propose a scan scope based on where the technology's files live
- Propose specific things to check (patterns, anti-patterns, config)
- Ask: "What has bitten you before with this technology?"
- Ask: "What do you worry about that you don't currently check?"

**Boundaries.** "What does this cabinet member NOT own?"
- Propose portfolio boundaries to prevent overlap with existing cabinet members
- Ask: "Is there anything here that another cabinet member already covers?"

**Calibration.** "What does a good finding look like?"
- Draft 2-3 example findings at different severities
- Ask the user to adjust the severity anchoring to their project's
  actual risk profile

### Step 3: Create the Cabinet Member

Write the cabinet member's `SKILL.md` following `_lifecycle.md` guidance:
- Place in `.claude/skills/cabinet-{name}/SKILL.md`
- Include all sections: Identity, Convening Criteria, Research Method,
  Boundaries, Calibration Examples
- Set `user-invocable: false` in frontmatter (cabinet members are invoked
  by the audit system, not directly)

### Step 4: Wire It Up

- Add to `committees-project.yaml` under the appropriate committee — use
  `additional_members` to append to an existing upstream committee, or create
  a new committee definition. Create `committees-project.yaml` if it doesn't
  exist yet. (Unless the cabinet member is cross-portfolio, in which case it
  activates via `standing-mandate` signals and needs no committee entry.)
- Verify the cabinet member is discoverable by the audit skill

### Emphasis

This is co-authoring, not auto-generating. A generic cabinet member based
solely on technology documentation catches generic issues. A cabinet member
built with user input — their specific risks, their past incidents,
their project's actual patterns — catches what actually matters.

The user's time in this conversation is an investment. It pays off in
every subsequent audit cycle when the cabinet member catches something
specific to their project that a generic check would miss.

## Overriding This Phase

Projects override this file when they have a different conversation
structure, additional template requirements, or non-standard cabinet member
registration. For example, a project that requires cost-benefit analysis
before adopting a cabinet member, or one that requires approval from
multiple stakeholders.
