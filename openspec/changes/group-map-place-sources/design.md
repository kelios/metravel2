## Context

See proposal.md — Why. Current mechanisms this design must respect:

- Marker identity is record-based on purpose: #1347 introduced a keyed diff
  that must not churn markers on dataset refresh; #741 minimized marker
  payload. Both budgets are regression gates for this change.
- Web rendering: `components/MapPage/Map.web.tsx` +
  `components/MapPage/Map/MarkerClusterGroup.tsx` (Leaflet, keyed diff).
- Native rendering: `components/MapPage/Map/nativeMapHtml.ts` builds the
  WebView HTML/markers; selection is reported as
  `{ type: 'SELECT_PLACE', index, id, coord }`
  (`components/MapPage/Map/nativeBridge.ts:25`, parser at `:94`), consumed by
  `Map.ios.tsx:661` / `Map.android.tsx` — i.e. selection today is resolved by
  array index / coordinate match, which is exactly the ambiguity to remove.
- Card UI is already canonical (#993): `Map/PlacePopupCard/index.tsx` content
  model wrapped by `Map/createMapPopupComponent.tsx` (web popup) and
  `MapPlaceBottomCard.tsx` (mobile sheet / native bottom card). It accepts one
  flat source today.
- API adapters live in `api/map.ts` (`fetchTravelsForMap`,
  `fetchMapClusters`, `fetchTravelsNearRoute`, `MapClusterPoint`).
- Backend is a read-only dependency from this workspace: Place model, grouped
  DTO and sources endpoint are owned by `../metravel-backend`
  (`travels/views_geo.py`, `travels/views_map_clusters.py`,
  `travels/serializers.py`, `travels/models.py`) and are delivered via board
  `area=back` tasks #1567 (+ catalog follow-up), #1566 (data fix). This
  workspace never edits them.
- Target model and DTO shape are fixed in `docs/features/map.md` («Один
  физический объект с несколькими источниками»); manual acceptance is
  `docs/MANUAL_TEST_CASES.md` MAP-20.

## Goals / Non-Goals

**Goals:**

- One shared normalization producing `MapPlaceMarker`/`MapPlaceSource` for all
  four renderers; renderers stay dumb consumers.
- Stable end-to-end selection key (`placeKey`) web and native.
- Source pager as a pure extension of the existing card content model.
- Ship frontend incrementally: model → UI → renderers/bridge can land behind
  fixtures before the backend deploy; only final integration waits.

**Non-Goals:**

- No frontend-side place inference (distance/name/address heuristics).
- No new state store: React Query keeps owning server data; selection stays
  component/screen state per current `docs/features/map.md` Client state table.
- No platform-specific carousels; no gallery/rich-text in the sources list.
- No backend edits from this workspace; no changes to `/api/places/catalog/`
  consumers in this change (identity alignment there is a backend follow-up).

## Decisions

1. **Identity: backend-assigned `place_id` only.**
   Alternative — frontend proximity/name merge — rejected: the two library
   records are ~332 m apart; a merge radius that big would also merge real
   neighbouring POIs (entrances, viewpoints, separate buildings). Identity is
   data, not geometry. Rows without `place_id` remain standalone markers.

2. **Additive DTO with legacy fallback, no endpoint versioning.**
   Marker gains `place_id`, `source_count`, `primary_source`; legacy flat
   fields stay until an explicit removal gate. Alternative — v2 endpoints —
   rejected: store Android/iOS builds in the field must keep working, and the
   compatibility window costs less than a parallel endpoint family.

3. **Normalize once per dataset update, `O(n)` with a `Map` keyed by
   `placeKey`, in the adapter layer (`api/map.ts` + shared map types), not in
   renderers.** `placeKey = String(place_id)` when present, else the existing
   record identity (so legacy rows keep #1347 diff stability). Alternative —
   group in each renderer — rejected: four renderers would each reimplement
   grouping and drift.

4. **Marker payload carries only `sourceCount` + `primarySource`; sources
   list is a separate lazy resource.** `GET /api/map/places/{place_id}/sources/`
   is fetched once per place after the card first opens, cached by React
   Query under a `['map-place-sources', placeKey]` key; paging is pure local
   state. Alternative — embed all sources in the marker payload — rejected:
   breaks #741 payload budget and serializes unbounded arrays into the
   WebView bridge.

5. **Bridge sends stable `placeKey`, not index/coord.** `SELECT_PLACE`
   (`nativeBridge.ts`) gains `placeKey`; native screens resolve the selected
   place from the normalized model by key. `index`/`coord` stay during the
   transition for old HTML payloads, then die with the removal gate.
   Alternative — keep index-based selection and re-sort defensively —
   rejected: dataset refresh between render and tap keeps the race alive.

6. **Pager is part of the shared card content model.** `PlacePopupCard`
   content model gets `sources: MapPlaceSource[]`, `activeSourceId`, and
   callbacks; `createMapPopupComponent` (web) and `MapPlaceBottomCard`
   (mobile/native) reuse it. Only source-owned props (thumbnail, article
   title, article URL) derive from the active source; place-owned props are
   computed once from the marker. One media component instance mounts the
   active image; at most the next thumbnail is prefetched.

7. **Board decomposition (the DAG this design feeds):**
   - `#1566` (back, data): fix coordinate of point 15688 — independent.
   - `#1567` (back): Place identity + migration/backfill + grouped map DTO +
     sources endpoint + cluster counts by place.
   - back follow-up: same identity in `/api/places/catalog/` and near-route.
   - FE-1 (front): shared types + normalization + `api/map.ts` adapters +
     query keys + fixtures. No backend dependency (fixtures encode the DTO).
   - FE-2 (front): source pager in `PlacePopupCard`/`MapPlaceBottomCard` +
     i18n (RU/BE/UK/PL/EN) + a11y + tests. Depends on FE-1.
   - FE-3 (front): one-marker-per-place in web renderer + WebView HTML +
     `SELECT_PLACE placeKey` bridge + payload cap. Depends on FE-1; Android
     smoke on the shared bridge diff.
   - `#1568` (front, canonical): integration on the deploy target + e2e +
     network assertions + MAP-20 evidence (desktop/mobile web + physical
     iPhone/TestFlight). Depends on #1567 deployed, FE-2, FE-3.
   Rationale: FE-1..FE-3 are parallelizable after FE-1, each is a small
   reviewable diff, and UI work does not wait for the backend deploy.

## Risks / Trade-offs

- [Backend deploy lag blocks the visible fix] → FE-1..FE-3 are fixture-driven
  and land independently; only #1568 waits. Fixtures replicate the exact DTO
  from `docs/features/map.md`, so integration risk concentrates in one card.
- [Grouping changes marker keys → #1347 keyed-diff churn] → `placeKey` reuses
  the legacy identity for ungrouped rows; unit test asserts key stability
  across dataset refreshes and that paging never touches the marker layer.
- [WebView payload grows] → payload assertion against baseline in FE-3
  (markers carry one `primarySource` only); grouped places strictly reduce
  marker count.
- [Shared bridge change breaks Android] → narrow Android device smoke is part
  of FE-3/#1568 done gates; `SELECT_PLACE` keeps legacy fields during the
  transition.
- [Mixed datasets (some rows placeless) render inconsistently] → negative
  controls: `different place_id never merge`, `no place_id stays standalone`,
  `single source shows no pager`.
- [Sources cache goes stale after content edits] → accepted: default React
  Query staleness for map data applies; a place's sources change rarely and a
  reload fixes it. No custom invalidation in this change.
- [Counter copy needs no plural forms] → `Материал {{current}} из {{total}}`
  uses two numbers, avoiding plural-rule divergence across BE/UK/PL.
- [Seam between grouping and the card: a renderer that hands the popup the
  representative *record* instead of the grouped *marker* silently disables the
  pager] → `groupMapPlaces` computes `sourceCount`/`sources` on the marker, but
  the transitional flat form (two rows sharing `place_id`, no `source_count`
  field) leaves those fields absent on the record itself, so the card reads
  `sourceCount = 1` and renders no pager even though a second source exists.
  Found by the #1571 review gate. Fixed at the seam: shared
  `materializeMapPlaceRecord` adds only `placeId`/`sourceCount`/`primarySource`
  to the record passed into popup/selection, never the full sources array. In
  `MarkerClusterGroup` the helper runs only AFTER `coordsByPoint` lookup by the
  original record identity, so the derived copy cannot drop the marker and the
  keyed diff from #1347 remains intact. Verified by #1568 e2e whose two flat
  fixture rows intentionally omit `source_count`/`primary_source` yet still
  reach `1 из 2` after opening the single grouped marker.
- [Web swipe would double-fire with the hero's tap-to-fullscreen] → the hero
  opens the fullscreen viewer on `onPointerDownCapture` (#993, deliberate for
  WebKit reliability), so a horizontal drag over the photo would open the viewer
  *and* page behind it. Swipe paging is therefore native-only; web pages via the
  explicit ‹ › controls (44 dp, keyboard-operable). Changing the photo's open
  gesture is a separate task, not this change.

## Migration Plan

1. Backend deploys additive DTO + endpoint (#1567) — old clients unaffected.
2. Frontend FE-1..FE-3 land on `main` fixture-tested; adapters accept both
   shapes, so the order of frontend vs backend deploy does not matter.
3. #1568 wires and verifies against the deploy target, then MAP-20 evidence
   (desktop web, mobile web, physical iPhone/TestFlight; Android smoke).
4. Rollback: frontend falls back to legacy flat rendering if grouped fields
   are absent — reverting the backend alone degrades gracefully to today's
   behavior; reverting a frontend card is an ordinary revert on `main`.
5. Removal gate (separate, later): drop legacy flat fields and transitional
   bridge fields only after frontend adoption is confirmed on all stores.

## Validation matrix

| Surface / locale | Check |
| --- | --- |
| Unit (shared) | normalization/grouping, placeKey stability, pager model, lazy-fetch-once, media mount — targeted Jest |
| Desktop web | one marker at zoom 10/13/16, pager `1 из 2 → 2 из 2`, network: sources fetched once after tap — browser evidence + e2e fixture |
| Mobile web | same flow in `MapPlaceBottomCard`, paging by the ‹ › controls (swipe is native-only) — browser evidence |
| Android | device smoke of tap→card→paging (shared bridge diff) |
| iPhone | physical device / TestFlight MAP-20 (originating defect) |
| RU/BE/UK/PL/EN | new keys via `npm run test:i18n`; RU + one non-RU locale spot-checked in browser |
| Performance | initial marker/WebView payload ≤ baseline; no marker churn while paging (network/DOM assertion) |
