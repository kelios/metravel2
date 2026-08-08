## Why

A cold load of `/map` downloads base tiles for three different zoom levels
before the user sees a single stable view: 66 tiles / 1,748 KB on a
1350×940 desktop viewport (levels 8, 9 and 13) and 20 tiles / 750 KB on a
412×823 mobile viewport. The z13 set belongs to a view the user never sees —
the map briefly centres on the radius-derived zoom while the radius filter
default is 50 km, and only afterwards fits the radius circle at the final
z9 (desktop) / z8 (mobile). Every z13 tile is therefore paid for by the
visitor's connection and by the tile proxy, and discarded before first
meaningful paint of the base layer.

Board task #1291 (`kind=bug`, `urgency=medium`, `area=front`, sprint 2),
problem key `map-startup-transient-zoom`. Problem-history verdict:
`create-linked`. The related closed tasks #807 and #252 hardened the tile
proxy and its rate limiting — they reduced the cost *per tile* but never
questioned *how many zoom levels* the startup sequence visits. The open
backend task #1292 optimises the tile format and likewise changes bytes per
tile, not the level count. The root-cause delta for this change is the
transient viewport, not tile delivery.

## What Changes

- Instrument the startup sequence of `/map` from Leaflet's own zoom events
  (`zoomstart` / `zoomend`) and from the actual tile requests, so the number
  of visited zoom levels is an observed trace, not an assumption.
- Remove the transient pre-fit / initial view application that makes the map
  visit a radius-derived zoom level before the final fit, while keeping the
  final centre and zoom of the startup view byte-for-byte identical.
- Rework the radius-zoom tests so they assert the observable *final* startup
  view and the absence of an intermediate radius zoom, instead of asserting
  the intermediate call that this change removes.
- Add a regression assertion that pins startup tile-level cardinality, so a
  future re-introduction of an intermediate view fails a check rather than
  silently costing bytes again.

### Goal and user-visible result

The startup view of `/map` looks exactly as it does today — same centre, same
final zoom, same radius circle, same points — but the base layer appears
sooner and without the wasted download, because only the final zoom level's
tiles are fetched.

### Platform impact

- **Desktop web:** direct behaviour change; the startup tile trace and the
  final centre/zoom must both be measured at 1350×940.
- **Mobile web:** direct behaviour change; the same trace and screenshot
  parity must be measured at 412×823.
- **Android:** no intended change. The startup viewport logic under change is
  web-Leaflet-owned, but the shared map configuration is exercised by the
  native surface, so Android needs a regression check of the general map
  configuration on the connected USB device — not a new feature validation.
- iOS is inactive and out of scope.

### Localization impact

`none`. No app-owned UI copy, translation key, locale persistence, formatting,
SEO locale or accessibility text is added, removed or changed by this change.

### Dependencies and fallback/mock policy

- No data or API contract change. `GET /api/travels/search_travels_for_map/`
  and `GET /api/map/clusters/` are consumed unchanged.
- The OSM tile proxy URL contract is unchanged and remains backend-owned and
  read-only from this workspace. `/proxy/tiles/osm/{z}/{x}/{y}.png` keeps its
  current shape, single provider and cross-origin mode.
- Backend task #1292 reduces bytes per tile. It is **not** a blocker: removing
  surplus zoom levels is independent of the tile format, and this change must
  meet its byte budget against today's tile format.
- Fallback/mock policy: it is forbidden to reach the budget by disabling or
  stubbing tiles, by lowering the final zoom, by delaying the base layer, or by
  declaring a single unstable run as proof. Tile mocking is allowed only in
  behavioural e2e specs that are not the byte evidence for this change; the
  byte and level evidence must come from real tile requests.
- No production deploy is authorised by this planning change. Until a deploy
  is separately authorised, handoff wording stays `local fix ready; production
  verification pending`.

### Existing behavior to preserve

- The final startup view: identical centre and final zoom (z9 desktop, z8
  mobile) with the radius circle fully visible and never wider than the circle.
- The "circle around me" default: the radius circle is visible from the first
  settled view, including with zero results.
- Later view changes stay as they are: radius change re-fit, "show all",
  marker/cluster focus, search-this-area, follow mode, route mode initial view.
- The single tile-provider contract and its guard, the existing pre-hydration
  tile warm-up for `/map`, and the current tile-layer options.
- Cluster/marker behaviour that depends on the synchronised zoom value after a
  programmatic move.

### Non-goals

- Changing the tile format, tile size, compression or proxy caching (#1292,
  `area=back`).
- Redesigning the map UI, filters panel, controls, popups or bottom sheet.
- Changing the default radius, the radius option ladder, the fallback centre or
  the final fit padding.
- Changing route-mode startup behaviour beyond what removing the shared
  transient step requires.
- Reworking clustering, marker rendering, overlays or the Overpass/WFS layers.
- Introducing a reveal timer, a delayed base layer, or any other mechanism that
  hides the cost instead of removing it.

## Capabilities

### New Capabilities

- `map-startup-viewport`: the observable startup viewport of the map screen —
  which views the map settles on, which it may not pass through, and the
  tile-level and byte budget that startup must respect.

### Modified Capabilities

None. There is no existing OpenSpec capability under `openspec/specs/` for the
map screen; `openspec/specs/` is currently empty, so this change introduces the
first map capability rather than modifying one.

## Impact

- **Expected frontend scope:**
  `components/MapPage/Map/MapLogicComponent.tsx` (the startup view effects),
  `__tests__/components/MapPage/MapLogicComponent.zoom-radius.test.tsx`, and a
  startup tile/zoom trace probe. `components/MapPage/Map.web.tsx`,
  `components/MapPage/Map/MapWebCanvas.tsx` and
  `components/MapPage/Map/useMapInstance.ts` are read for ordering and enter the
  edit set only if the measured trace proves the removal alone cannot hold the
  final view.
- **Data/API:** unchanged. No backend edit, migration or new endpoint. The tile
  proxy is a read-only dependency.
- **SEO:** unchanged. Route, canonical, `/map` metadata, sitemap, robots and the
  pre-hydration head bootstrap keep their current output; the warm-up tile URL
  is not changed by this work.
- **Accessibility:** unchanged. No new interactive element, focus target, live
  region or announcement; the map keeps its current semantics.
- **Performance:** this is the point of the change. Recorded 2026-08-08 cold
  baseline: desktop 1350×940 — 66 tiles / 1,748 KB across z8+z9+z13; mobile
  412×823 — 20 tiles / 750 KB. Target after the change: startup requests only
  the final zoom level, tolerating at most one neighbouring level produced by
  Leaflet's own behaviour, with median startup tile bytes ≤ 900 KiB on desktop
  and ≤ 650 KiB on mobile measured against today's tile format.
- **Security:** no new URL construction, input, redirect, storage, token or
  WebView boundary. Tile URLs keep coming from the single existing provider.
- **Analytics:** no event, parameter or goal is added, changed or removed.
