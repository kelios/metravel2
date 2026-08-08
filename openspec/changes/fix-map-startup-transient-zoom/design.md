## Context

See [proposal.md](proposal.md) for the measured symptom and the problem-history
verdict. This section records only the current mechanics that shape the fix.

Startup of `/map` on web currently applies the viewport in three stages, all
owned by `components/MapPage/Map/MapLogicComponent.tsx`:

1. `components/MapPage/Map/MapWebCanvas.tsx:241-257` mounts the Leaflet
   container with `center={safeCenter}` and `zoom={safeZoom}`. `safeZoom` comes
   from `components/MapPage/Map.web.tsx:885`, which falls back to
   `DEFAULT_ZOOM = 11` (`components/MapPage/Map.web.tsx:51`, mirrored in
   `components/MapPage/Map/constants.ts:5`) because the `/map` coordinates
   object carries no `zoom`.
2. A radius-derived view is applied twice, from the same helper:
   - the pre-fit at `MapLogicComponent.tsx:284-315`, whose
     `map.setView(preCenter, getInitialRadiusZoom(radiusInMeters), { animate: false })`
     sits at lines 303-307 and is deliberately skipped under `isTestEnv`;
   - the "initial view once radius results are ready" block at
     `MapLogicComponent.tsx:345-381`, whose three `map.setView(..., radiusZoom,
     { animate: false })` calls sit at lines 356, 365 and 374 and do run in the
     test environment.
   `getInitialRadiusZoom` (`MapLogicComponent.tsx:127-136`) maps the radius to a
   zoom level; with the product default `DEFAULT_RADIUS_KM = 50`
   (`constants/mapConfig.ts:10`) it returns **13**. That is the transient level
   reported in #1291.
3. The auto-fit effect at `MapLogicComponent.tsx:399-595` computes the radius
   circle bounds (`computeCircleBounds`, lines 29-58), optionally tightens them
   to in-radius points, and calls `map.fitBounds(bounds.pad(padFactor), …)` at
   line 553 with `maxZoom: 16` in radius mode. This produces the final startup
   view (z9 desktop, z8 mobile). Its gate `canAutoFitRadiusView`
   (line 149) is already satisfied by a valid radius circle alone — results are
   not required.

Why the transient level costs whole tile sets: on web the declarative
`<TileLayer>` in `components/MapPage/Map/MapLayers.tsx:167-173` is **not**
rendered (`shouldRenderBaseTileLayer` at line 148 is false off-test on web).
The base layer is instead created and attached imperatively by
`components/MapPage/Map/useMapInstance.ts` — `createThemedBaseLayer` at lines
52-55, attached inside `setupLayers()` at lines 350-372 once `canInitializeNow()`
(lines 157-173) reports a valid centre, zoom and non-zero size, with retries
bound to `load` / `resize` / `moveend` / `zoomend` (lines 411-421). The layer
therefore materialises at whatever zoom the map happens to hold at that moment,
and every subsequent settled level pulls a fresh tile set. `keepBuffer: 4`,
`updateWhenZooming: false` and `updateWhenIdle: false`
(`useMapInstance.ts:39-50`) shape tile retention during a move but do not
prevent a new level's tiles from being fetched.

Ownership boundaries:

- `MapLogicComponent` is consumed only by `components/MapPage/Map/MapWebCanvas.tsx`.
  It is `/map`-web only — it is not part of the shared engine.
- The shared engine `components/MapPage/Map/MapCanvas.tsx` (used by
  `components/quests/QuestFullMap.tsx`, `components/travel/WebMapComponent.tsx`,
  `components/trips/planning/TripPlanRouteMap.web.tsx`) is **not** in the edit
  set; those screens share only the tile provider.
- The tile URL contract lives in `config/mapWebTileContract.ts:6` and is served
  by the backend proxy. It is a read-only dependency here; any change to it is
  an `area=back` task (#1292). The single-provider rule is enforced by
  `scripts/guard-no-direct-osm-tiles.js`.
- The pre-hydration warm-up in `utils/mapHeadBootstrap.ts` requests exactly one
  tile at `DEFAULT_ZOOM` for the fallback centre. It is intentional (#1290) and
  stays; it must be reported separately from the Leaflet base-layer inventory so
  it is not mistaken for a second level.

Expected frontend paths:

- `components/MapPage/Map/MapLogicComponent.tsx`
- `__tests__/components/MapPage/MapLogicComponent.zoom-radius.test.tsx`
- `__tests__/components/MapPage/MapLogicComponent.test.tsx` (radius fitBounds
  cases, only if the removal changes their observable expectations)
- one focused startup zoom/tile probe that does not mock tiles

`components/MapPage/Map.web.tsx`, `components/MapPage/Map/MapWebCanvas.tsx` and
`components/MapPage/Map/useMapInstance.ts` are read for ordering and enter the
edit set only under the bounded condition in Decision 2.

Data/API contract: unchanged. `GET /api/travels/search_travels_for_map/` and
`GET /api/map/clusters/` keep their request and response shapes; the cluster
query already follows the settled viewport, so a shorter startup sequence can
only reduce the number of viewport-derived refetches, never change their
contract. Auth is irrelevant — `/map` startup is anonymous. There is no
platform split to add: the code under change is already web-only, and the native
map builds its own view inside `components/MapPage/Map/nativeMapHtml.ts`.

The travel hero/slider bilateral gate (`verify:slider` / `verify:slider-perf`)
does **not** apply: this change touches no path under
`components/travel/sliderParts/**` or `components/travel/details/**`, no
`ImageCardMedia`, and no hero geometry.

## Goals / Non-Goals

**Goals:**

- Make the radius circle fit the single owner of the startup view, so the map
  settles once.
- Prove the level count from Leaflet's own zoom events and from the real tile
  requests, grouped by `z`, rather than from reading code.
- Convert the existing radius-zoom tests from asserting a removed internal call
  into asserting the observable final view and the absence of the intermediate
  one.
- Leave the final centre and zoom pixel-identical.

**Non-Goals:**

- Introducing a new abstraction, hook or state machine for the map viewport. The
  existing auto-fit effect already computes the final view.
- Making the base tile layer declarative or otherwise reworking
  `useMapInstance`.
- Tuning `keepBuffer`, `updateWhenZooming`, `updateWhenIdle`, `maxZoom` or the
  fit padding to hide the cost.
- Touching the pre-hydration warm-up tile or the tile proxy contract.

## Decisions

### 1. Delete the radius-derived view application; let the circle fit own startup

Both radius-zoom applications — the pre-fit at `MapLogicComponent.tsx:284-315`
and the results-gated block at lines 345-381 — are removed, together with
`getInitialRadiusZoom` (lines 127-136) once it has no remaining consumer. The
initialization bookkeeping stays: `hasInitializedRef`, `lastModeRef`,
`lastRadiusKeyRef`, `lastUserLocationKeyRef` and `lastAutoFitKeyRef` continue to
govern *when* a re-fit is allowed; only the act of applying a zoom is removed.
Route mode keeps its own `setView(..., 13)` at line 272 — it is a different
mode with a different startup contract and is out of scope beyond regression.

This is viable because the auto-fit gate `canAutoFitRadiusView`
(`MapLogicComponent.tsx:149`) is already satisfied by a valid radius circle
alone, so the settled view does not have to wait for results. The
"circle around me, never wider than the circle" contract is enforced inside the
fit itself (lines 455-491), not by the removed pre-fit.

A useful side effect: the `!isTestEnv` divergence at line 290 disappears, so the
test environment and the browser follow the same startup path.

Alternatives considered:

- *Keep `setView` but pass the final zoom.* Rejected: the final zoom is a result
  of `fitBounds` over the circle bounds and the live container size. Computing it
  a second time would duplicate the fit and could drift from it.
- *Keep `setView` for the centre only, at the current zoom.* Held in reserve for
  Decision 2; it does not fetch a new level, but it is unnecessary if the fit
  already runs before the base layer attaches.
- *Animate from the radius zoom to the final zoom instead of removing it.* Rejected:
  an animated transit still resolves and downloads the intermediate level, and it
  would make the settled view arrive later.

### 2. Confirm the level at which the base layer attaches; bounded fallback

Because the base layer is attached imperatively on the first commit after
`onMapReady` (`useMapInstance.ts:350-372`, driven from
`MapLogicComponent.tsx:186-225`), removing the transient view could leave the
layer attaching at the container's mount zoom (`DEFAULT_ZOOM = 11`) instead of
the final one — trading z13 for z11 rather than removing a level.

The instrumented trace from Task 1 decides this, and it is the reason
measurement precedes implementation:

- If the trace after Decision 1 shows base tiles only at the final level (plus at
  most one Leaflet-produced neighbour), stop there.
- Only if the trace shows a settled mount-zoom level, extend the fix minimally
  to align the container's initial zoom with the computed startup zoom for the
  current radius and viewport (`components/MapPage/Map.web.tsx:885` /
  `MapWebCanvas.tsx:241-257`). This stays inside the same root cause: one
  startup view, applied once.

Anything wider than that — delaying the layer, gating it on a timer, or lowering
the final zoom — is out of scope and would violate the fallback policy in the
proposal. If neither option satisfies the budget, implementation stops for a
design revision instead of expanding silently.

Alternative considered: *attach the base layer only after the first fit.*
Rejected as the primary route — it delays the first painted tile, which is the
opposite of the user-visible goal (#1290 deliberately moved the first tile
earlier), and it would make the map briefly blank.

### 3. Measure from zoom events and grouped tile URLs, never from polling

The startup trace is produced by subscribing to the map's `zoomstart`,
`zoomend`, `load` and `moveend` events and recording `(event, zoom, timestamp)`.
Polling `getZoom()` on an interval is explicitly rejected: a level that is
entered and left between two samples is invisible to it, which is exactly the
class of defect under investigation.

The tile inventory is taken from the browser's network layer with real transfer
sizes, grouped by the full request URL and then by the `z` segment parsed from
`/proxy/tiles/osm/{z}/{x}/{y}.png`. Grouping by response size or by any derived
width is rejected — same-size responses collapse distinct URLs and produce a
wrong count. Reported per viewport: level, tile count, bytes, plus the totals
and the settled centre/zoom. The single pre-hydration warm-up tile from
`utils/mapHeadBootstrap.ts` is reported as its own line, not folded into a level.

Five cold runs per viewport with an empty cache, reported by median, because one
run cannot separate a fix from network jitter — the proposal's fallback policy
forbids accepting a single run.

### 4. Tests assert observable behaviour, not the removed call

`__tests__/components/MapPage/MapLogicComponent.zoom-radius.test.tsx:87`
currently asserts `map.setView([53.9, 27.5667], 13, { animate: false })` — the
exact call this change deletes. It is rewritten rather than deleted, into:

- no `setView` carrying a radius-derived zoom happens before the startup fit;
- the startup fit still happens once for a valid circle, and once more only when
  the radius changes;
- the existing drift/live-tick stability cases (lines 161-301) still hold.

`MapLogicComponent.test.tsx` is checked for the same coupling and updated only
where the observable expectation genuinely changed. No test is skipped.

### 5. Tile-level cardinality gets its own regression surface

Neither existing e2e can carry this evidence, and that is precisely why the
regression was invisible:

- `e2e/map-page.spec.ts` mocks `**/proxy/tiles/osm/**` with a 1×1 PNG
  (`installTileMock`), so every tile is 68 bytes and every level is free;
- `e2e/pages-perf-budget.spec.ts:108-117` (`shouldIgnoreBudgetRequest`)
  explicitly excludes `/proxy/tiles/` from the `MAP` budget, so tile bytes never
  entered the page budget at all.

The regression control is therefore a dedicated startup probe that does **not**
mock tiles: it asserts the number of distinct zoom levels in the startup base-tile
inventory and the byte budget per viewport, and it fails if the radius-derived
level reappears. The behavioural specs keep their tile mock and are unaffected.

SEO, accessibility, security and analytics are untouched by this change and are
covered under Impact in the proposal; no decision here alters them.

## Risks / Trade-offs

- **Removing the pre-fit trades z13 for the container's mount zoom** → Task 1
  measures the level at which the base layer attaches, and Decision 2 defines the
  single bounded follow-up; the byte budget is asserted on the real trace, not
  assumed from the diff.
- **The settled view could arrive later when the circle centre resolves slowly
  (geolocation permission, timeout)** → time-to-settled-view is recorded next to
  the bytes in the same trace and must not regress; the fallback centre path is
  exercised explicitly.
- **Zero-result and permission-denied startups could lose the visible circle** →
  the spec keeps a scenario for a startup with no results, and the fit gate
  already accepts a valid circle without results.
- **The existing tests encode the removed behaviour, so a careless edit could
  delete coverage instead of moving it** → the rewritten test must still fail if
  an intermediate radius zoom is re-introduced; that is verified by temporarily
  restoring the old call locally before finalising.
- **`MapLogicComponent` also serves route mode and later view changes** →
  route-mode startup, radius change, marker/cluster focus and search-this-area are
  each re-checked in the browser after the change.
- **Shared map configuration reaches Android** → the Android device check is a
  regression check of the general map configuration, not a re-validation of the
  web startup sequence.
- **A single lucky run could "prove" the fix** → five cold runs per viewport with
  a median, and a full per-level table in the evidence.

## Validation Matrix

| Surface | Scenario and evidence | Required result |
|---|---|---|
| Desktop web | 1350×940, ≥5 cold runs with empty cache; `zoomstart`/`zoomend` trace, base-tile inventory grouped by `z` with real transfer bytes, settled centre/zoom, screenshot vs pre-change baseline | One settled zoom level (≤1 Leaflet-produced neighbour), zero tiles at the radius-derived level, median startup tile bytes ≤ 900 KiB, final zoom 9 and centre unchanged |
| Mobile web | 412×823, ≥5 cold runs with empty cache; same trace, inventory and screenshot comparison | Same level contract, median startup tile bytes ≤ 650 KiB, final zoom 8 and centre unchanged, radius circle visible in the first settled view |
| Mobile web / desktop web (behaviour) | Radius change, "show all", marker and cluster focus, search-this-area, route-mode startup, zero-result and denied-geolocation startups | Each keeps its current view behaviour; no new console error |
| Android | `adb devices -l`, locally built debug app installed over USB; open the map screen and compare with the paired mobile-web run | Startup view, radius circle and points render as before; no blank map, missing base layer or new runtime error |
| Focused automated checks | Rewritten `MapLogicComponent.zoom-radius.test.tsx`, `MapLogicComponent.test.tsx`, startup tile-cardinality probe, `npm run guard:external-links`, `npm run check:fast` | All pass with zero skipped tests; the cardinality probe fails when the intermediate view is restored |
| Neighbouring consumers | Travel details map, quest full map, trip-plan route map — the screens sharing the tile provider but not the startup logic | Unchanged tile source and startup rendering; no new requests or errors |

Localization impact is `none`: no translation key, locale resource, formatting
helper or SEO locale is touched, so `npm run test:i18n` is not part of this
change's Done gate and a single representative locale is sufficient for the
visual comparison.

## Migration Plan

1. Capture the pre-change baseline trace on both viewports with the instrumented
   probe, and confirm it reproduces the reported z8+z9+z13 desktop and mobile
   inventories.
2. Remove the radius-derived view application and rewrite the coupled tests.
3. Re-run the probe on both viewports; if a settled mount-zoom level appears,
   apply the single bounded follow-up from Decision 2 and re-measure.
4. Run the focused automated checks and the full validation matrix, including the
   Android regression check.
5. Complete the mandatory code-review-and-fix pass and re-run the affected checks.
6. If a production deploy is later authorised separately, repeat the exact
   production trace on the live URL before claiming the issue fixed in production.

Rollback is a revert of one frontend component plus its tests; there is no data
migration, no API change, no cache to invalidate and nothing to roll back on the
backend or the tile proxy. Without an authorised deploy, handoff stays
`local fix ready; production verification pending`.

## Open Questions

- Whether the base tile layer attaches at the container mount zoom once the
  transient view is gone. This is deferred on purpose: it is answered by the
  Task 1 trace, and Decision 2 already fixes both branches of the answer, so it
  changes neither the specs nor the task breakdown.
