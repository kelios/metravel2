## Context

See proposal.md for intent. Existing `scripts/fetch-ga4-stats.js` reuses `scripts/lib/google-token`; it queries totals, top channels and optional events, but currently includes today. Live baseline in ignored `.codex-temp/task-2659/` reproduces 169/516 and contains application UI names as `sessionSource`; detailed rows total 171, proving detail summation is unsuitable for acceptance. `utils/analytics.ts` fans out application payloads and queues early events; `utils/analyticsInlineScript.ts` configures GA and manually reports SPA page views. Share builders reuse `utils/urlParams.ts` and currently emit `badge_share` / `quest_result`.

## Goals / Non-Goals

**Goals:** preserve provider boundaries, provide trustworthy diagnosis, centralize first-party campaign medium semantics, and make the future acceptance window reproducible.

**Non-Goals:** UI redesign (no visible change), native SDK setup, consent redesign, historical rewriting, backend/email mutation or unproven bot classifications.

## Decisions

1. **Report contract and reuse.** Extend the existing script rather than add another credential/report client. Keep totals/events and add `--channel-breakdown`; accept `--start-date YYYY-MM-DD --end-date YYYY-MM-DD` together for fixed comparisons. `--days N` means N complete days with GA relative boundaries `NdaysAgo` to `yesterday`; explicit dates override the default-day mode. Resolve displayed dates using response `metadata.timeZone`, not the shell time zone. Reject ambiguous explicit `--days` plus fixed dates if both are supplied. Export pure/parser/request seams for focused fixtures rather than executing authentication on import.
2. **Aggregation layers.** Fetch unfiltered totals and independently filtered Unassigned totals; separately query source/medium aggregates and detailed six-dimension rows filtered to Unassigned. Compute share only from independent totals. Page through rows using `rowCount` and stable ordering, and mark any incomplete report. Never derive per-source counts by adding landing/device rows. Keep the original GA placeholder values visible.
3. **Data limitations.** Retain each report's response metadata, including `emptyReason`, `subjectToThresholding`, `dataLossFromOtherRow`, `samplingMetadatas` and any `dataTruncationReasons`. Zero sessions yields a nullable/unavailable percentage and explicit no-data message. API failures fail visibly. Unit fixtures cover these states; mocks never substitute for live evidence.
4. **Provider-specific parameters.** Map source→ui_source, client_id→metravel_client_id and session_id→metravel_session_id only at the GA transport boundary, including queued events. Preserve original payload for Metrika, DOM/internal listeners and dedup signatures. Renaming application context globally was rejected because it would regress existing provider consumers while failing to establish a GA-specific boundary.
5. **Provider delivery state.** Track delivery per provider so an event already delivered to Metrika can wait for GA without replaying Metrika. Configure GA and queue its first sanitized page_view before flushing GA custom events. A single shared delivered flag was rejected because provider readiness differs. Retain existing URL redaction, consent, native suppression and webdriver exclusions; no new native analytics implementation.
6. **UTM vocabulary.** One shared constant vocabulary feeds link and card builders. Select GA-recognized medium values for genuinely defective first-party labels, preserve source/campaign discrimination and existing supplied attribution, and test producers against the vocabulary. Do not rewrite external/backend URLs or add UTM to internal navigation. Baseline determines whether UTM defects materially explain the current aggregate; do not claim a change to sharing alone explains the 169 sessions.
7. **Temporal gate.** Baseline is fixed 2026-09-19–2026-10-18. First acceptance day is the property-calendar day after the confirmed deployment; use seven full days and allow 48 hours after the window closes for processing. For deployment on 2026-10-19 and Europe/Minsk property time zone, window 2026-10-20–2026-10-26 can first be checked on 2026-10-29 property-local midnight. Record actual deploy timestamp, exact window, current 32.75% baseline, threshold <10%, and the recheck trigger. Thresholding/data loss/missing sessions prevents an unconditional pass. Source attribution of residual `(not set)` traffic remains unknown unless independent evidence establishes a cause.

## Risks / Trade-offs

- Correct attribution only affects future collected data → preserve raw baseline, distinguish immediate transport proof from the seven-day metric gate.
- GA readiness does not imply the downloaded library already sent network traffic → verify queued command order in unit tests and inspect real collection requests after production deployment.
- Event identity fields are an application contract in other providers → namespace only GA, cover immediate and staggered queued delivery.
- New channel rules are external semantics → document selected medium meanings and retain campaign identity rather than fabricate a channel.
- Sensitive URLs can appear in analytics → use landingPage without query strings, retain application redaction and keep raw temporary evidence ignored.
- Reports are read-only but can consume quota → paginate narrowly with Unassigned filters and no uncontrolled retries. Additional report requests occur only in diagnostic CLI mode; no web-bundle/reporting dependency added.

## Migration Plan

Ship the reviewed analytics/report/UTM changes together through the existing frontend pipeline. Document the completed-day reporting correction and renamed GA custom parameters; preserve existing product URLs and events. Roll back only task-owned frontend changes if collection regresses; already collected GA history is immutable. Backend source and configuration remain read-only.

## Validation Matrix

| Surface / consumer | Code-level review stage | Testing stage |
| --- | --- | --- |
| CLI / GA4 | Fixture tests for arguments, dates, independent counts, pagination, JSON/text and limits; scoped lint | Live property 362328641 baseline and replay with fixed dates |
| Desktop web | Analytics transport/inline tests including sanitized initial page view and provider readiness | Production collection payload/order and console; preserve guest consent and automation exclusion |
| Mobile web | Same shared transport tests plus share link/card fixtures | Production mobile viewport collection payload/order and console |
| Metrika / internal consumers | Original parameter names and exactly-once provider tests | Confirm preserved observer payload when available; no production event-spam loop |
| Android / iOS | Native no-op regression where already covered | No device gate: native analytics/config/runtime unchanged |
| RU/BE/UK/PL/EN | No localized UI changes; i18n N/A | No locale-specific test matrix required |
| SEO / accessibility / media | N/A: no layout, media, route or metadata diff | N/A |

## References

- [GA4 date ranges](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/DateRange): inclusive property-calendar boundaries.
- [GA4 response metadata](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/ResponseMetaData): time zone, empty/threshold/sampling/truncation limitations.
