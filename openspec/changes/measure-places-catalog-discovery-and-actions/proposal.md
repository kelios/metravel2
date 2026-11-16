## Why

#3448: /places has 20 measured views from 10 users in the baseline, but no catalog-specific entry, search-result or action evidence. #3450 cannot distinguish discovery from successful use; /map analytics in #3044 describe a different surface.

## What Changes

- Measure actually visible desktop-navigation and open mobile-menu links, their activation and catalog opening with finite source attribution.
- Measure completed catalog searches (found/empty/error and result count), collection selection, map opening and related travel opening without search text, addresses, coordinates or raw URLs.
- Document repeatable GA4 and Metrika queries, session denominators, consent/coverage limits and the observation start.
- Non-goals: navigation order, visible UI/copy, catalog API, /map instrumentation, native analytics and growth conclusions before sufficient observations.

## Capabilities

### New Capabilities

- `places-catalog-analytics`: consent-aware web discovery-to-action measurement isolated from /map.

### Modified Capabilities

None.

## Impact

Platform impact: desktop web | mobile web. Localization impact: none; no app-owned copy changes.
Task-owned paths: places analytics utility/hooks; CustomHeaderNavSection; BottomDockMoreItem; usePlacesCatalogController; focused tests; analytics feature docs; this OpenSpec change; problem registry family.
API: unchanged. Data: new finite event contract and places_source URL parameter. SEO: canonical paths and page content unchanged. Accessibility: real navigation href and existing semantics retained. Performance: reuse existing observer and analytics transport; no new requests or dynamic import root. Security: no private text/coordinates/URLs in event payloads. Dependencies: none; #3044 is related, #3450 consumes observations. Fallback/mock policy: mock only targeted tests; acceptance uses real production catalog and published SHA.
