---
type: field-feedback
source: claudeconsult-maginnis
date: 2026-05-28
component: cabinet (new skill proposal)
---

## Site-audit cabinet skill — Lighthouse + comparison mode

**Friction:** No built-in way to run a site quality audit (Lighthouse,
accessibility, security headers, SEO) against a deployed URL, or to
compare two URLs side-by-side (e.g., new platform vs existing site).
This came up during demo prep where a concrete scored comparison would
be a powerful client deliverable.

**Suggestion:** New cabinet skill: site-audit (or /audit site subcommand).
Core tools to bundle: Lighthouse (perf/SEO/a11y/best-practices), axe-core
(deep WCAG 2.1 AA), security headers check (CSP, HSTS, X-Frame-Options),
meta/OG tag validation, broken link checker, Core Web Vitals (LCP, CLS,
INP). Two modes: single-site audit and comparison mode (URL A vs URL B
with side-by-side scored output). Triggered by "/site-audit" or
"/audit site". Output is a scored report with specific findings.

**Session context:** Maginnis Howard demo prep — want to compare new
mass-arb platform against feeshame.com to show measurable improvements.
