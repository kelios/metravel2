## Why

#3436: GPX profiles arrive after the reader reaches the route map and push visible route points down (production CLS 0.39 mobile / 0.23 desktop). Backend #3435 now exposes `route_track_files_count` in article details, so the initial article tree can reserve space without another request.

## What Changes

- Reserve profile space from article data in the deferred map placeholder and first route-block frame; keep it through list loading, deferred parsing and the chart chunk's Suspense fallback.
- Track completion for the current travel/file snapshot; release surplus via the existing measured-flow shrink rule, preserving `overflow-y: clip` and immediate profile visibility.
- Treat absent/invalid/zero counts as no reserve. Preserve native rendering and request timing.
- Restore route-block CLS accounting for article 544 and add source-level regressions.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `travel-deferred-flow-stability`: reserve route profile geometry before asynchronous work begins, then release surplus without moving visible content.

## Impact

- Frontend only: Travel type/normalization, deferred map placeholder, route block, preview readiness, focused tests and Problem Memory. Backend #3435 is deployed and remains unchanged.
- Platform impact: mobile web and desktop web. Shared hook completion metadata does not change native rendering, requests or parsing.
- Localization impact: none; no new visible copy, SEO, accessibility actions, security or analytics changes. Empty reserve is hidden from assistive technology.
- Performance: no early/new API requests; production target CLS ≤0.1 with no route-point/route-map shift sources on the contracted fast-scroll runs. One file can produce several profiles; the existing measured growth rule remains for content beyond the file-count estimate.
- Non-goals: backend, article tail, scroll compensation for growth while reading the map, hidden profiles, native/store builds.
- Fallback/mock policy: old payload retains previous no-reserve behavior. Unit tests control transport timing with real normalization/parser; production acceptance uses real articles 544/470 and no-route 967.
- Delivery: the reviewed count-loader and SVG fixes are published in app `4c1de3a60d4ecfbf62d2ae60f46f541b0d9f3532`. Its fresh 45-case production matrix and controls pass; see tasks.md for the exact 43-original/2-resource-replacement provenance. The GET-only SSR/API count guard passed independent audit/final gate, scoped source checks and its three real production cases on that app. The newer test/docs source base and as-tested diff fingerprint are recorded separately; a committed test SHA will be assigned by the normal publication step. This test-only delta does not require app redeploy or repeating that matrix. More recent Map/API source is not claimed deployed. The installed CLI synchronized the accepted requirement and archived this change on 2026-11-16; final closure confirmation, normal commit/push and board completion remain pending.
