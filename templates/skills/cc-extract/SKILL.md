---
name: cc-extract
description: |
  Analyze non-CC skills, cabinet members, and other artifacts in a consuming
  project and propose candidates for upstreaming into Claude Cabinet as
  generic templates. Does not perform the extraction — files a proposal
  that surfaces during orient in the CC repo. Use when: "extract",
  "upstream this", "should this be in CC?", "/cc-extract".
---

# /cc-extract — Propose Artifacts for Upstreaming to CC

## Purpose

Consuming projects grow custom skills, cabinet members, phase files, and
other artifacts that solve real problems. Some of those solutions are
project-specific. Others solve problems that any project would have.
This skill identifies the latter and proposes upstreaming them into
Claude Cabinet as generic templates.

**This skill proposes. It does not extract.** The actual separation of
generic orchestration from project-specific context happens in the CC
repo after a human reviews and accepts the proposal. The consuming
project then adopts the CC version via `/cc-upgrade`.

## Where This Runs

**Consuming projects only.** If run from the CC source repo
(`package.json` name is `create-claude-cabinet`), say: "This skill runs
from consuming projects. Here, use orient to review incoming proposals."

## Workflow

### 1. Inventory Non-CC Artifacts

Compare the project's `.claude/` directory against `.ccrc.json`'s
manifest. Anything not in the manifest is project-specific:

- **Custom skills** — `.claude/skills/*/SKILL.md` not in manifest
- **Custom cabinet members** — `.claude/skills/cabinet-*/SKILL.md`
  not in the standard set
- **Custom phase files** — phase files in CC skills that override
  defaults with substantial logic (not just `skip: true`)
- **Custom hooks** — hook scripts not installed by CC
- **Custom rules** — `.claude/rules/` files beyond the CC defaults
- **Patterns** — `.claude/memory/patterns/` entries that encode
  reusable lessons

### 2. Assess Each Candidate

For each non-CC artifact, evaluate:

**Generalizability** — Would other projects benefit from this?
- Does it solve a problem tied to this specific project, or a class
  of problems?
- Could the project-specific parts be isolated into phase files?
- Is the core logic reusable if you strip out hardcoded paths, names,
  and domain concepts?

**Maturity** — Is this ready to propose?
- Has it been used enough to know it works? (Check telemetry if
  available, or ask the user.)
- Has it been refined, or is it a first draft?
- Are there known issues or things the user wants to change?

**Category** — What kind of CC artifact would this become?
- A new skill template (SKILL.md + default phase behaviors)
- A new cabinet member (SKILL.md with scan scope and finding format)
- A new phase file for an existing skill (e.g., a custom orient check)
- A new hook or rule template
- A new pattern worth promoting to the standard set

Rate each candidate: **strong** (clearly generic, proven, ready),
**possible** (could be generic with work), or **project-specific**
(not a candidate). Only propose strong and possible candidates.

### 3. Draft Proposals

For each candidate, draft a proposal that includes:

```markdown
# Extraction Proposal: [artifact name]

## Source
- Project: [project name/path]
- Artifact: [path to the artifact]
- Type: skill | cabinet-member | phase | hook | rule | pattern

## What It Does
[1-2 paragraphs describing the artifact's purpose and how it works
in the source project]

## Why It's Generic
[Why this solves a class of problems, not just this project's problem.
What other projects would use it for.]

## Suggested Generalized Form
[How this would look as a CC template. What becomes the skeleton,
what becomes phase-file-configurable, what gets dropped as
project-specific. Include a rough SKILL.md outline if it's a skill
or cabinet member.]

## What Stays Project-Specific
[What parts of the current implementation would remain as phase files
or project configuration after extraction]

## Assessment
- Generalizability: strong | possible
- Maturity: proven | early
- Complexity: low | medium | high (effort to extract)

## Source Artifact Content
[Full content of the artifact being proposed, so the CC repo has
everything needed to evaluate without access to the source project]
```

### 4. File Proposals

**If linked** (the CC package resolves to a local directory — check
if `node -e "console.log(require.resolve('create-claude-cabinet'))"`
points to a local path rather than a `node_modules` path):

- Write each proposal as a markdown file in the CC repo's
  `proposals/` directory (create it if needed)
- Filename: `[source-project]-[artifact-name].md`
  (e.g., `flow-review-pr.md`)
- These will surface during orient in the CC repo

**If not linked** (CC is installed from npm):

- Open a GitHub issue on the CC repo for each proposal
- Title: `Extract proposal: [artifact name] from [project]`
- Label: `extraction-proposal` (create if needed)
- Body: the full proposal markdown
- Requires `gh` CLI to be authenticated

**If neither works** (no link, no gh access):

- Output the proposals to the terminal and tell the user to
  file them manually or copy them to the CC repo

### 5. Summary

After filing, summarize:
- How many artifacts were scanned
- How many proposals were filed (strong + possible)
- How many were project-specific (not proposed)
- Where the proposals went (local files or GitHub issues)
- Remind: "Review these in the CC repo. Accepted proposals get
  built as generic templates, then your project adopts them via
  /cc-upgrade."

## Running on a Subset

The user can target specific artifacts:

- `/cc-extract` — scan everything
- `/cc-extract skills/my-skill` — evaluate a specific skill
- `/cc-extract cabinet-members` — evaluate all custom cabinet members

## What This Does NOT Do

- **Does not modify the consuming project.** No files are changed here.
- **Does not modify CC templates.** Proposals are filed, not applied.
- **Does not decide.** A human reviews each proposal in the CC repo.
- **Does not extract phase files from skills.** The separation of
  skeleton from phases happens during implementation in CC, not here.
  The proposal includes a *suggested* separation, not a final one.
