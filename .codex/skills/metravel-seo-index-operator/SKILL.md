---
name: metravel-seo-index-operator
description: Run metravel SEO/indexing operations and article-index diagnostics. Use when Codex is asked for daily SEO routine, GSC query/page digest, Google index status, IndexNow backup submission, thin-content/meta/internal-link SEO audit, or owner-ready Search Console indexing actions.
---

# Metravel SEO Index Operator

Use this skill for operational SEO and indexing. Use `$metravel-growth-analyst` for monthly growth strategy and `$metravel-article-editor-agent` for article API writes.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/GROWTH_PLAN.md` when growth priorities or monthly review are involved.

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
5. For Google indexing, produce an owner-ready list of up to 10 priority URLs for manual Search Console "Request indexing" when the public API cannot submit them.
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
