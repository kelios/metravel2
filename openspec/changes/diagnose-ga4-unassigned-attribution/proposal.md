## Why

Task #2659 reports 169 Unassigned sessions out of 516 for property 362328641; the existing report cannot identify their source, landing page or stream. Its current inclusive `NdaysAgo`–`today` range also differs from the stated N completed days, so causal conclusions require a reproducible baseline first.

## What Changes

- Add a live GA4 channel diagnostic mode with source/medium, landing page, device, platform and stream, human-readable and JSON output, report completeness and privacy metadata.
- Use exactly N completed property-calendar days and expose the actual reporting period; preserve existing totals, event reports and authentication.
- Separate GA-only UI source and application identity parameters from GA campaign/session parameters, and deliver the first GA page view before queued custom events without losing or duplicating Metrika delivery. Live baseline contains UI labels such as `quest_detail` and `travel_detail` as session sources.
- Inventory first-party UTM producers, centralize an allowed medium vocabulary, and prevent new unrecognized first-party values through regression coverage. Change emitted values only where the inventory and GA4 channel rules establish a defect, retaining source/campaign and existing supplied attribution.
- Record observed causes separately from hypotheses, and track a seven-complete-day production recheck against the <10% Unassigned target.

## Capabilities

### New Capabilities

- `ga4-attribution-diagnostics`: reproducible channel diagnostics and governed first-party attribution labels.

### Modified Capabilities

None.

## Impact

- Goal: explain the observed Unassigned rows and correct confirmed first-party attribution defects; later measure Unassigned sessions / total sessions <10% on the deployed reporting window.
- User-visible result: no interface change; operators gain diagnostic attribution evidence and normalized future links.
- Platform impact: desktop web | mobile web for generated links and any proven web analytics defect; Android/iOS native analytics remain disabled. WebView-hosted pages are considered web.
- Localization impact: none; no app-owned visible copy or locale formatting changes.
- Ownership: `scripts/fetch-ga4-stats.js`, focused report helpers/tests if needed, UTM builders/constants and their tests, `utils/analytics.ts`, `utils/analyticsInlineScript.ts` and focused analytics tests, `docs/GROWTH_PLAN.md`, this change. Backend/email source remains read-only.
- Data/API: additive diagnostic output from GA4 Data API; completed-day interpretation is an intentional reporting correction. No product API or backend contract changes.
- Dependencies: working read-only GA4 access; production deployment and seven completed days plus data-processing allowance for the final metric gate.
- Fallback/mock policy: fixture tests are allowed, but cannot replace live baseline or production acceptance. Permission/API failures remain explicit errors; empty/thresholded results do not become a passing zero.
- SEO, accessibility and visual performance: no routes, metadata, media, UI or layout changes. Security: retain secret-safe credentials; avoid publishing token-bearing landing URLs. Analytics: preserve consent, automation suppression, queue delivery and disabled native transport.
- Existing behavior to preserve: totals/event CLI modes, share URL path/query/hash and supplied UTM, campaign identity, analytics consent and sensitive-URL redaction.
- Non-goals: native SDK/backend proxy, consent redesign, custom GA4 channel reclassification to conceal unknown traffic, bot attribution without evidence, backend/mail mutations and historical-data rewrites.
- Open questions: none blocking implementation. The actual cause distribution is an investigation output, not a presumed prerequisite or invented conclusion.
