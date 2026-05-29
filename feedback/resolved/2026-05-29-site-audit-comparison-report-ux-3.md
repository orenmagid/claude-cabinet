---
type: field-feedback
source: claudeconsult-maginnis
date: 2026-05-29
component: site-audit-runtime (report.mjs + diff.mjs + orchestrator.mjs)
---

## Comparison HTML report is unusable as a client deliverable

**Friction:** The comparison report has structural UX problems that
make it confusing to read and inadequate as a deliverable:

### Problem 1: Findings not split by site in a scannable way

The report lists checks sequentially — "Security Headers" (Site A),
then "Security Headers (Site B)" as separate collapsed sections. You
have to mentally diff two separate lists. In a comparison report, the
natural layout is side-by-side: one row per finding, columns showing
which site(s) it affects. The current layout forces the reader to
scroll between two separate sections to understand what's different.

### Problem 2: Comparison table has no drill-down

The top comparison grid (Check / Site A / Site B / Delta) is good as
a summary, but there's no connection between the scores and the
findings below. Clicking a row in the comparison table should scroll
to (or expand) that check's detail section. Currently these are
disconnected.

### Problem 3: Data is severely thinned during normalize()

Lighthouse produces rich structured data: per-category scores
(performance, accessibility, best-practices, SEO separately),
screenshot thumbnails, filmstrip, detailed audit descriptions with
"learn more" links, affected DOM elements, resource URLs, timing
breakdowns. The normalize step reduces all of this to:
`{severity, message, context?}`.

What's lost:
- **Per-category Lighthouse scores** (the report shows only the average)
- **Affected elements/URLs** (which specific elements have contrast
  issues? which scripts are render-blocking?)
- **Audit descriptions** (what does "Network dependency tree" mean?
  the report gives zero context)
- **Resource details** (what's the unused CSS? which JS bundle?)
- **Screenshots/filmstrip** (not expecting these in v0.1, but the
  raw data has them)

For a client deliverable, "serious: Reduce unused JavaScript" with
no detail on *which* JavaScript is useless. The Lighthouse JSON has
`details.items[]` with exact URLs and byte savings per resource.

### Problem 4: JSON output only contains Site A data

The comparison mode writes a single JSON file containing only the
first site's report. The diff/delta structure (with both sites'
results) is used for HTML rendering but never persisted. If someone
wants to post-process or build a custom report from the JSON, they
only have half the data.

### Problem 5: No executive summary

A client-facing comparison report needs a 2-3 sentence summary at
the top: "Site B outperforms Site A on 4 of 6 scored dimensions,
with major improvements in performance (+21) and security (+50).
Site A leads in DNS configuration and structured data." The report
jumps straight into the grid with no interpretation.

### Problem 6: "No findings" is ambiguous

When a check passes with zero findings (e.g., Structured Data 100/100),
the detail section shows "No findings." This reads as "nothing was
checked" rather than "everything passed." A passing check should show
what was validated: "Found 3 JSON-LD objects, all valid" or "All 5
security headers present" — positive confirmation, not absence.

### Problem 7: Findings that both sites share aren't highlighted

In a comparison, the most useful signal is: what's unique to each
site? The report doesn't distinguish shared findings (both sites
missing CSP) from site-specific ones (only Site A missing HSTS).
A comparison report should call out: "Shared issues (both sites)",
"Site A only", "Site B only."

**Suggestion:** The report template needs a significant redesign for
comparison mode. The single-site report is adequate (expandable cards
are fine). But comparison mode needs:
1. Side-by-side layout per check (or at minimum, shared/unique split)
2. Executive summary with narrative interpretation
3. Richer finding data — at least preserve `details.items[]` from
   Lighthouse and equivalent from other tools
4. The delta JSON should persist both sites' full results
5. Positive confirmation on passing checks (what passed, not "nothing")

**Session context:** First comparison run for Maginnis Howard demo
prep (feeshame.com vs staging). The report opened in a browser and
was immediately confusing — had to explain verbally what the findings
meant rather than letting the report speak for itself.
