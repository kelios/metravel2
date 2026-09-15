## Why

Owners of planned trips order route points only by hand (arrow buttons and drag&drop). On a long multi-stop route they have to guess a sensible visiting order themselves. The backend task #1951 implements `POST /api/routing/optimize/` (contract agreed in #1898/#1916); the planner has no UI that calls it. Board task: #1899.

## What Changes

- Add an owner-only "Suggest optimal order" action inside the "Route points" step of the route builder, available when the draft route has at least three points, every point has coordinates, and the trip transport is routable (`car`, `bike`, `foot`).
- On press send exactly one `POST /api/routing/optimize/` request with the current point coordinates in draft order, `transport_mode`, and `bike_type` for bicycle trips; never send ids, names, or descriptions.
- Show the returned order as a read-only preview (new position, point name, previous position) without changing the draft route, the saved trip, or the map.
- Offer two explicit actions: "Apply" reorders the draft through the existing `routePointReorder` arithmetic (the open point editor follows its point); "Dismiss" closes the preview and keeps the manual order.
- Drop a pending or shown suggestion silently when the draft points, coordinates, transport, or bike type change, so a stale permutation is never applied.
- Render localized, non-technical messages for the pending state, an identity answer ("nothing to reorder"), and every backend error class from the #1951 table (400/401/422/429/502/503/504, missing endpoint, offline).
- Add RU/BE/UK/PL/EN copy through `tripsStatic:plan.orderSuggestion.*`.

### User-visible result

Next to the point list the owner sees a "Suggest optimal order" button. Pressing it shows the suggested visiting order; "Apply" reorders the points, "Dismiss" leaves them untouched. Saving still goes through the existing "Save route" action.

### Existing behavior to preserve

- Manual reorder (arrows, drag&drop) and its `routePointReorder.ts`/`useRoutePointDrag.ts` arithmetic are unchanged.
- Nothing is written to the trip until the owner presses "Save route".
- Non-owners never see the action; routes with one or two points do not get it.
- Mobile web and native surfaces share the same block, order of actions, and states.

### Dependencies and fallback/mock policy

- Depends on backend #1951 (`POST /api/routing/optimize/`, `IsAuthenticated`, contract v1). Until it is deployed the endpoint answers 404 and the UI shows the "service unavailable" message.
- No client-side optimizer and no mock order: a failed or invalid response keeps the manual order and reports an error.

### Out of scope / Non-goals

- The optimization algorithm, provider selection, quotas (backend).
- Overnight/day-boundary aware optimization (contract v1 fixes only the first and last point).
- Highlighting the suggested order on the map.
- Applying the order automatically or saving it without the owner's "Save route".
