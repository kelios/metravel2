## Why

The owner needs actual Apple and Android downloads alongside web statistics. The existing monthly summary collects only `app_download_click`, so store acquisitions and web referrals cannot currently be distinguished. The recently released Apple app is also outside the default twelve completed months.

## What Changes

- Import official Apple Sales and Trends summary reports and Google Play monthly installation reports with explicitly recorded app identity, calendar and coverage.
- Add separately labelled initial Apple downloads, Apple redownloads, Google daily device installs and daily user installs to the report. Preserve exact source semantics rather than sum unlike store metrics.
- Retain the twelve completed months and expose imported current-period evidence separately with absolute dates. Missing, incomplete or conflicting evidence remains unavailable, never zero.
- Document repeatable export/import operation without creating persistent credentials or changing store records.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `monthly-metrics-summary`: include independently qualified store acquisition reports and current-period evidence.

## Impact

- User-visible result: owner statistics show verified store metrics alongside existing web measurements.
- Platform impact: none; owner CLI and reports only, no app runtime changes.
- Localization impact: none; report prose is operational documentation, no app-owned UI.
- Task-owned paths: `scripts/summarize-metrics.js`, `scripts/lib/metrics-summary*.js`, new store-report adapter and focused tests, `docs/GROWTH_PLAN.md`, this change and its living spec.
- Dependencies: existing authenticated store console access and official downloaded reports. No backend dependency. An expired Apple session can block current Apple figures, but not independently available Android evidence or explicit missing-source output.
- Fallback/mock policy: fixtures only for unit tests. No estimates, click substitution, fabricated zeroes or implied historical coverage.
- Data/API: additive report fields; read local official exports with a coverage manifest. No store write or credential expansion.
- SEO: the requested current listing/search audit is read-only; metadata publication and web SEO changes are outside this implementation.
- Accessibility/performance: no UI or app bundle changes.
- Security: ignored private inputs/outputs, bounded parsing, app/path validation, no raw upstream credentials or error payloads.
- Analytics: existing GA4/GSC/Yandex events, completed-month arithmetic and comparisons remain unchanged.
- Existing behavior to preserve: existing CLI flags, source independence, dated Markdown output and JSON output.
- Non-goals: store build/upload/submit, metadata edits, new API keys, permission grants, application code, protected configuration or backend changes.
- Rollback: revert task-owned report changes; original exports remain intact.
- Open questions: none affecting implementation; current Apple data depends on refreshed access.
