## Why

When the catalog-links API fails, `/search` deliberately renders page 1 with HTTP 200 but without its article-link block. The renderer currently provides no signal that this document is incomplete, so the existing backend cache rule cannot distinguish it from a complete catalog (#3363).

## What Changes

- Emit `X-Metravel-Search-Catalog-State: degraded` on the renderer response when page 1 falls back without catalog links.
- Preserve the first-page `null` payload and HTTP 200 fallback, successful responses without the marker, and existing later-page refusal semantics.
- Prove the loader-to-response contract and concurrent/sequential request isolation with focused unit tests.
- Non-goals: backend, nginx, gateway/cache logic, catalog API, visible catalog navigation, copy, i18n, native behavior, or bundle-budget changes.

## Capabilities

### New Capabilities

- `search-catalog-render-state`: Renderer response marker for an incomplete first catalog page, with success and isolation controls.

### Modified Capabilities

None.

## Impact

- Affected source: server-only search catalog-links loader and focused loader/response tests; reuse the existing Expo request-local response-header transport.
- API/data: adds one renderer response header; loader payload and API requests remain unchanged. Backend #3279 is a read-only dependency that consumes and hides the marker; no new backend behavior is assumed.
- Platform impact: desktop web and mobile web server HTML; Android/iOS none.
- Localization impact: none; no app-owned or editorial text changes.
- User-visible impact: no layout change; prevents incomplete HTML from being treated as a complete cached catalog by the existing backend contract.
- SEO: carries catalog completeness to the cache boundary without altering canonical URLs or robots metadata.
- Accessibility, security and analytics: no new behavior or data; request isolation is a required regression control.
- Performance: no new fetch or client dependency; no change to existing browser bundle budget pins.
- Fallback/mock policy: preserve production fallback semantics; mock only catalog API transport in unit tests, use the real Expo response scope for header assertions. Production acceptance uses normal real `/search` HTML without an injected failure; public marker absence alone cannot prove the internal producer because nginx hides it.

Planning is reviewed and validated before apply under the existing implementation authorization. The delivery owner retains independent review, publication and production acceptance.
