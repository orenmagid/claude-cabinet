# Claude Cabinet — Full Restructure Plan

## What This Is

A complete rename and restructure of the project formerly known as
"Claude on Rails" (`create-claude-rails`) into **Claude Cabinet**
(`create-claude-cabinet`). This is not just a terminology pass — it's a
full commitment to the cabinet metaphor at every layer: package name,
directory structure, file names, frontmatter keys, prose, and CLI output.

This document is the single source of truth for the restructure. Every
file affected, every term changed, every risk identified, and the full
Flow migration plan are here.

---

## Part 1: Terminology Map (locked in)

### Concept Renames

| Old Term | New Term | Where It Appears |
|---|---|---|
| Claude on Rails | **Claude Cabinet** | project name everywhere |
| create-claude-rails | **create-claude-cabinet** | npm package, CLI, bin/, docs |
| CoR | **CC** (or spell out) | abbreviation in code/docs — evaluate case by case |
| perspective | **cabinet member** | 86 files, ~1,375 line occurrences |
| group | **committee** | 15 files, ~57 occurrences |
| `_groups.yaml` | **`committees.yaml`** | 15 files referencing it |
| context file / `_context-*.md` | **briefing / `_briefing-*.md`** | 52 files, ~389 occurrences |
| scan scope | **paths** (within briefings) | briefing templates |
| lane | **portfolio** | 11 files, ~37 occurrences |
| cross-cutting | **cross-portfolio mandate** | 5 files, ~12 occurrences |
| activation signals | **convening criteria** | 8 files, ~21 occurrences |
| always-on-for | **standing-mandate** | 25 files, ~56 occurrences |
| `perspective-*` (name prefix) | **`cabinet-*`** | all 20 member SKILL.md frontmatter |
| `skills/perspectives/` | **members → `skills/cabinet-*/`, infra → `cabinet/`** | directory paths everywhere |

### Cabinet Member Name Renames

| Old Directory Name | New Directory Name | Rationale |
|---|---|---|
| boundary-conditions | **boundary-man** | personality — edge case superhero |
| meta-process | **process-therapist** | diagnoses whether the process is healthy |
| mobile-responsiveness | **small-screen** | shorter, still clear |
| skills-coverage | **roster-check** | fits cabinet metaphor — "is the roster complete?" |
| documentation | **record-keeper** | pairs with historian |
| process | **workflow-cop** | enforces process compliance — "process" alone is vague |
| performance | **speed-freak** | personality |

### Names That Stay

accessibility, anti-confirmation, architecture, cor-health, data-integrity,
debugger, historian, organized-mind, qa, security, system-advocate,
technical-debt, usability — already clear or evocative.

### "cor-" Prefix Decision

The `cor-` prefix appears in: `cor-health`, `cor-upgrade`, `cor-upstream-guard.sh`,
`cor-drift-check.cjs`, `.corrc.json`. These are **internal infrastructure names**,
not user-facing brand. Decision: **leave as-is for now**. The abbreviation still
works ("cabinet" → same first letter). Revisiting later is low-cost since these
are few files with grep-friendly names.

---

## Part 2: Directory Structure

### Constraint: Claude Code Discoverability

Claude Code discovers skills **only** at `.claude/skills/*/SKILL.md` (plus
personal `~/.claude/skills/` and plugin paths). There is no way to register
additional discovery paths. Cabinet members **must** stay under `.claude/skills/`
to be discoverable. The metaphor lives in naming and frontmatter, not directory
depth.

### After: Installed Project Structure

```
.claude/
├── skills/                          # Claude Code discovery root
│   │
│   │  # ── Session loop & workflow skills ──
│   ├── orient/
│   │   ├── SKILL.md
│   │   └── phases/
│   ├── debrief/
│   ├── debrief-quick/
│   ├── plan/
│   ├── execute/
│   ├── audit/
│   ├── onboard/
│   ├── seed/
│   ├── menu/
│   ├── pulse/
│   ├── triage-audit/
│   ├── validate/
│   ├── publish/
│   ├── extract/
│   ├── investigate/
│   ├── link/
│   ├── unlink/
│   ├── cor-upgrade/
│   │
│   │  # ── Cabinet members (was perspectives/) ──
│   ├── cabinet-accessibility/
│   │   └── SKILL.md
│   ├── cabinet-anti-confirmation/
│   ├── cabinet-architecture/
│   ├── cabinet-boundary-man/          # was boundary-conditions
│   ├── cabinet-cor-health/
│   ├── cabinet-data-integrity/
│   ├── cabinet-debugger/
│   ├── cabinet-historian/
│   ├── cabinet-organized-mind/
│   ├── cabinet-process-therapist/     # was meta-process
│   ├── cabinet-qa/
│   ├── cabinet-record-keeper/         # was documentation
│   ├── cabinet-roster-check/          # was skills-coverage
│   ├── cabinet-security/
│   ├── cabinet-small-screen/          # was mobile-responsiveness
│   ├── cabinet-speed-freak/           # was performance
│   ├── cabinet-system-advocate/
│   ├── cabinet-technical-debt/
│   ├── cabinet-usability/
│   └── cabinet-workflow-cop/          # was process
│
├── cabinet/                           # cabinet infrastructure (not discoverable — fine)
│   ├── committees.yaml                # was _groups.yaml
│   ├── lifecycle.md                   # was _lifecycle.md
│   ├── composition-patterns.md        # was _composition-patterns.md
│   ├── eval-protocol.md              # was _eval-protocol.md
│   ├── prompt-guide.md               # was _prompt-guide.md
│   └── output-contract.md            # was output-contract.md
│
├── briefing/                          # project briefings (was _context-*.md)
│   ├── _briefing.md                   # hub file (was _context.md)
│   ├── _briefing-identity.md          # was _context-identity.md
│   ├── _briefing-architecture.md      # was _context-architecture.md
│   ├── _briefing-scopes.md           # was _context-scopes.md
│   ├── _briefing-cabinet.md          # was _context-cabinet.md
│   ├── _briefing-work-tracking.md    # was _context-work-tracking.md
│   ├── _briefing-api.md             # was _context-api.md (if project has API)
│   └── _briefing-{domain}.md        # domain extensions
│
├── hooks/
│   ├── cor-upstream-guard.sh
│   ├── git-guardrails.sh
│   ├── session-start.sh
│   ├── skill-telemetry.sh
│   └── skill-tool-telemetry.sh
│
├── scripts/
├── settings.json
└── ...
```

### After: Template Source Structure

```
templates/
├── skills/
│   ├── orient/
│   ├── debrief/
│   ├── plan/
│   ├── execute/
│   ├── audit/
│   ├── onboard/
│   ├── seed/
│   ├── menu/
│   ├── ...all other workflow skills...
│   │
│   ├── cabinet-accessibility/SKILL.md
│   ├── cabinet-anti-confirmation/SKILL.md
│   ├── cabinet-architecture/SKILL.md
│   ├── cabinet-boundary-man/SKILL.md
│   ├── cabinet-cor-health/SKILL.md
│   ├── cabinet-data-integrity/SKILL.md
│   ├── cabinet-debugger/SKILL.md
│   ├── cabinet-historian/SKILL.md
│   ├── cabinet-organized-mind/SKILL.md
│   ├── cabinet-process-therapist/SKILL.md
│   ├── cabinet-qa/SKILL.md
│   ├── cabinet-record-keeper/SKILL.md
│   ├── cabinet-roster-check/SKILL.md
│   ├── cabinet-security/SKILL.md
│   ├── cabinet-small-screen/SKILL.md
│   ├── cabinet-speed-freak/SKILL.md
│   ├── cabinet-system-advocate/SKILL.md
│   ├── cabinet-technical-debt/SKILL.md
│   ├── cabinet-usability/SKILL.md
│   └── cabinet-workflow-cop/SKILL.md
│
├── cabinet/                           # cabinet infrastructure templates
│   ├── committees-template.yaml
│   ├── lifecycle.md
│   ├── composition-patterns.md
│   ├── eval-protocol.md
│   ├── prompt-guide.md
│   └── output-contract.md
│
├── briefing/                          # briefing templates
│   ├── _briefing-template.md
│   ├── _briefing-identity-template.md
│   ├── _briefing-architecture-template.md
│   ├── _briefing-scopes-template.md
│   ├── _briefing-cabinet-template.md
│   ├── _briefing-work-tracking-template.md
│   └── _briefing-api-template.md
│
├── hooks/
├── scripts/
├── EXTENSIONS.md
└── README.md
```

---

## Part 3: Blast Radius — Every File That Changes

### 3A: Package Name (25 files, ~132 line occurrences)

**Package/config files:**
- `package.json` — name, bin, repository, homepage, bugs (3 occurrences)
- `package-lock.json` — name, packages (3 occurrences)
- `bin/create-claude-rails.js` — **rename file** to `bin/create-claude-cabinet.js`

**CLI and lib:**
- `lib/cli.js` — 19 occurrences (banner, help text, error messages, paths)
- `lib/metadata.js` — 1 occurrence
- `lib/reset.js` — 1 occurrence

**Installation:**
- `install.sh` — 8 occurrences (package name, npm commands, banner)

**Documentation:**
- `README.md` — 17 occurrences
- `GETTING-STARTED.md` — 11 occurrences
- `GITHUB-SETUP.md` — 2 occurrences
- `CLAUDE.md` — 2 occurrences
- `system-status.md` — 1 occurrence

**Template skills referencing package:**
- `templates/skills/cor-upgrade/SKILL.md` — 6 occurrences
- `templates/skills/link/SKILL.md` — 8 occurrences
- `templates/skills/unlink/SKILL.md` — 3 occurrences
- `templates/skills/publish/SKILL.md` — 4 occurrences
- `templates/skills/extract/SKILL.md` — 4 occurrences
- `templates/skills/onboard/SKILL.md` — 1 occurrence
- `templates/skills/onboard/phases/interview.md` — 1 occurrence
- `templates/skills/onboard/phases/detect-state.md` — 1 occurrence
- `templates/skills/debrief/phases/upstream-feedback.md` — 2 occurrences
- `templates/EXTENSIONS.md` — 1 occurrence

**Hooks:**
- `templates/hooks/cor-upstream-guard.sh` — 2 occurrences

### 3B: "perspective" → "cabinet member" (86 files, ~1,375 occurrences)

**Cabinet member SKILL.md files (20 files):**
Each needs: frontmatter name prefix change, context→briefing refs,
"Activation Signals"→"Convening Criteria", "always-on-for"→"standing-mandate",
"Boundaries"→"Portfolio", "lane"→"portfolio", "cross-cutting"→"cross-portfolio",
"Wrong lane:"→"Wrong portfolio:", plus contextual prose changes.

Full list:
- `cabinet-accessibility/SKILL.md` (was `perspectives/accessibility/`)
- `cabinet-anti-confirmation/SKILL.md`
- `cabinet-architecture/SKILL.md`
- `cabinet-boundary-man/SKILL.md` (was `boundary-conditions/`)
- `cabinet-cor-health/SKILL.md`
- `cabinet-data-integrity/SKILL.md`
- `cabinet-debugger/SKILL.md`
- `cabinet-historian/SKILL.md`
- `cabinet-organized-mind/SKILL.md`
- `cabinet-process-therapist/SKILL.md` (was `meta-process/`)
- `cabinet-qa/SKILL.md`
- `cabinet-record-keeper/SKILL.md` (was `documentation/`)
- `cabinet-roster-check/SKILL.md` (was `skills-coverage/`)
- `cabinet-security/SKILL.md`
- `cabinet-small-screen/SKILL.md` (was `mobile-responsiveness/`)
- `cabinet-speed-freak/SKILL.md` (was `performance/`)
- `cabinet-system-advocate/SKILL.md`
- `cabinet-technical-debt/SKILL.md`
- `cabinet-usability/SKILL.md`
- `cabinet-workflow-cop/SKILL.md` (was `process/`)

**Cabinet infrastructure files (6 files):**
- `cabinet/committees-template.yaml`
- `cabinet/lifecycle.md`
- `cabinet/composition-patterns.md`
- `cabinet/eval-protocol.md`
- `cabinet/prompt-guide.md`
- `cabinet/output-contract.md`

**Workflow skills referencing perspectives (20+ files):**
- `audit/SKILL.md` — heaviest (references perspectives dozens of times)
- `audit/phases/perspective-selection.md` → **rename to** `member-selection.md`
- `audit/phases/perspective-execution.md` → **rename to** `member-execution.md`
- `audit/phases/structural-checks.md` — if it references perspectives
- `audit/phases/finding-output.md` — if it references perspectives
- `plan/SKILL.md`
- `plan/phases/perspective-critique.md` → **rename to** `cabinet-critique.md`
- `execute/SKILL.md`
- `execute/phases/perspectives.md` → **rename to** `cabinet.md`
- `orient/SKILL.md`
- `orient/phases/perspectives.md` → **rename to** `cabinet.md`
- `orient-quick/SKILL.md`
- `debrief/SKILL.md` — "Perspective Check" → "Cabinet Check"
- `debrief-quick/SKILL.md`
- `seed/SKILL.md`
- `seed/phases/scan-signals.md`
- `seed/phases/build-perspective.md` → **rename to** `build-member.md`
- `seed/phases/evaluate-existing.md`
- `seed/phases/maintain.md`
- `onboard/SKILL.md`
- `onboard/phases/detect-state.md`
- `onboard/phases/generate-context.md`
- `onboard/phases/post-onboard-audit.md`
- `onboard/phases/modularity-menu.md`
- `onboard/phases/interview.md`
- `menu/SKILL.md`
- `cor-upgrade/SKILL.md`
- `triage-audit/SKILL.md`
- `triage-audit/phases/*.md`
- `pulse/SKILL.md`
- `validate/SKILL.md`
- `investigate/SKILL.md`

**Briefing templates (7 files):**
- `briefing/_briefing-template.md`
- `briefing/_briefing-identity-template.md`
- `briefing/_briefing-architecture-template.md`
- `briefing/_briefing-scopes-template.md`
- `briefing/_briefing-cabinet-template.md`
- `briefing/_briefing-work-tracking-template.md`
- `briefing/_briefing-api-template.md`

**Documentation (5+ files):**
- `README.md`
- `CLAUDE.md`
- `GETTING-STARTED.md`
- `templates/README.md`
- `templates/EXTENSIONS.md`

**Scripts:**
- `templates/scripts/merge-findings.js` — if it references perspectives
- `templates/scripts/cor-drift-check.cjs` — if it references perspectives

### 3C: Phase File Renames (7 files)

These phase files have "perspective" in their filename:

| Old Path | New Path |
|---|---|
| `audit/phases/perspective-selection.md` | `audit/phases/member-selection.md` |
| `audit/phases/perspective-execution.md` | `audit/phases/member-execution.md` |
| `plan/phases/perspective-critique.md` | `plan/phases/cabinet-critique.md` |
| `execute/phases/perspectives.md` | `execute/phases/cabinet.md` |
| `orient/phases/perspectives.md` | `orient/phases/cabinet.md` |
| `seed/phases/build-perspective.md` | `seed/phases/build-member.md` |
| `onboard/phases/generate-context.md` | `onboard/phases/generate-briefing.md` |

**Critical:** Each parent SKILL.md lists its phase files. When a phase file
is renamed, the parent SKILL.md frontmatter must be updated to match, AND
any other file that references the phase by name must be updated.

### 3D: Frontmatter Key Changes (25 files)

In every cabinet member SKILL.md:
```yaml
# Before
name: perspective-security
context:
  - _context-identity.md
  - _context-architecture.md
always-on-for: audit

# After
name: cabinet-security
briefing:
  - _briefing-identity.md
  - _briefing-architecture.md
standing-mandate: audit
```

Note: the frontmatter key `context:` → `briefing:` and `always-on-for:` →
`standing-mandate:`. Every piece of code that **reads** these frontmatter keys
must be updated: `audit/SKILL.md`, `audit/phases/member-execution.md`,
`execute/SKILL.md`, `execute/phases/cabinet.md`, `plan/SKILL.md`, `seed/SKILL.md`.

---

## Part 4: Implementation Phases

### Phase 1: Template Directory Restructure

**Create directories:**
```bash
mkdir -p templates/cabinet
mkdir -p templates/briefing
```

**Move cabinet infrastructure** (6 files):
```bash
# From templates/skills/perspectives/ to templates/cabinet/
mv _groups-template.yaml → committees-template.yaml
mv _lifecycle.md → lifecycle.md
mv _composition-patterns.md → composition-patterns.md
mv _eval-protocol.md → eval-protocol.md
mv _prompt-guide.md → prompt-guide.md
mv output-contract.md → output-contract.md
```

**Move briefing templates** (7 files):
```bash
# From templates/skills/perspectives/ to templates/briefing/
mv _context-template.md → _briefing-template.md
mv _context-identity-template.md → _briefing-identity-template.md
mv _context-architecture-template.md → _briefing-architecture-template.md
mv _context-scopes-template.md → _briefing-scopes-template.md
mv _context-cabinet-template.md → _briefing-cabinet-template.md
mv _context-work-tracking-template.md → _briefing-work-tracking-template.md
mv _context-api-template.md → _briefing-api-template.md
```

**Move and rename cabinet member directories** (20 directories):
```bash
# From templates/skills/perspectives/{old}/ to templates/skills/cabinet-{new}/
perspectives/accessibility/        → skills/cabinet-accessibility/
perspectives/anti-confirmation/    → skills/cabinet-anti-confirmation/
perspectives/architecture/         → skills/cabinet-architecture/
perspectives/boundary-conditions/  → skills/cabinet-boundary-man/
perspectives/cor-health/           → skills/cabinet-cor-health/
perspectives/data-integrity/       → skills/cabinet-data-integrity/
perspectives/debugger/             → skills/cabinet-debugger/
perspectives/documentation/        → skills/cabinet-record-keeper/
perspectives/historian/            → skills/cabinet-historian/
perspectives/meta-process/         → skills/cabinet-process-therapist/
perspectives/mobile-responsiveness/→ skills/cabinet-small-screen/
perspectives/organized-mind/       → skills/cabinet-organized-mind/
perspectives/performance/          → skills/cabinet-speed-freak/
perspectives/process/              → skills/cabinet-workflow-cop/
perspectives/qa/                   → skills/cabinet-qa/
perspectives/security/             → skills/cabinet-security/
perspectives/skills-coverage/      → skills/cabinet-roster-check/
perspectives/system-advocate/      → skills/cabinet-system-advocate/
perspectives/technical-debt/       → skills/cabinet-technical-debt/
perspectives/usability/            → skills/cabinet-usability/
```

**Rename phase files** (7 files):
```bash
audit/phases/perspective-selection.md → audit/phases/member-selection.md
audit/phases/perspective-execution.md → audit/phases/member-execution.md
plan/phases/perspective-critique.md   → plan/phases/cabinet-critique.md
execute/phases/perspectives.md        → execute/phases/cabinet.md
orient/phases/perspectives.md         → orient/phases/cabinet.md
seed/phases/build-perspective.md      → seed/phases/build-member.md
onboard/phases/generate-context.md    → onboard/phases/generate-briefing.md
```

**Rename bin file:**
```bash
bin/create-claude-rails.js → bin/create-claude-cabinet.js
```

**Delete empty directory:**
```bash
rm -rf templates/skills/perspectives/  # should be empty after moves
```

### Phase 2: Content Updates — Cabinet Members (20 files)

For each of the 20 cabinet member SKILL.md files, apply these changes:

1. **Frontmatter:**
   - `name: perspective-X` → `name: cabinet-X`
   - `context:` key → `briefing:`
   - Each `_context-*.md` value → `_briefing-*.md`
   - `always-on-for:` → `standing-mandate:`
   - `user-invocable: false` stays

2. **Section headings:**
   - "Activation Signals" → "Convening Criteria"
   - "Boundaries" → "Portfolio Boundaries"

3. **Body text (contextual — not blind find/replace):**
   - "perspective" → "cabinet member" (when referring to the concept)
   - "perspectives" → "cabinet members" (plural)
   - "this perspective" → "this cabinet member"
   - "lane" → "portfolio" (when referring to domain boundaries)
   - "stays in its lane" → "stays in its portfolio"
   - "Wrong lane:" → "Wrong portfolio:"
   - "cross-cutting" → "cross-portfolio"

4. **For renamed members, also update internal identity references:**
   - boundary-conditions → boundary-man (in its own prose)
   - meta-process → process-therapist
   - mobile-responsiveness → small-screen
   - skills-coverage → roster-check
   - documentation → record-keeper
   - process → workflow-cop
   - performance → speed-freak

### Phase 3: Content Updates — Cabinet Infrastructure (6 files)

- **`committees-template.yaml`**: "groups"→"committees", "cross-cutting"→"cross-portfolio",
  all perspective names updated to new names
- **`lifecycle.md`**: full terminology pass — "perspective"→"cabinet member",
  "lane"→"portfolio", "cross-cutting"→"cross-portfolio", "activation signals"→
  "convening criteria", "always-on-for"→"standing-mandate", "_groups.yaml"→
  "committees.yaml", all perspective names, paths updated
- **`composition-patterns.md`**: "perspective"→"cabinet member" throughout,
  recipe names if they reference perspectives
- **`eval-protocol.md`**: "perspective"→"cabinet member", "lane"→"portfolio"
- **`prompt-guide.md`**: full terminology pass
- **`output-contract.md`**: "perspective"→"cabinet member"

### Phase 4: Content Updates — Workflow Skills (~30 files)

**audit/ (heaviest — most perspective references):**
- `SKILL.md` — rewrite all perspective refs, update paths to `skills/cabinet-*`,
  `_groups.yaml`→`committees.yaml`, update frontmatter listing phase files
  (renamed phases), `activation signals`→`convening criteria`
- `phases/member-selection.md` (renamed) — update content
- `phases/member-execution.md` (renamed) — update content, context loading
  instructions now reference `briefing/` directory
- Other phase files — check for perspective references

**plan/:**
- `SKILL.md` — perspective refs, activation signals
- `phases/cabinet-critique.md` (renamed) — update content

**execute/:**
- `SKILL.md` — perspective refs, activation signals, convening criteria
- `phases/cabinet.md` (renamed) — update content

**orient/:**
- `SKILL.md` — perspective refs
- `phases/cabinet.md` (renamed) — update content

**debrief/:**
- `SKILL.md` — "Perspective Check"→"Cabinet Check", all perspective refs,
  `_groups.yaml`→`committees.yaml`

**seed/:**
- `SKILL.md` — heavy rewrite (it builds perspectives), `_groups.yaml`→
  `committees.yaml`, all perspective/lane terminology
- `phases/build-member.md` (renamed) — update content
- `phases/scan-signals.md` — update terminology
- `phases/evaluate-existing.md` — update terminology
- `phases/maintain.md` — update terminology

**onboard/:**
- `SKILL.md` — perspective refs
- `phases/detect-state.md` — scanning for perspectives→cabinet members
- `phases/generate-briefing.md` (renamed) — context→briefing refs throughout
- `phases/post-onboard-audit.md` — `_groups.yaml`→`committees.yaml`
- `phases/modularity-menu.md` — perspective refs
- `phases/interview.md` — package name

**Other skills:** menu, cor-upgrade, triage-audit, pulse, validate, investigate,
link, unlink, publish, extract, debrief-quick, orient-quick — check each for
perspective/context/package name references and update.

### Phase 5: Content Updates — Briefing Templates (7 files)

- `_briefing-template.md` — rename all `_context-*` references to `_briefing-*`,
  "perspective"→"cabinet member", "context file"→"briefing"
- `_briefing-identity-template.md` — update cross-references
- `_briefing-architecture-template.md` — update cross-references
- `_briefing-scopes-template.md` — "scan scopes" language → "paths"
- `_briefing-cabinet-template.md` — "perspectives"→"cabinet members",
  "lanes"→"portfolios", "_groups.yaml"→"committees.yaml"
- `_briefing-work-tracking-template.md` — update cross-references
- `_briefing-api-template.md` — update cross-references

### Phase 6: Package Rename & Installer Updates

**`package.json`:**
- `"name": "create-claude-rails"` → `"name": "create-claude-cabinet"`
- `"bin"` entry: update path to `bin/create-claude-cabinet.js`
- `"repository"`, `"homepage"`, `"bugs"` URLs — update if repo renames
- `"description"` — update to reference cabinet

**`package-lock.json`:**
- Regenerate after package.json changes (`npm install`)

**`bin/create-claude-cabinet.js`** (renamed file):
- Update internal references if any

**`lib/cli.js` (19+ occurrences):**
- Banner/title text
- Help output
- MODULES object:
  - Module formerly called "perspectives" or "audit" — update descriptions
  - Template paths: `skills/perspectives/` → `skills/cabinet-*` + `cabinet/` + `briefing/`
  - Add new template directories to copying logic
- Error messages and user-facing strings
- Registry references

**`lib/metadata.js`:**
- Package name reference

**`lib/reset.js`:**
- Package name reference

**`lib/copy.js`:**
- Check for any hardcoded perspective paths

**`install.sh` (8 occurrences):**
- Package name in npm/npx commands
- Banner text
- VERSION variable (bump)
- Directory creation paths
- File copying paths
- Comments

### Phase 7: Documentation Updates

**`README.md`** (17 occurrences):
- Project title and description
- Installation commands (`npx create-claude-cabinet`)
- All terminology changes
- Directory structure diagrams
- Feature descriptions

**`CLAUDE.md`** (2 occurrences):
- Project description line
- Key files section — update paths
- Conventions section — update terminology

**`GETTING-STARTED.md`** (11 occurrences):
- Installation commands
- Walkthrough text
- Terminology

**`GITHUB-SETUP.md`** (2 occurrences):
- Repository references

**`system-status.md`** (1 occurrence):
- Project name reference

**`templates/README.md`**:
- Full pass

**`templates/EXTENSIONS.md`**:
- Package name, perspective references

### Phase 8: Hooks & Scripts

**`templates/hooks/cor-upstream-guard.sh`** (2 occurrences):
- Package name in comments/output
- Path references if any

**`templates/scripts/merge-findings.js`**:
- Check for perspective path references

**`templates/scripts/cor-drift-check.cjs`**:
- Check for perspective path references

### Phase 9: Version Bump & Validation

**Version:** `0.5.8` → `0.6.0` (breaking directory structure change)

**Bump in:**
- `package.json`
- `install.sh` VERSION variable

**Validation checklist:**
```bash
# Syntax check
node -c lib/cli.js

# No remaining old terminology in templates
grep -rn "perspectives/" templates/
grep -rn "skills/perspectives" templates/
grep -rn "_groups\.yaml" templates/
grep -rn "_context-" templates/
grep -rn "activation.signal" templates/ --include="*.md"
grep -rn "always-on-for" templates/ --include="*.md"
grep -rn "Wrong lane" templates/
grep -rn "domain lane" templates/
grep -rn "cross-cutting" templates/
grep -rn "create-claude-rails" .
grep -rn "claude-on-rails" .
grep -rn "Claude on Rails" .

# Intentional survivors (cor- prefix, kept deliberately):
# cor-health, cor-upgrade, cor-upstream-guard.sh, cor-drift-check.cjs, .corrc.json

# Dry run
node lib/cli.js --dry-run

# Check installed structure
ls -R .claude/skills/cabinet-*
ls -R .claude/cabinet/
ls -R .claude/briefing/
```

**Commit:** Single atomic commit. Message:
```
Rename to Claude Cabinet — full restructure

Commit the cabinet metaphor through every layer: package name
(create-claude-cabinet), directory structure (cabinet members in
skills/cabinet-*, infrastructure in cabinet/, briefings in briefing/),
and all terminology (perspective→cabinet member, group→committee,
lane→portfolio, activation signals→convening criteria).

Also rename 7 cabinet members for personality: boundary-man,
process-therapist, small-screen, roster-check, record-keeper,
workflow-cop, speed-freak.

Breaking change: all template paths changed. Existing installs
need cor-upgrade or fresh install.
```

---

## Part 5: Flow Migration Plan

Flow is the first (and currently only) downstream consumer of Claude on Rails.
It has 32 perspectives (20 CoR standard + 12 Flow-custom), extensively
customized phase files, and a live production system. Migration must be
careful.

### 5A: Flow's Current State

**CoR version installed:** 0.5.1
**Total perspectives deployed:** 32
- 20 CoR standard perspectives
- 12 Flow-custom: life-tracker, prep-scout, life-optimization,
  philosophical-grounding, mantine-quality, information-design,
  ui-experimentalist, goal-alignment, vision, gtd, sync-health,
  system-tutor (renamed to user-advocate later)

**Custom phase files (Flow-owned, not CoR-managed):**
- `orient/phases/perspectives.md` — activates specific perspectives per session
- `debrief/phases/upstream-feedback.md` — friction surfacing
- `plan/phases/perspective-critique.md` — may have custom content
- `execute/phases/perspectives.md` — may have custom content
- Plus ~40 other custom phase files across skills

**Key infrastructure files:**
- `.claude/skills/perspectives/_context.md` — monolithic context (15.6KB, heavily customized)
- `.claude/skills/perspectives/_groups.yaml` — 6 groups + cross-cutting
- `.corrc.json` — manifest tracking 90 upstream files with hashes

**Hooks:**
- `cor-upstream-guard.sh` reads `.corrc.json` to block upstream file edits

### 5B: What Changes in Flow

**Directory moves:**
```
# CoR-managed perspective directories (20) move:
.claude/skills/perspectives/accessibility/    → .claude/skills/cabinet-accessibility/
.claude/skills/perspectives/boundary-conditions/ → .claude/skills/cabinet-boundary-man/
# ... (all 20)

# Flow-custom perspectives (12) also move:
.claude/skills/perspectives/life-tracker/     → .claude/skills/cabinet-life-tracker/
.claude/skills/perspectives/prep-scout/       → .claude/skills/cabinet-prep-scout/
# ... (all 12)

# Infrastructure moves:
.claude/skills/perspectives/_groups.yaml      → .claude/cabinet/committees.yaml
.claude/skills/perspectives/_lifecycle.md     → .claude/cabinet/lifecycle.md
.claude/skills/perspectives/_composition-patterns.md → .claude/cabinet/composition-patterns.md
.claude/skills/perspectives/_eval-protocol.md → .claude/cabinet/eval-protocol.md
.claude/skills/perspectives/_prompt-guide.md  → .claude/cabinet/prompt-guide.md
.claude/skills/perspectives/output-contract.md → .claude/cabinet/output-contract.md

# Context files move:
.claude/skills/perspectives/_context.md       → .claude/briefing/_briefing.md
# (Flow uses monolithic _context.md, not split files — it becomes _briefing.md)

# Empty directory removed:
.claude/skills/perspectives/                  → deleted
```

**Phase file renames (CoR-managed, need renaming in Flow):**
```
orient/phases/perspectives.md         → orient/phases/cabinet.md
execute/phases/perspectives.md        → execute/phases/cabinet.md
plan/phases/perspective-critique.md   → plan/phases/cabinet-critique.md
audit/phases/perspective-selection.md → audit/phases/member-selection.md
audit/phases/perspective-execution.md → audit/phases/member-execution.md
seed/phases/build-perspective.md      → seed/phases/build-member.md
onboard/phases/generate-context.md    → onboard/phases/generate-briefing.md
```

**Content updates in Flow-owned files:**
- `orient/phases/cabinet.md` (was perspectives.md) — Flow's custom content
  references perspective names → update to new names
- `_groups.yaml` content → `committees.yaml` content with new member names
- Any Flow-custom perspective SKILL.md files — update frontmatter keys
  (context→briefing, always-on-for→standing-mandate, name prefix)
- Flow's CLAUDE.md — if it references "perspectives" or paths

**`.corrc.json` manifest:**
- Must be regenerated with new file paths and hashes
- The `cor-upstream-guard.sh` hook reads this — if manifest is stale,
  it may block or allow wrong files

### 5C: Flow Migration Steps

**Option A: Clean reinstall (recommended)**

1. Back up all Flow-custom files:
   ```bash
   # Back up custom perspectives
   cp -r .claude/skills/perspectives/life-tracker /tmp/flow-backup/
   cp -r .claude/skills/perspectives/prep-scout /tmp/flow-backup/
   # ... all 12 custom perspectives

   # Back up custom phase files
   cp .claude/skills/orient/phases/perspectives.md /tmp/flow-backup/orient-perspectives.md
   # ... all custom phases

   # Back up context
   cp .claude/skills/perspectives/_context.md /tmp/flow-backup/
   cp .claude/skills/perspectives/_groups.yaml /tmp/flow-backup/
   ```

2. Remove old CoR installation:
   ```bash
   # Remove CoR-managed files (guided by .corrc.json manifest)
   # Or: rm -rf .claude/skills/perspectives/ and let reinstall rebuild
   ```

3. Run new Claude Cabinet installer:
   ```bash
   npx create-claude-cabinet
   ```

4. Restore and migrate Flow-custom files:
   ```bash
   # Move custom perspectives to new paths with cabinet- prefix
   mv /tmp/flow-backup/life-tracker .claude/skills/cabinet-life-tracker
   # ... etc

   # Move context to briefing
   mv /tmp/flow-backup/_context.md .claude/briefing/_briefing.md

   # Migrate _groups.yaml content into committees.yaml
   # (manual merge — add Flow's custom groups to the generated committees.yaml)

   # Rename and restore custom phase files
   mv /tmp/flow-backup/orient-perspectives.md .claude/skills/orient/phases/cabinet.md
   # ... etc
   ```

5. Update Flow-custom file content:
   - Each custom perspective SKILL.md: update frontmatter keys
   - Each custom phase file: update terminology in content
   - `committees.yaml`: update member names to match renames

6. Verify:
   ```bash
   # Check all cabinet members are discoverable
   ls .claude/skills/cabinet-*/SKILL.md

   # Check infrastructure
   ls .claude/cabinet/
   ls .claude/briefing/

   # Check no stale paths
   grep -rn "perspectives/" .claude/
   ```

**Option B: In-place migration via cor-upgrade**

Build a migration script into the `cor-upgrade` skill that:
1. Detects old directory structure
2. Moves files to new locations
3. Renames frontmatter keys
4. Updates `.corrc.json` manifest
5. Reports what it changed

This is more complex to build but better for future users who upgrade.
**Recommendation:** Do Option A for Flow now (it's one project), build
Option B into cor-upgrade for the general case later.

### 5D: Flow Migration Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Custom phase content lost | Low | High | Back up everything first |
| Perspective activation breaks | Medium | Medium | Test orient + debrief after migration |
| API calls in perspectives fail | Low | Low | API endpoints don't change, only file locations |
| cor-upstream-guard blocks valid edits | Medium | Low | Regenerate .corrc.json manifest |
| Memory files reference old paths | Low | Low | Memory files don't hardcode .claude/ paths |
| Hooks reference old paths | Medium | Medium | Verify session-start.sh, all hooks |
| Custom _groups.yaml entries lost | Low | High | Manual merge into committees.yaml |
| Monolithic _context.md content lost | Low | High | It becomes _briefing.md — direct rename |

### 5E: Flow Migration Timing

1. Land the Claude Cabinet restructure in the upstream repo
2. Publish to npm as `create-claude-cabinet`
3. Migrate Flow using Option A (clean reinstall + restore)
4. Verify Flow works: run `/orient`, trigger a few cabinet members, run `/debrief`
5. Later: build general-purpose migration into `cor-upgrade`

---

## Part 6: Commit Strategy

**Single atomic commit** for the upstream restructure. Rationale: splitting
would leave the codebase in an inconsistent state between commits (some files
referencing old paths, others new). One commit, one `git bisect` target.

**Separate commit** for Flow migration (different repo).

**Separate commit** for npm publish (after verification).

---

## Part 7: What's NOT Changing

To be explicit about what stays the same:

- **Skeleton/phase pattern** — unchanged, just some phase files renamed
- **SKILL.md as discovery mechanism** — unchanged
- **`.corrc.json`** — filename stays (cor- prefix kept)
- **`cor-upstream-guard.sh`** — filename stays
- **`cor-drift-check.cjs`** — filename stays
- **`cor-upgrade`** skill name — stays
- **`cor-health`** cabinet member name — stays
- **Hook architecture** — unchanged
- **Session loop** (orient/debrief) — unchanged behavior
- **Individual cabinet member domain logic** — unchanged (just terminology in prose)
- **Scripts** (merge-findings.js, pib-db.js, etc.) — paths may update but logic unchanged
- **Memory system** — unaffected
- **Claude Code settings.json** — unaffected

---

## Part 8: Post-Restructure TODO (not in this commit)

These are planned future work, noted here so they don't get lost:

- [ ] Build 7 new cabinet members: goal-alignment, information-design,
      user-advocate, ui-experimentalist, vision, framework-quality, gtd
- [ ] Build pre-built variant: mantine-quality (PAIR with framework-quality)
- [ ] Build general-purpose migration into cor-upgrade for future users
- [ ] Rename GitHub repo from `claude-on-rails` to `claude-cabinet`
- [ ] Set up npm redirect from old package name to new
- [ ] Update `~/.claude/cor-registry.json` schema if needed
- [ ] Evaluate whether `cor-` prefix should become `cc-` (low priority)
