## Context

See proposal.md, board #2382 and `.codex-temp/2382/tails.md`. Evidence is existing review/acceptance, not a new runtime claim. `utils/filterQuery.ts:201–221` resolves names only; `:240` flags unresolved only if zero IDs resolve. `useMapTravels.ts:504–505` treats any resolved ID as server coverage of the entire selection, losing mixed unresolved names. `ModernFilters.tsx:598–604` shows group clearing from raw selected count, while its global count already understands defaults. `MyCreatedTripsList.tsx:265–274` adds a location group only after regions exist. `NearTravelListSkeleton.tsx:148` always includes the map toggle, while `NearTravelList.tsx:252` conditions it on coordinates. `TravelDetailsDeferred.tsx:46` uses a static placeholder. `PopularTravelList.tsx:326–328` uses a spinner before a variable-height grid. `api/map.ts` currently mixes transport, point normalization, radius/route queries, cluster adapters and place-source pagination.

## Goals / Non-Goals

Close the bounded frontend tail contracts through shared helpers/models; distinguish unresolved/backend-owned facets from delivered UI behavior. Preserve public map API exports, native branches and item k layout. Apply requires separate approval; overlap with #2367 must first be coordinated.

## Decisions

| Item | Architectural decision |
| --- | --- |
| a | Keep the API point count and label the count noun as points in all locales through the existing shared summary helper. Coordinates do not establish canonical place identity, so client dedupe-to-place-count is rejected. |
| b | Use location-neutral map title/description across supported locales; preserve H1/document title relation and canonical. Dynamic country claims require reliable geographic metadata and are outside this unchanged API contract. |
| c,d,e | Add one pure category-selection resolver with canonical IDs, matched names and unresolved tokens, shared by radius/cluster/route/offline callers. Accept numeric ID strings through the loaded dictionary, as well as legacy names; preserve URL tokens until dictionary readiness. Only fully resolved selections may use server category narrowing. If any name is unresolved, request the existing unnarrowed category dataset and apply the complete OR-selection locally, with loaded-scope totals. Do not silently drop a member. Remove obsolete travel-category state branches only after call-site/source audit; keep unrelated travel-list uses of the generic helper. |
| f | Retain loaded-point category chip counts with a localized explicit scope label; never present them as authoritative whole-radius facets. Exact facets need a linked backend task after Problem Memory, including bbox/center/radius/query/category exclusions/pagination semantics. Do not fetch every page merely to manufacture exactness. Record item f as backend-dependent precision with bounded frontend honesty delivered, not full facet completion. |
| g | Share per-group comparison with declared defaults between global and group clear visibility/count. Group reset applies that group's defaults atomically; for ordinary groups no defaults means empty. Maintain selected badges independently of clearability. Extend the existing callback API minimally if toggles cannot perform a single coherent reset. |
| h | Audit actual capability callers (`getBookExportCapabilities` is the present API name, not the stale ticket name). Its current caller `useFullBookExport.ts:95–98` already uses `enabled:canQuery`, defined at :86 as `enabled && Boolean(owner)`. First verify `useQueryOwner` yields null for guests and test the existing guard; only confirmed unguarded paths require implementation. Gate auth-only calls at the reusable capability owner using known auth state; guests retain existing local export, no session verification probe. Keep current visible Save PDF wording and correct docs when it already describes the action; do not rename product copy from a documentation mismatch alone. |
| i | Reserve the optional location-filter group from the same filter-panel layout model during first-frame loading, then render options in that slot; loaded no-region state may collapse only with an explicit data state, not a misleading active control. Do not pad each page independently. Replace fragile fixed LOC prose with a current responsibility/file reference in trips docs. |
| j | Separate behavior-preserving refactor stage, independently reviewed before behavioral edits: keep `api/map.ts` as public facade; extract leaf transport/retry, point/payload adapters, radius/near-route queries, cluster types/adapters/query and place-source pagination into `api/map/`. Shared contracts live in a dependency leaf to avoid cycles; retain endpoint serialization, abort/retry/cache behavior and export identities. No API/payload change and no opportunistic generic framework. |
| k | Record current similar arrows after Popular and existing Nearby CardRail; no implementation change absent an explicit owner decision. |
| l | Derive `canShowMapMode` once from the same route coordinate/origin predicate before lazy mount and pass it to coordinate-aware sidebar/nearby skeletons. Replace static placeholder constants with data-aware factories. Give Popular the existing fixed-height CardRail model in both loading and loaded sidebar states, with shared responsive card geometry and preserved item order/all up-to-eight items accessible by rail navigation. Native branches stay current. |

## Ownership and Contracts

Paths: `utils/filterQuery.ts` plus focused map resolver, `hooks/map/useMapFilters.ts`, `useMapTravels.ts`, `components/map-core/useMapController.ts`, `components/MapPage/TravelListPanel/helpers.ts`, `FiltersPanelRadiusSection.tsx`, `constants/mapSeo.ts`, touched map locale resources, `components/listTravel/ModernFilters.tsx`, actual capability-owning hook and `api/bookExportApi.ts` only if necessary, `components/trips/MyCreatedTripsList*`, `docs/features/trips.md`, `components/travel/NearTravelListSkeleton.tsx`, `TravelDetailSkeletons.tsx`, `details/TravelDetailsDeferred*.tsx`, `PopularTravelList*`, tests and separate `api/map.ts`/`api/map/` refactor stage. Expand paths only from confirmed shared reuse. Never edit backend.

API contract stays existing: category IDs use current radius/cluster query fields; route/offline remain local filtering; no inferred global totals under partial local matching. Public facade refactor must preserve imports for every caller. Guest capability ownership checks auth without creating a network auth test. SEO keeps URLs/canonicals and does not require robots/sitemap edits. i18n handles point nouns/count scope/neutral title for five locales. Accessibility preserves rail semantics, keyboard, 44px actions and hidden decorative skeletons. Analytics/event names and media URLs are retained.

## Risks / Trade-offs

- [Partially resolved OR selection cannot be server exact] → no partial server narrowing; explicit loaded-scope count and backend facet follow-up.
- [Dictionary arrives after URL] → do not discard numeric/name tokens early; resolve consistently once ready; slow/error dictionary tests.
- [Changing global filter helper breaks travel list] → add map-specific result contract and verify existing generic helper consumers.
- [Popular rail alters variable grid] → scope to sidebar web only, preserve up-to-eight items with normal accessible navigation; compare geometry and nearby healthy controls.
- [First-frame optional group estimate] → one slot model, DOM tests with delayed data and empty/nonempty regions, no permanent fake filter.
- [Map split changes import/mock cycles] → keep facade/re-exports, leaf dependencies, contract test snapshots; split separately from behavior fix.
- [Concurrent #2367 QA] → live-owner message and target-path status before claim/apply; do not treat testing as abandoned.

## Compatibility and Recovery

No storage migration, endpoint or native-config change. Revert behavior groups independently from the API split; facade allows refactor rollback without call-site edits. Existing tails retain individual dispositions; backend precision remains tracked externally, not silently waived. Item k is informational and accepted current behavior, not a speculative rollback.

## Validation Matrix

| Area | Code-level before review | Testing after reviewed SHA |
| --- | --- | --- |
| Map c/d/e, a/b/f | filterQuery/map resolver, useMapFilters, useMapTravels.categoryDictionary, route/offline and useMapController suites | `/map?categories=43` chooses Castle, mixed resolved/unresolved OR, Krakow 50km title/points/count scope at 390/1280; slow dictionary and pagination; real API |
| Default clear g | ModernFilters tests: defaults, added/removed selection, duplicate/reordered defaults, atomic reset, no-default group | `/roulette` 1280 and 390 defaults show no global/group clear; changed group reset restores BY+PL and clears other active groups normally |
| Guest PDF h | capability owner guest/auth tests, usePdfExport suites, no auth probe assertion | Guest export network has zero auth-only capability/session requests; authenticated export remains reachable; docs wording matches |
| Trips i | MyCreatedTripsList firstFrame/skeleton DOM suites with delayed nonempty regions | `/trips/my` 390/1280 first-frame slot→options bounds, no extra 83px sudden block; authentic test access |
| Sidebar l | Nearby sidebarSkeleton/rowGeometry and Popular DOM suites with/without coordinates/loading/error/empty | 390/1280 lazy placeholder→loaded bounds ±1px for equivalent content, no new downstream displacement; all rail cards reachable and console clean |
| API j | existing map/cluster/place-source API tests and import/export contract parity; scoped lint/tsc/guards | Existing radius/route/cluster/place-source flows unchanged; no new endpoints/requests |
| RU/BE/UK/PL/EN | `npm run test:i18n`, plural/localization coverage, audit:prompts for docs | Map labels/SEO and expanded strings remain readable, no leaked keys; light/dark |

Full task diff requires independent review-auditor then code-review-gate. Runtime/browser/API probes only in testing after the standard pipeline. Hero/detail geometry includes `yarn verify:slider` and `yarn verify:slider-perf` under their operation gate. Missing exact facet backend contract is concrete follow-up evidence, never a mock-only pass. No store/device gate arises from these common web fixes.
