## Why

After #3011 removed the duplicate hydrated article read, human readers no longer reliably produce a view event. Backend #3336 provides an explicit human-view endpoint, but the client does not call it and renderer requests do not identify themselves (#3362).

## What Changes

- Send one bodyless `POST /api/travels/<id>/view/` after an article is committed and focused, after session restoration. Rerenders and StrictMode replay do not duplicate it; a new visible visit may send another event.
- Reuse web cookie/CSRF and native secure-token authentication, with a caller-selected policy disabling every transport retry. Ignore failures without changing the displayed counter.
- Mark every request through both renderer transports with `X-Metravel-Render: ssr`, including their existing bounded retry.
- Preserve hydrated/preloaded detail reuse, by-slug behavior, server-owned 24-hour identity deduplication, and existing transport defaults for other callers.
- Repair the blocking release-guard contract through exclusive named-chunk Brotli modes (full exact bytes or legacy normalized KiB), a mode-preserving updater and truthful retained-canonical provenance. Tighten exact entry/home pins to verified retained bytes without increasing other ceilings or changing application/compiler inputs.

## Capabilities

### New Capabilities

- `human-travel-view-events`: visible human article events, authenticated/guest transport, silent failure, and renderer exclusion.

### Modified Capabilities

- `web-startup-payload-budget`: explicit named Brotli mode selection and portable retained-reference calibration alongside historical provenance.

## Impact

- **User-visible result:** real readers contribute to author view counts and popularity ordering. No visible UI, copy or optimistic counter update is added.
- **Platform impact:** shared; desktop web, mobile web, Android and iOS consume the same article block. Runtime evidence targets web cookie/CSRF and one representative Android emulator Token-auth/focus branch; iOS has no separate changed implementation.
- **Localization impact:** none; no app-owned text or locale formatting changes.
- **API/data:** bodyless POST returns 204, or 404 for hidden/unknown articles. Existing GET DTO/query keys/cache policy remain unchanged; `countUnicIpView` remains server-owned.
- **Dependencies:** read-only backend #3336 contract and deployed endpoint. Authors, service user agents and a previously used identity can return 204 with +0; existing deployment evidence does not prove a new counter event.
- **Fallback/mock policy:** network/OS boundaries may be mocked for code tests. Production acceptance uses the real endpoint and a controlled public article/non-author reader; no client fallback counter or mock-only completion.
- **SEO:** renderer marking prevents service traffic from being counted; URLs, metadata, redirects, JSON-LD, sitemap and robots do not change.
- **Accessibility:** not applicable; rendered semantics and interactions do not change.
- **Performance:** one small post-commit request per visible visit; no duplicate detail fetch or new eager shared-entry dependency. The release prerequisite migrates the named entry to full exact Brotli enforcement and tightens entry/home exact pins to 232602/480437 B from eligible retained source `39c7ab584e03b323218ba38c39aa96074e6c0f0a`; all other numeric ceilings remain unchanged. It does not replace the original runtime or bilateral acceptance gates.
- **Security:** preserve HttpOnly cookie plus existing CSRF helper on web and secure Token storage with omitted cookies on native. Human requests never inherit the renderer marker.
- **Analytics:** only the explicit backend view event changes; existing analytics events remain intact.

## Non-goals

Backend counting/history/cache rules, historical counter repair, client 24-hour deduplication, API refetch/cache invalidation, authored article content, UI/media changes, store operations and unrelated transport refactors.

## Open Questions

None. Production +1/repeat +0 and service +0 remain required acceptance evidence after code review and publication.
