## Context

See proposal.md for the observed #3011/#3336/#3362 problem. Both article routes reach `TravelDetailsContainer`; web uses the loader payload when SSR is enabled, native renders the same container. `TravelDetailsContentBlock` in `TravelDetailsHeroDeferredColumn.tsx:95–112` is the shared article subtree, inside web Suspense and both native layouts. `TravelDetailsContainer.tsx:141` already uses route focus because screens can stay mounted offscreen.

`api/publicFetchWithSession.ts` owns web cookie/CSRF and native secure Token transport, but retries 401 anonymously. `utils/fetchWithTimeout.ts` also retries localhost proxy 502 for POST. Both must honor a view-specific no-retry policy; their existing defaults remain compatible.

The backend dependency is read-only #3336. It atomically deduplicates `user:<pk>` or guest IP+trimmed UA for 24 hours; authors/service requests can return 204 with +0. Authenticated history increments per event before counter deduplication, so duplicate POSTs are a real regression even when the counter stays unchanged. Evidence details: `.codex-temp/task3362/backend-contract-facts.md`.

## Goals / Non-Goals

**Goals:** bind one event to an actual focused article commit; reuse existing authentication; disable all retries for that event; mark both renderer transports; preserve unrelated request behavior and #3011 preload reuse.

**Non-goals:** see proposal.md. No backend edits, new dependency, schema migration, query invalidation, client deduplication clock, UI or media rewrite.

## Decisions

1. Add a small `useTravelView` owner hook inside `TravelDetailsContentBlock`. It waits for `authReady === true`, a focused route and a positive safe integer ID. `TravelViewVisitProvider` in the stable `TravelDetailsCriticalShell` owns the attempted-ID ref so responsive content ancestry changes cannot restart the same visit. The content hook still initiates the request only after its actual commit, including Suspense; the provider itself never sends an event. Real blur clears the ref even while content is unmounted, and a changed committed ID replaces it. StrictMode cleanup never clears it. This allows subsequent visits without retaining a global/day-wide read registry. An effect in the data loader/query was rejected because fetching, SSR and retained offscreen screens are not visible visits.
2. Add leaf `api/travelViews.ts`, imported only by this hook, using `API_BASE_URL`/`DEFAULT_TIMEOUT` and `fetchPublicWithSession`. Send POST without a body; consume no response JSON; catch errors and resolve silently. Add opt-in `{ retry: false }` through the existing session and timeout functions. Raw fetch/auth-header duplication and `apiClient` automatic refresh retries were rejected.
3. `fetchPublicRouteJson.ts` adds the SSR header to both internal and fallback fetch requests, preserving Accept/Host/forwarded protocol. `ssrApiTransport.js` snapshots incoming headers, removes case-insensitive renderer-header variants, adds the canonical marker and reuses the snapshot for its existing retry. Do not mutate inputs or change method, deadline, abort, status/error and retry limits.
4. Repair the mandatory internal-travel-links classifier for the new canonical API-base-prefixed endpoint. `RULES.md` excludes API endpoints from article page paths. Recognize actual canonical `api/apiConfig` named-import provenance, including a local alias and relative module path, with an exact API-base template head and trailing endpoint slash. Reuse installed TypeScript parsing and symbol identity lazily for canonical-import candidates, without a new dependency, external module resolution or custom lexical parser; this handles multiline interpolation and distinguishes a shadowed local from the import outside that local scope. Keep public/ad-hoc builders and stale literals enforced; keep the closed baseline unchanged. Rewriting the endpoint, exempting an API directory/file or rejecting every valid imported-base use merely because an unrelated function shadows its name was rejected.

## Affected Paths and Ownership

Client implementation: `api/travelViews.ts`, `api/publicFetchWithSession.ts`, `utils/fetchWithTimeout.ts`, `hooks/useTravelView.ts`, `components/travel/details/TravelDetailsHeroDeferredColumn.tsx`, `components/travel/details/TravelDetailsCriticalShell.tsx`.

Client tests: `__tests__/api/travelViews.test.ts`, `__tests__/hooks/useTravelView.test.tsx`, `__tests__/components/travel/TravelDetailsContentBlock.view.test.tsx`, `__tests__/utils/fetchWithTimeout.test.ts`. The existing `TravelDetailsContainer.skeleton.web.test.tsx` fixture supplies an explicit pre-restoration auth boundary for the new content hook, preserving its skeleton/hero/hydration assertions; root `AppProviders` supplies real/fallback AuthContext in the application on web, native and SSR.

SSR implementation: `utils/ssr/fetchPublicRouteJson.ts`, `scripts/lib/ssrApiTransport.js`. SSR tests: `__tests__/utils/fetchPublicRouteJson.test.ts`, `__tests__/scripts/ssrApiTransportHeaders.test.ts`, `__tests__/components/travel/travelRouteLoader.test.ts`. Existing SSR socket/lifecycle suites are validation consumers, not planned edits.

Mandatory guard dependency: `scripts/guard-travel-links.js` and `__tests__/scripts/guard-travel-links.test.ts`; this classifies the internal API endpoint without changing its spelling, the product link contract or exception baseline.

Planning: this change directory only. Backend, protected configuration, budgets and foreign changes remain outside these edit paths. The API leaf is not exported through a broad travel/shared barrel.

## Data, Security and Compatibility

Endpoint: `POST /api/travels/<positive-safe-integer>/view/`, no body; 204 success, 404 for invisible/unknown articles. All failure statuses are silent. No query keys, DTO fields, cache invalidation or `countUnicIpView` update is introduced.

Web uses existing credentials include and `getCsrfHeader`; native uses `getSecureItem(ACCESS_TOKEN_STORAGE_KEY)`, credentials omit and no CSRF. `authPlatform.ts:19–22,43–48` and `secureStorage.ts:191–260` expose web versus native, with no Android/iOS-specific branch for this event. Never attach renderer headers to human requests.

SEO URLs/canonicals/redirects/metadata/structured data and accessibility semantics do not change. Existing analytics stay intact. New request and imports remain article-local; fixed entry/home payload pins are not raised.

## Validation Selection and Stages

Code-level, coordinated under one root-owned quality lock: meaningful RED/GREEN tests exercising real hook/session/auth/CSRF/timeout functions with fetch and OS/navigation/auth-state boundaries mocked; invalid/loading/blurred/SSR/suspended states, StrictMode, ID changes, refocus and silent failure; web authenticated/guest and Android+iOS token cases; HTTP 401/local 502 no-retry and default retry preservation; SSR internal/fallback/header-conflict/retry/loader GET-only assertions. Then targeted lint, typecheck and scoped fast checks. No browser/API/device runtime during review.

Guard controls distinguish genuine imported API-base endpoints from public, unrelated, shadowed, commented or string-contained lookalikes, preserving stale-literal checks and the closed baseline. Run one complete `npm run check:fast -- --changed-files-file <explicit task manifest>` through the normal quality wrapper for the combined scope, including all mandatory guards. Retain compatible client/SSR/auth tests by exact source hashes; do not treat a dry selector, a skipped guard or a partial run as the complete fast result.

Testing after independent review and publication:

| Changed boundary | Required evidence | Omission / retest trigger |
| --- | --- | --- |
| Web cookie/CSRF and guest event | Production browser/network: one POST 204 per opening; authenticated CSRF; guest without 403; console and screenshots for the visited state | One representative viewport suffices for the event because rendering is unchanged; required bilateral slider gates below retain their selected responsive targets |
| Shared native Token/auth/focus | One Android emulator flow: actual article display, one Token POST, omitted cookies/no CSRF, real blur/refocus; record exact app revision | iOS simulator omitted because the changed focus/auth/storage APIs share the same native branch; add iOS runtime if an iOS-specific implementation changes or an explicit current release gate requires it |
| Real counter ownership | Controlled fresh public article, non-author human UA: `countUnicIpView` before/after +1; same identity reopening sends one new event with +0; renderer/service-only reads +0; delete fixture and verify absence | 204 alone is insufficient; never clear production caches/counters; a human-like controlled UA is required because default HeadlessChrome is service traffic |
| SSR transport | Published revision/source identity plus renderer request evidence for marker and unchanged raw article loading | Repeat if transport/header forwarding or deployed source changes |
| Details-path bilateral gate | `verify:slider` and `verify:slider-perf` in testing under operation policy | Required by RULES and spec-driven-development-requirements for any details-path change; budgets/thresholds unchanged |

RU/BE/UK/PL/EN have no resource or formatting changes; no locale runtime repetition is required. Passing compatible source tests may be reused post-deploy. Unrelated deployment does not invalidate them; changed auth/focus/transport/backend identity, a failed assertion or exact release scope does.

## Risks / Trade-offs

- [StrictMode, responsive remount or retained-screen duplicate] → mark before awaiting in a route-local provider, reset only on actual blur; behavior tests include replay, real-shell breakpoint changes on web/Android/iOS, refocus and A→B→A.
- [View fails after a transient error] → intentionally no retry or UI disruption; a later visible visit may send another event.
- [Transport policy affects other callers] → opt-in only; preserve and test default 401/local proxy retry behavior.
- [204 mistaken for a count] → controlled non-author fixture and before/after numeric counter; distinguish SSR/service and daily identities.
- [Bundle/performance drift] → narrow leaf imports, fixed budgets and mandatory bilateral gates; no media geometry changes.

## Migration and Rollback

No data migration. Root owns the authorized normal reviewed frontend publication and exact published-revision acceptance. Backend #3336 must already be available for the live proof. Roll back the task-owned frontend commit if lifecycle/auth/SSR tests fail; backend counting remains authoritative and a missing client event is the previous behavior. Store build/upload/submit/release are outside this change.
