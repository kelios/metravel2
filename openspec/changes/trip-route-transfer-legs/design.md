## Context

See [proposal.md](proposal.md) and [the capability spec](specs/planned-trips-transfer-legs/spec.md).

Backend #2055, read from `../metravel-backend` `origin/master` (`trips/route_legs.py`, `trips/views.py::_summary_for_route_points`):

- `split_route_legs(points)` walks ALL route points in order. A point `i ≥ 1` with `arrival_mode` closes the run `points[start:i]` and yields the transfer `points[i-1:i+1]`; the next run starts at `i`. The tail `points[start:]` is the last run.
- A run keeps only points with coordinates and is skipped below two of them; its leg spans the first and last resolved point. A transfer is the straight pair: `distance_m` = haversine, `duration_s: null`, `provider: 'transfer'`, `geometry` = the two points; a transfer with a missing endpoint gets `distance_m: 0`, empty geometry and a `transfer_coordinates_unavailable` warning.
- `combine_route_legs` concatenates leg geometries (`geometry_slice = [offset, offset + len)`), sums `distance_m`/`duration_s` over runs only, keeps `transfer_distance_m` apart, and marks the summary `direct` unless every run is ORS-optimal.
- A trip without transfers keeps the previous single-run path and gets one `route` leg.
- `GET /api/trips/planned/{id}/`: `route_summary.{distance_km, transfer_distance_km, legs, duration_min, …}`, `route_geometry` = the concatenated geometry the slices index into.

`RouteBuilder.tsx` is at the 800-line guard, `Map.ios.tsx` (897) and `nativeMapHtml.ts` (1058) are legacy oversized files: none of them may grow.

## Goals / Non-Goals

**Goals:**

- One split function (`tripRouteLegs.splitRouteSegments`) mirrors the backend and is shared by the preview, the maps and the shape key.
- Trips without transfers keep byte-identical preview keys, engines, tuples and map rendering.
- Legs are mapped to route indices in the adapter (`from_order`/`to_order` → index), so the UI never sees backend `order`.

**Non-Goals:**

- A client-side estimate of a routed run: run distance and time still come only from the routing engine or the backend.

## Decisions

1. **Domain.** `RouteSummary` gains optional `transferDistanceKm` and `legs: RouteLeg[]` (`fromIndex`, `toIndex`, `mode: 'route' | arrival mode`, `distanceKm`, `durationMin | null`, `provider`, `geometrySlice`). Optional, so the dozens of summary literals stay valid and old responses normalise to `undefined`.
2. **Preview runs.** `useTripRoutePreview` exposes `runs` (routable points per run) and `handleRunResult(runIndex, result)`; `TripRoutePreviewEngines` mounts one headless `TripRoutePreviewEngine` per run (key `retryToken:run`). `combinePreviewRuns` delegates a transfer-free plan to the old single-result functions; with transfers it concatenates run geometry (a degraded run contributes its straight points), adds transfer pairs, builds legs with slices, sums runs only, and returns no elevation profile — a profile across flights would plot a straight 431 km line as terrain. Rejected: one engine over all points with client-side slicing — one unroutable pair would still degrade every run (the trip 47 defect).
3. **Shape key.** `previewRouteShapeKey(route, transport)` equals `previewPointsKey` without transfers; with transfers it fingerprints runs and transfer endpoints but not the mode, so switching «поезд → самолёт» does not throw away the saved geometry, while adding/removing a transfer hands the display to the preview.
4. **Transfer distance.** List plaque and preview use `routePointsDistanceKm` (the existing haversine helper of day totals) on the two points — the backend definition. It lives in `tripRouteLegs.ts`, outside the files guarded against a local route estimate.
5. **Maps.** `routeLineSegments(route, geometry, legs, approximate)` returns `null` without transfers (maps keep the single polyline). With valid legs (slices inside the geometry, last end = geometry length) each leg becomes a segment; otherwise runs fall back to straight point lines. A transfer is a quadratic-Bézier arc between its endpoints (`transferArc`). Web draws `Polyline`s with `className: metravel-route-transfer`; native passes the segments inside the planner payload `routePointMarkers` (it already carries planner frame padding and clusters), `normalizeRoutePointsWithMarkers` converts them to `[lat, lng]`, and `drawRouteLines` in `nativeRoutePointMarkersScript.ts` draws them — the frame still fits the full `routeLine`. This keeps `Map.ios.tsx` untouched and shrinks `nativeMapHtml.ts`. Rejected: a new `Map` prop — it grows both legacy files.
6. **Colour and icons.** Transfer arc: `colors.infoDark`, dash `2 8`, weight 3 (routed 5, approximate `8 8`). Feather has no train/bus/plane glyphs; mode icons: flight `send`, ferry `anchor`, bus `truck`, train `git-commit`, transfer `shuffle`; the summary tile uses `shuffle`. No emoji.
7. **Summary.** `routeMetricsLine` appends «Переезды K км» when `transferDistanceKm > 0` (alone if the routed distance is zero); it feeds the mobile row, the map header, the header chip and the trip card. `RouteSummaryBar` adds a «Переезды» tile.
8. **Day totals.** The day header in the list no longer counts a transfer edge (adjacent pair whose later point has `arrivalMode`), matching print #2068.

## Layout (mock §6)

- Mobile web 390 / Android / iPhone: the plaque is a full-width row inside the list above the destination point card (icon 14 px, one line, ellipsis at 320); the form field is a wrapping chip row under «День»; the summary row under the map reads «189 км · 41 ч · Переезды 2 240 км».
- Desktop web 1440: same plaque in the left list column; the map header and the «Итог маршрута» tiles show the transfer total; the arc is visible at the default frame.

## Risks / Trade-offs

- [Several engines on one screen] → one per run, only while the preview owns the display; runs are debounced as one request.
- [Saved geometry not matching slices (elevation fallback geometry)] → invalid legs fall back to point lines instead of mis-slicing.
- [Backend marks a transfer-only trip `direct`] → shown as is; the summary line hides the zero routed part.

## Rollback

Revert the change set; the API layer (#2067) keeps sending `arrival_mode`, so saved data is not affected.
