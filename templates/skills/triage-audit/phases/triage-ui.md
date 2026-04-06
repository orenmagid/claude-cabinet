# Triage UI — How to Present Findings

Define how findings are presented for human triage judgment. The
/triage-audit skill reads this file after loading findings.

When this file is absent or empty, the default behavior is: start the
local triage server, POST findings with commentary, tell the user to
open the browser UI. Fallback: present in conversation. To explicitly
skip UI presentation, write only `skip: true`.

## What to Include

Define your triage interface:
- **Primary UI** — how findings are presented (browser, CLI, external tool)
- **Commentary** — how Claude's assessment is included with each finding
- **Fallback** — what to do if the primary UI isn't available

## Default Behavior

1. **Prepare commentary** for each finding:
   - Your assessment of severity and importance
   - Suggested fix approach and estimated effort
   - Relationship to other findings (shared root cause?)
   - Relationship to open work (already being addressed?)

2. **Start triage server:**
   ```bash
   node scripts/triage-server.mjs --port 3847
   ```

3. **POST findings** to `http://localhost:3847/api/findings` with
   commentary attached to each finding

4. **Tell user** to open `http://localhost:3847` in their browser

5. **Wait for verdicts** — poll `GET /api/verdicts` until the user
   submits their decisions

## Important

Never summarize away findings. Every item must be visible with full
context: title, description, assumption, evidence, question, and
commentary. The user needs the complete picture to make good triage
decisions. Abbreviated or summarized findings lead to uninformed
verdicts.

## Example Override

Uncomment and adapt for your project:

<!--
### CLI-Only Triage
Present findings in the conversation, grouped by cabinet member.
For each group, show findings severity-ordered and ask for verdicts.
Useful when browser access isn't available.

### External Triage Tool
POST findings to an external triage dashboard:
```bash
curl -X POST https://your-app.example.com/api/triage/session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d @findings-with-commentary.json
```
Tell user to open the external dashboard URL.
-->
