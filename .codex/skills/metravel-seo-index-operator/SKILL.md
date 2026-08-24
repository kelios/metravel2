---
name: metravel-seo-index-operator
description: Run metravel SEO/indexing operations and article-index diagnostics. Use when Codex is asked for daily SEO routine, GSC query/page digest, Google index status, IndexNow backup submission, thin-content/meta/internal-link SEO audit, or explicitly scoped Search Console indexing actions through an authenticated browser.
---

# Metravel SEO Index Operator

Use this skill for operational SEO and indexing. Use `$metravel-growth-analyst` for monthly growth strategy and `$metravel-article-editor-agent` for article API writes.

`AGENTS.md` is inherited. Load only the SEO/indexing operation contract and the
requested URL/data artifact; read `docs/GROWTH_PLAN.md` only for growth
priorities or monthly review.

## Workflow

1. State the exact date range with absolute dates.
2. Prefer project scripts for current data:
   - `npm run stats:gsc:json` for GSC clicks, impressions, CTR, position, queries, and pages.
   - `npm run stats:ga4:json` when GA4 is configured.
   - `npm run stats:index` when URL Inspection/index diagnostics are available.
3. If a stats script fails with auth/API errors, report the missing access or API enablement. Do not invent metrics.
4. Separate facts from hypotheses:
   - factual metrics
   - likely causes
   - owner-only actions
   - code/content tasks
5. For Google indexing:
   - when the request is analysis-only, produce an owner-ready list of up to 10 priority URLs;
   - when a board Task Contract or direct request names the URLs and the Search Console action,
     treat that as project-level authorization and complete URL Inspection / "Request indexing"
     through the available authenticated browser session without an extra project confirmation;
     keep that authorization limited to the named URLs and action;
   - require a direct HTTP 200 with zero redirects before submission, skip an already indexed URL,
     click at most once, and record `accepted` only after Search Console shows its success message;
   - stop on quota exhaustion and preserve every previously terminal outcome.
6. For IndexNow backup submission, use the existing project script if present; treat duplicate daily submission as harmless only when docs/scripts confirm it.
7. Route content fixes to `$metravel-article-editor-agent`; route code SEO fixes to `$metravel-feature-builder` and `$metravel-ui-guardrails`.

## Output

Return:

- date range and data sources
- top opportunities and regressions
- 10 priority URLs when indexing action is needed
- owner/backend/code task split
- commands run and blockers

Never expose service-account data, tokens, cookies, or raw private analytics exports.
