# Member Selection — Which Cabinet Members to Run

Define how the audit selects which cabinet members to run. The /audit skill
reads this file before spawning cabinet member agents.

When this file is absent or empty, the default behavior is: discover all
cabinet members from `skills/cabinet-*/SKILL.md`, present committees if
`committees.yaml` exists, otherwise run all. To explicitly skip member
selection (and run no audit), write only `skip: true`.

## What to Include

Define your selection strategy:
- **Discovery** — where to find available cabinet members
- **Grouping** — how cabinet members are organized (committees, tiers, categories)
- **Default set** — what runs when no specific request is made
- **Selection interface** — how the user chooses (menu, flags, auto)

## Example Strategies

Uncomment and adapt for your project:

<!--
### Run All (simplest)
Discover all cabinet members in `skills/cabinet-*/SKILL.md`.
Run every one. Good for small projects with few cabinet members.

### Committee-Based Selection
Read `cabinet/committees.yaml` for committee definitions.
Present committees to the user:
  1. ux — accessibility, small-screen
  2. code — technical-debt, architecture
  3. health — security, data-integrity, speed-freak
  4. process — workflow-cop, record-keeper

Cross-portfolio cabinet members (marked in committees.yaml) always run
regardless of committee selection.

### Targeted Audit
Accept a cabinet member name or committee as an argument:
  /audit security          — run only the security cabinet member
  /audit --committee health — run the health committee
  /audit --all             — run everything
-->
