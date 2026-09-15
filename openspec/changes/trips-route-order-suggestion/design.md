## Context

See [proposal.md](proposal.md) and [the capability spec](specs/planned-trips-route-order-suggestion/spec.md).

`RouteBuilder` keeps the editable route as local draft state (`route`, `setRoute`, `editingIndex`). Step 2 of the panel is `RoutePointsSection`, which already owns the point list and the "Add point" form. Manual reorder goes through `moveItem`/`remapIndexAfterMove` in `routePointReorder.ts`. The backend endpoint from #1951 returns a permutation `order` of input indices with fixed endpoints; the client must match it against the snapshot it sent.

`RouteBuilder.tsx` sits at 797 lines against the 800-line complexity guard, so the new state must not live there.

## Goals / Non-Goals

**Goals:**

- One request per press, one snapshot key per request, no application of a stale answer.
- Reuse `moveItem`/`remapIndexAfterMove` so the open editor follows its point exactly like drag&drop.
- Keep the backend contract in one API module with response validation (full permutation, fixed endpoints).
- Keep `RouteBuilder.tsx` under the guard by mounting the hook in `RoutePointsSection`.

**Non-Goals:**

- React Query mutation/cache (nothing is persisted; the answer is ephemeral UI state).
- Map highlighting, day grouping awareness, multi-segment optimization.

## Decisions

### API module `api/routeOrderOptimization.ts`

`optimizeRouteOrder({ points, transport_mode, bike_type? })` posts to `/routing/optimize/` through `apiClient` (auth headers, offline detection). The response is validated: `order` must be a full permutation of `0..n-1` starting with `0` and ending with `n-1`; anything else throws an `ApiError`-compatible error with code `provider_response_invalid`. Alternative rejected: reusing `api/external/serverRouting.ts` (raw `fetch`, no auth) — the endpoint is `IsAuthenticated`.

### Pure module `components/trips/planning/routeOrderSuggestion.ts`

`routeOrderRequestPoints` (coordinates → `{lat, lng}` or `null` when a point lacks finite coordinates), `routeOrderSnapshotKey` (transport, bike type, point ids and coordinates in draft order), `isIdentityOrder`, `applyRouteOrder` (sequential `moveItem` calls that also return the move list), `remapIndexAfterMoves`, `routeOrderPreviewRows`, `routeOrderErrorKey` (backend `code`/HTTP status → translation key). No React.

### Hook `useRouteOrderSuggestion` mounted in `RoutePointsSection`

Receives `trip`, `route`, `setRoute`, `setEditingIndex`. Exposes `availability` (`hidden | tooFew | needCoordinates | tooMany | ready`), `pending`, `error`, `notice`, `suggestion` (rows), `request`, `apply`, `dismiss`. Every async answer carries the snapshot key it was requested for; a key mismatch discards it. `apply` recomputes the list from the current draft and remaps the editing index through the returned moves. `RouteBuilder` passes `{ trip, setRoute, setEditingIndex }` as one prop.

### UI `RouteOrderSuggestion.tsx`

Secondary `Button` with the Feather `shuffle` icon, `loading` while pending; hint text for disabled reasons; error text with `accessibilityLiveRegion`; preview card listing `position. name (was N)` rows plus "Apply"/"Dismiss" buttons. Styles are added to `RouteBuilder.styles.ts` with existing tokens.

## Risks / Trade-offs

- Endpoint not yet deployed: the UI degrades to the "service unavailable" message; runtime evidence against the live endpoint is a `testing` gate after #1951 lands.
- `bike_type` `electric` is not yet in the frontend `TripBikeType` (#1900); the request type allows it so no change is needed later.

## Migration Plan

None: additive UI, no data change.
