---
name: cc-site-audit
description: |
  Comprehensive quality audit for deployed websites. Runs 15 checks across
  performance, accessibility (3 engines), security (headers + TLS + CVE),
  SEO (meta/OG + structured data), content (broken links), DNS/protocol,
  privacy (tracker detection), and sustainability. Produces a standalone
  HTML report. Use when: "audit the site", "site audit", "compare sites",
  "/cc-site-audit".
user-invocable: true
argument-hint: "url, or 'compare <url-a> <url-b>'"
---

# /cc-site-audit — Deployed-Site Quality Audit

## Arguments

If `$ARGUMENTS` is provided:
- **A single URL** (e.g., `https://example.com`): Run a single-site audit.
- **`compare <url-a> <url-b>`**: Run both sites and produce a side-by-side
  comparison report with delta scoring.
- **Empty**: Ask the user for the URL to audit.

## Purpose

Audit a deployed website across 15 quality dimensions and produce a
standalone HTML report suitable as a client deliverable. The audit runs
external tools against the live site — it examines what users and search
engines actually see, not the source code.

## Prerequisites

The audit engine lives at `~/.claude-cabinet/site-audit/`. If the
runtime isn't installed, run the installer:

```bash
bash .claude/skills/cc-site-audit/install.sh
```

**Required:** Chrome or Chromium (for Lighthouse, axe-core, Pa11y).

**Optional tools** (checks skip gracefully if missing):
- `testssl.sh` — deep TLS/cipher analysis
- `nuclei` — CVE and exposed-file scanning (Go binary)
- Blacklight, Unlighthouse — installed by the runtime package

## Workflow

### 1. Preflight

Check the runtime version at `~/.claude-cabinet/site-audit/current/VERSION`.
If missing or stale (version doesn't match this skill's expected version),
warn the user and suggest re-running `install.sh`.

Verify Chrome is available:
```bash
which google-chrome || which chromium || which chromium-browser
```

### 2. Run the Audit

Invoke the engine:

**Single site:**
```bash
~/.claude-cabinet/site-audit/current/bin/cc-site-audit <url>
```

**Comparison:**
```bash
~/.claude-cabinet/site-audit/current/bin/cc-site-audit compare <url-a> <url-b>
```

**Flags:**
- `--out <dir>` — report output directory (default: `reports/`)
- `--overall-timeout <seconds>` — hard ceiling across all checks
- `--fixture-dir <path>` — CI mode: load pre-captured tool output instead of running live tools
- `--i-authorize-active-scan=<hostname>` — required for Nuclei (active vulnerability scanning)

### 3. Present Results

The engine prints a terminal summary and writes:
- `reports/site-audit-<domain>-<timestamp>.html` — standalone HTML report
- `reports/site-audit-<domain>-<timestamp>.json` — raw JSON data

Present the terminal summary to the user. Tell them where the HTML
report was written so they can open it in a browser.

### 4. Nuclei Authorization (Active Scanning)

Nuclei sends real exploit probes to the target server. It is legally
equivalent to unauthorized penetration testing if run against a site
you don't own.

**Never run Nuclei without explicit authorization.** Before passing
`--i-authorize-active-scan=<hostname>`:

1. Confirm the user owns or has written authorization for the domain.
2. Warn: "Nuclei sends real vulnerability probes. This can trigger
   IDS/WAF alerts and may violate computer fraud laws if unauthorized."
3. The user must explicitly confirm by stating the domain name.

Without authorization, Nuclei skips with `status: skip`.

## Checks (15 total)

### Tier 1 — Lightweight (always available)
| Check | Tool | What it measures |
|-------|------|-----------------|
| Performance + CWV | Lighthouse | LCP, CLS, INP, speed, best practices |
| Accessibility (AA) | axe-core | WCAG 2.1 AA violations |
| Security Headers | native fetch | CSP, HSTS, X-Frame, X-Content-Type, Referrer, Permissions |
| Header Correctness | MDN Observatory | CSP quality grading (A+ through F) |
| TLS Depth | testssl.sh | Cipher suites, protocol versions, CVEs (Heartbleed, POODLE...) |
| Meta & OG Tags | native fetch | title, description, canonical, Open Graph, Twitter Card |
| Structured Data | native fetch | JSON-LD/Schema.org validation |
| Broken Links | Linkinator | Dead links, images, scripts across the page |
| DNS & Protocol | dig + curl | DNSSEC, SPF, DMARC, HTTP/2+3 support |
| SSL Certificate | openssl | Validity, expiry, chain verification |

### Tier 2 — Deeper analysis
| Check | Tool | What it adds |
|-------|------|-------------|
| Accessibility (AAA) | Pa11y (HTMLCS) | WCAG 2.1 AAA + complementary rule engine |
| CVE Scan | Nuclei | Known vulnerabilities, exposed files, misconfigs |

### Tier 3 — Differentiators
| Check | Tool | What it adds |
|-------|------|-------------|
| Tracker Detection | Blacklight | Session replay, fingerprinting, keyloggers, ad trackers |
| Full-Site Crawl | Unlighthouse | Lighthouse scores for every page |
| Sustainability | Website Carbon | CO2 per pageview (local calculation) |

## Phase Files

Read `phases/` for project-specific customization:

| Phase | Absent = | What it customizes |
|-------|----------|-------------------|
| `checks.md` | All checks enabled | Enable/disable individual checks |
| `tools.md` | Auto-detect all | Which tools to attempt (e.g., skip Nuclei) |
| `thresholds.md` | No pass/fail budget | Score thresholds for pass/fail |
| `report.md` | Default HTML template | Report destination, branding |

## SSRF Caveat

This tool makes HTTP requests to arbitrary user-supplied URLs. If run
in an environment with internal services (CI runners, cloud instances),
a URL pointing to `http://169.254.169.254/` or internal IPs will fetch
those resources. The tool does not restrict target URLs — the user is
responsible for supplying appropriate targets.
