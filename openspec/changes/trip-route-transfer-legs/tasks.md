## 1. Domain and adapter

- [x] 1.1 `RouteLeg`, `RouteSummary.transferDistanceKm/legs` in `api/plannedTripsTypes.ts`; the adapter maps `legs[]` (`from_order`/`to_order` → route index, slice validation) and `transfer_distance_km`.
- [x] 1.2 `routeSignature` includes the PUT value of `arrival_mode`.

## 2. Runs, preview and maps

- [x] 2.1 `tripRouteLegs.ts`: `splitRouteSegments` (backend `split_route_legs`), `routeLineSegments`, `transferArc`.
- [x] 2.2 `useTripRoutePreview` + `TripRoutePreviewEngines`: one engine per run, `combinePreviewRuns`, `previewRouteShapeKey`.
- [x] 2.3 Web map: per-leg polylines, transfer arc `metravel-route-transfer`; native: segments in the planner payload, `drawRouteLines` in the WebView script.

## 3. UI and localization

- [x] 3.1 `RouteArrivalModeField` in the point form (not for the first point), draft state in `useRoutePointDraft`.
- [x] 3.2 `RouteTransferLegBadge` above transfer points in the list; day totals exclude transfer edges.
- [x] 3.3 «Переезды K км» in `routeMetricsLine` and a tile in `RouteSummaryBar`.
- [x] 3.4 RU/BE/UK/PL/EN keys; mode names reuse the print labels (#2068).

## 4. Validation

- [x] 4.1 Jest: split parity with the backend, two runs → two preview requests, summary by legs, form without the field on the first point, `routeSignature`, map segments, native payload/script.
- [x] 4.2 e2e spec on mocks (1440 and 390): plaque, dashed arc, «Переезды K км», transfer not in the walking distance — written, run in `testing`.
- [ ] 4.3 In `testing`: prod probe with an e2e-account walking trip with a flight on 1440 and 390; Android emulator and iOS simulator show the dashed arc.
