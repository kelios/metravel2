## Why

Monthly growth reviews currently require separate rolling-window GSC/GA4 commands and manual content counts; there is no reproducible twelve-month report with aligned calendar months, YoY comparisons and explicit measurement gaps. Task #2660 needs one owner-facing CLI report that joins these sources without presenting missing history or a trip date as a verified publication date.

## What Changes

- Add `npm run stats:summary` for the last twelve completed calendar months and the preceding twelve comparison months, with optional `--end-month`, `--property` and `--json` arguments.
- Include GSC, GA4, named product events, optional Yandex, a current production content snapshot and qualified monthly community approximations.
- Save readable Markdown under ignored `.codex-temp/metrics-summary/YYYY-MM-DD.md`, including generation date, absolute measurement window, provenance and gaps.
- Reuse existing Google authentication/request adapters and preserve their current CLI behavior.
- Document the command in the growth-plan sources section.

## Capabilities

### New Capabilities

- `monthly-metrics-summary`: source-backed monthly growth summary with qualified community history, safe missing-data handling and YoY.

### Modified Capabilities

None.

## Impact

- Goal/user-visible result: owner runs one command and receives a durable twelve-month Markdown report.
- Platform impact: none; local Node CLI only. Localization impact: none; operator reporting, no app UI text.
- Task-owned paths: `scripts/summarize-metrics.js`, `scripts/lib/metrics-summary.js`, `scripts/lib/metrics-summary-sources.js`, extracted optional-token helper `scripts/lib/yandex-token.js`, optional abort support in `scripts/lib/google-token.js`, `scripts/lib/google-oauth.js` and `scripts/lib/google-auth.js`, minimal reuse change in `scripts/analytics-health-check.js`, minimal exports in `scripts/fetch-gsc-stats.js` and `scripts/fetch-ga4-stats.js`, `__tests__/scripts/summarize-metrics.test.ts`, `package.json`, `docs/GROWTH_PLAN.md`, this change.
- Dependencies: Google OAuth/service-account permissions, correct GA4 property, public production travels/quests endpoints, optional Yandex access. Each inaccessible source is an explicit gap; other sources continue. Existing `scripts/lib/google-token.js`, `google-oauth.js` and `google-auth.js` receive a backwards-compatible optional signal so source deadlines also cancel token exchanges.
- Data/API: read-only collection; no new backend contract. Existing stats commands retain behavior. Missing/partial/unavailable data is never filled with mock metrics.
- SEO/accessibility: not applicable; no rendered pages or navigation changes. Performance: bounded/paginated requests with deadlines, no shipped bundle change. Security: existing ignored credentials only; no raw tokens, auth payloads or sensitive server errors in reports.
- Analytics: consumption only; named events are reported as observed counts, absence is not evidence of a broken emitter or conversion funnel.
- Non-goals: UI/backend changes, scheduling, revenue analysis, exact historical author acquisition/publication timelines unavailable from the current public catalogue, app/store builds.
- Open questions: none blocking. An unavailable source is handled by the specified gap contract.
