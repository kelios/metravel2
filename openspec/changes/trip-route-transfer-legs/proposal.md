## Why

The planner knows one transport for the whole trip (`car`, `foot`, `bike`). A walking trip with a night train and two flights (prod trip 47, 23.09.2026) shows «Пешком 2 429 км · 481 ч 57 мин»: 2 240 km of it (92 %) are transfers, and one unroutable transfer drops the whole preview into a straight line. Backend #2055 (done) stores `TripRoutePoint.arrival_mode`, splits the saved summary into runs and transfers (`route_summary.legs[]`, `route_summary.transfer_distance_km`); the API layer already reads and writes `arrival_mode` (#2067). The planner UI does not. Board task: #2056.

## What Changes

- Point form: a «Как добираюсь сюда» field (inherit trip transport by default, train, flight, bus, ferry, transfer). The first point has no field. The value is saved through the existing full route PUT as `arrival_mode`; `routeSignature` includes it, so a change shows «Сохранить маршрут».
- Point list: a transfer plaque above the destination point, «<Feather icon> Перелёт · 431 км» (`docs/features/trips-plan-route-tab-mock.md` §6). The distance is the great-circle distance between the two points — exactly how the backend measures a transfer.
- Maps (web `TripPlanRouteMap.web.tsx`, native `TripPlanRouteMap.tsx` + WebView script): a transfer is a dashed arc in its own colour; routed runs are drawn from `legs[].geometry_slice`, a degraded run (`provider: direct`) keeps the approximate style on its own leg only.
- Live preview (`useTripRoutePreview`): the draft is split into runs exactly like backend `split_route_legs`; each run is routed by its own engine (`POST /api/routing/route/` per run); transfers are never routed.
- Summary (`RouteSummaryBar`, mobile summary row, header chip, map header): the routed part keeps «N км · M ч», transfers are shown separately as «Переезды K км» and never enter distance or travel time.
- RU/BE/UK/PL/EN copy through `@/i18n`; existing print labels (#2068) are reused for the mode names.

### User-visible result

The owner marks a point as reached by plane; the list shows «Перелёт · 431 км» above it, the map shows a dashed arc instead of a road, walking parts stay routed, and the totals read «… км · … ч · Переезды 2 240 км».

### Existing behavior to preserve

- Trips without transfers render, route and summarise exactly as before (one run, one engine, one line, same keys and tuples).
- `public`/`mixed` trips stay schematic.
- Reordering keeps the mode with its point (#2067); the point that becomes first is saved with `''`.
- GPX/KML export is unchanged.

### Dependencies and fallback/mock policy

- Depends on #2055 (done): `route.points[].arrival_mode`, `route_summary.legs[]` (`from_order`, `to_order`, `mode`, `distance_m`, `duration_s | null`, `provider`, `geometry_slice`), `route_summary.transfer_distance_km`.
- Before prod acceptance: jest and a mocked e2e spec only; `done` needs a prod probe against the real API.

### Out of scope / Non-goals

- Backend changes, GPX/KML export, community routes, schedules and ticket prices.
- Per-transfer duration (the backend has none: `duration_s: null`).
- Elevation profile of a trip with transfers in the live preview (see design).
