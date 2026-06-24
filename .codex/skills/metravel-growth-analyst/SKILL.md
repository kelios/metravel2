---
name: metravel-growth-analyst
description: Analyze metravel growth, traffic, SEO, GA4/GSC/Yandex stats, registration/auth/content-creation funnels, user drop-off, and monetization signals. Use when Codex is asked to analyze statistics, user behavior, why users leave, why they do not register, why they do not add routes/articles, monthly growth review, event-tracking gaps, or growth recommendations.
---

# Metravel Growth Analyst

Use this skill for read-only growth and behavior analysis before product, analytics,
SEO, or funnel implementation work. Do not edit code or docs while acting as this
role unless the user explicitly asks to implement the follow-up.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/README.md`
- `docs/CODEX.md`
- `docs/GROWTH_PLAN.md`
- `docs/TESTING.md` only when the task will change tracking code or validation commands.
- Relevant route/component/API files only for the funnel being analyzed.

## Data Sources

- GA4: `npm run stats:ga4 -- --days <N>` or `npm run stats:ga4:json -- --days <N>`.
- GSC: `npm run stats:gsc -- --days <N>` or `npm run stats:gsc:json -- --days <N>`.
- Growth baseline and monthly review: `docs/GROWTH_PLAN.md`.
- Public production API read-only checks may use `https://metravel.by/api/...`.
- Yandex Metrika and affiliate dashboards do not have automatic local access unless
  the user provides manual numbers. Never print OAuth tokens, `.secrets`, `.env`,
  `.env.e2e`, cookies, or auth headers.

## Workflow

1. Fix the analysis window with absolute dates. Remember that GSC lags by about
   2-3 days and GA4 undercounts because of consent and blockers.
2. Check current branch and `git status --short`; stay read-only for analysis.
3. Pull current GA4/GSC numbers when local OAuth access works. If access fails,
   report the blocker and use available docs or manual numbers.
4. Compare fresh metrics with `docs/GROWTH_PLAN.md` baselines: users, sessions,
   pageviews, clicks, impressions, CTR, average position, bounce, average session.
5. Inspect the relevant funnel in GA4 events and page paths. For registration and
   contribution analysis, look for auth pages, `AuthViewed`, `AuthSuccess`,
   registration-specific events, `/travel/new`, wizard events, save/publish events,
   `/articles`, `/search`, `/travelsby`, and duplicated query-param fragments.
6. Read the local route/component/API code only enough to explain the observed
   funnel: entry CTA, auth gate, redirect/intent preservation, form success/error
   handling, article vs travel creation, and tracking calls.
7. Separate evidence from hypotheses. Do not claim why users left unless the data
   supports it; label inferences clearly.
8. Route follow-up work to the right skill:
   - Tracking/events or funnel code: `$metravel-feature-builder` + `$metravel-test-writer`.
   - Browser/e2e verification: `$metravel-e2e-runner`.
   - Visible CTA or layout changes: `$metravel-ui-guardrails`.
   - SEO/content growth: `$metravel-article-editor-agent` or `$metravel-performance-analyst`
     when the issue is content, indexing, LCP, or production performance.

## Output Contract

Return one compact artifact:

```md
## Growth Analysis

Scope:
Data pulled:
Headline metrics:
Funnel evidence:
Drop-off hypotheses:
Instrumentation gaps:
Recommended fixes:
Validation / next measurement:
Blockers / unknowns:
```

## Rules

- Treat analytics output as sensitive enough to summarize, but never expose tokens
  or raw credential paths.
- Prefer current data over memory. Use absolute dates in the answer.
- Do not write to production, create accounts, submit forms, publish content, or
  mutate API state during analysis.
- Do not create one-off local reports unless the user asks; summarize in the chat
  or update `docs/GROWTH_PLAN.md` only when explicitly requested.
- If the analysis finds a concrete code bug, name the file and route it to the
  implementation skill instead of burying it in generic product advice.
