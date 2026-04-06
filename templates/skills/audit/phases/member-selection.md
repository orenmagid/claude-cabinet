# Member Selection — Which Cabinet Members to Run

Define how the audit selects which cabinet members to run. The /audit skill
reads this file before spawning cabinet member agents.

When this file is absent or empty, the default behavior is: discover all
cabinet members from `skills/cabinet-*/SKILL.md`, run
`node scripts/resolve-committees.js` to merge upstream `cabinet/committees.yaml`
with project `cabinet/committees-project.yaml`, present merged committees,
otherwise run all. Cross-portfolio members always run regardless of selection.
To explicitly skip member selection (and run no audit), write only `skip: true`.

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
Run `node scripts/resolve-committees.js` to merge upstream
`cabinet/committees.yaml` with project `cabinet/committees-project.yaml`.
Present merged committees to the user.

Cross-portfolio cabinet members (standing-mandate in SKILL.md) always run
regardless of committee selection.

### Targeted Audit
Accept a cabinet member name or committee as an argument:
  /audit security          — run only the security cabinet member
  /audit --committee health — run the health committee
  /audit --all             — run everything
-->
