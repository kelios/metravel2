## Why

Production returns the National Library of Belarus as two independent map
records (`point 14029 / travel 389` and `point 15688 / travel 646`), so every
renderer draws two markers / two overlapping hit targets for one physical
building; the defect was confirmed on a physical iPhone (TestFlight, task
#1423 acceptance run) and reproduces on desktop web, mobile web and Android.
This is systemic, not a content one-off: Stankovo has three more exact
physical duplicates (`2986/15506`, `2990/15507`, `2985/15831`). The frontend
cannot repair this locally — marker identity is deliberately record-based
(#1347 keyed diff), and the two library coordinates are ~332 m apart, so any
radius/name heuristic that merges them would also merge genuinely distinct
neighbouring POIs.

Board context: problem key `MAP-POI-SOURCE-GROUPING-001`, verdict
`create-linked`. Backend contract owner: task #1567; canonical frontend/UI
owner: task #1568; data correction for the wrong `15688` coordinate: #1566.
Related history: #993 (single `PlacePopupCard`), #1347 (marker diff), #741
(lite marker payload without place identity), #841 (distinct article URLs must
not be lost).

## What Changes

- Backend (owned by `../metravel-backend`, board #1567 + follow-up; read-only
  from this workspace): introduce an immutable canonical **Place** identity
  with an explicit `travel_address -> place` link; map endpoints
  (`/api/travels/search_travels_for_map/`, `/api/map/clusters/`) return **one
  marker per place** carrying `place_id`, canonical `lat/lng`, `source_count`
  and a compact `primary_source`, keeping legacy flat fields during the
  compatibility window; new `GET /api/map/places/{place_id}/sources/` returns
  short source summaries with cursor pagination; cluster `total_count` counts
  places, not `travel_address` rows.
- Frontend shared model: normalize the additive DTO into
  `MapPlaceMarker` / `MapPlaceSource` once per dataset update (`O(n)` via a
  `Map`), in `api/map.ts` + shared map types/query keys; a legacy row without
  `place_id` stays a separate single-source marker.
- Renderers and native bridge: web (`Map.web.tsx`,
  `Map/MarkerClusterGroup.tsx`) and native WebView HTML
  (`Map/nativeMapHtml.ts`) render one marker per place; `SELECT_PLACE`
  (`Map/nativeBridge.ts`) carries a stable `placeKey` instead of resolving the
  selection by array index / coordinate match; the full sources array is never
  serialized into the WebView marker payload.
- Popup/card UI: shared source-pager model in `PlacePopupCard` and
  `MapPlaceBottomCard` — state keyed by `activeSourceId`, `Материал 1 из N`
  counter, previous/next controls and swipe; only the active source's
  thumbnail, article title and internal article URL change; canonical place
  fields (name/address, coordinates, copy/share, navigation, save/status)
  never change while paging. With `source_count > 1` the sources list is
  fetched lazily once per place through React Query cache after the card
  opens; paging never refetches the map dataset and never rebuilds the marker
  layer.
- Localization/accessibility: new RU/BE/UK/PL/EN keys for the counter,
  previous/next labels and the pager announcement; controls have ≥44 dp touch
  targets.

**Non-goals**: frontend proximity/name fuzzy merge (forbidden as identity);
editing content coordinates (#1566 is a separate data task);
platform-specific carousels; backend implementation from this workspace; store
release. **Dependencies**: final integration and deploy-target acceptance
depend on backend #1567 being deployed; types, UI and fixture tests do not.
**Fallback/mock policy**: fixtures/mocks are allowed to develop and unit-test
the UI, but do not close integration or TestFlight acceptance; legacy flat
markers must keep working until the explicit removal gate after frontend
adoption.

## Capabilities

### New Capabilities

- `map-place-sources`: one physical place renders as one marker/hit target
  with a source pager exposing every linked article (photo, title, URL)
  without losing data; grouping only by backend-assigned `place_id`; lazy
  cached sources endpoint; stable `placeKey` selection across web and native
  WebView renderers.

### Modified Capabilities

<!-- none: openspec/specs is empty; the map contract lives in
     docs/features/map.md and is extended, not contradicted, by this change -->

## Impact

- **User-visible**: one marker and one card per physical object on desktop
  web, mobile web, Android and iPhone; a `1 из N` pager inside the card for
  multi-source places; no change for single-source places.
- **API/data**: additive marker DTO (`place_id`, `source_count`,
  `primary_source`) + new sources endpoint; legacy flat fields preserved
  during migration; no breaking change for old clients.
- **Platform impact**: shared UI + shared WebView bridge → desktop web,
  mobile web, Android, iOS all affected. Browser evidence for both web forms;
  physical iPhone/TestFlight evidence for the originating defect (MAP-20);
  narrow Android device smoke when the shared bridge/adapter diff lands.
- **Localization impact**: all current locales RU/BE/UK/PL/EN (new pager
  keys + accessibility announcement); `npm run test:i18n` required.
- **Performance**: initial marker/WebView payload must not exceed baseline
  (#741/#1347 budgets); grouped places reduce marker count; sources are
  lazy + cached per `place_id`; only the active image mounts (next-thumbnail
  prefetch allowed); paging causes no marker churn.
- **Accessibility**: localized labels/announcement for pager controls, ≥44 dp
  targets, keyboard/screen-reader pass in MAP-20.
- **SEO**: none — map is client-rendered, no indexable URLs change.
- **Security**: none — no new user input; article URLs remain internal
  routes through existing navigation helpers.
- **Analytics**: none required by the board contract; existing map popup
  events keep firing per place (source paging adds no new mandatory events).
- **Affected code**: `api/map.ts`, shared map types/query keys, `hooks/map/*`,
  `components/MapPage/Map.web.tsx`, `Map/MarkerClusterGroup.tsx`,
  `Map/nativeMapHtml.ts`, `Map/nativeBridge.ts`, `Map.ios.tsx`,
  `Map.android.tsx`, `Map/PlacePopupCard/`, `Map/createMapPopupComponent.tsx`,
  `MapPlaceBottomCard.tsx`, `i18n/locales/*`, targeted Jest/e2e suites,
  `docs/MANUAL_TEST_CASES.md` MAP-20.
