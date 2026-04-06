# Checks — What to Verify

Define what pulse checks for self-description accuracy. The /pulse skill
reads this file to know what to verify.

When this file is absent or empty, the default behavior is: run three
categories of checks (count freshness, dead reference spot-check,
staleness detection). To explicitly skip all checks, write only
`skip: true`.

## What to Include

For each check, provide:
- **What** — what to compare (documented value vs actual value)
- **How** — how to get the actual value (command, file read, count)
- **Auto-fixable** — can the discrepancy be corrected mechanically?
- **Category** — count freshness, dead reference, or staleness

## Example Checks

Uncomment and adapt for your project:

<!--
### Count Freshness

#### Skill Count
- Document: system-status.md says "N skills"
- Actual: `ls skills/*/SKILL.md | wc -l`
- Auto-fixable: yes (update the number)

#### Cabinet Member Count
- Document: system-status.md says "N cabinet members"
- Actual: `ls skills/cabinet-*/SKILL.md | wc -l`
- Auto-fixable: yes (update the number)

#### Hook Count
- Document: CLAUDE.md says "N hooks"
- Actual: count hooks in `.claude/settings.json`
- Auto-fixable: yes (update the number)

### Dead Reference Spot-Check

Pick 3-5 paths from documentation and verify they exist:
- CLAUDE.md references to scripts
- README.md references to directories
- Status file references to configuration files
- Phase file references to other files

### Staleness Detection

#### Status File
- Check: when was system-status.md last modified?
- Flag if: older than 7 days and there have been commits since

#### "As of" Dates
- Check: grep for "as of" in documentation files
- Flag if: the date is more than 30 days old
-->
