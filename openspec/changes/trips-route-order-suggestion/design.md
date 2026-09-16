## Context

See [proposal.md](proposal.md) and [the capability spec](specs/planned-trips-route-order-suggestion/spec.md).

`RouteBuilder` keeps the editable route as local draft state (`route`, `setRoute`, `editingIndex`). Step 2 of the panel is `RoutePointsSection`, which already owns the point list and the "Add point" form. Manual reorder goes through `moveItem`/`remapIndexAfterMove` in `routePointReorder.ts`. The backend endpoint from #1951 returns a permutation `order` of input indices with fixed endpoints; the client must match it against the snapshot it sent.

`RouteBuilder.tsx` sits at 797 lines against the 800-line complexity guard, so the new state must not live there.

## Goals / Non-Goals

**Goals:**

- One request per press, one snapshot key per request, no application of a stale answer.
- Apply through `RouteBuilder.handleReorder`, the single reorder entry point shared with the arrows and drag&drop, so the open editor follows its point exactly like drag&drop.
- Keep the backend contract in one API module with response validation (full permutation, fixed endpoints).
- Keep `RouteBuilder.tsx` under the guard: it only passes one prop to `RoutePointsSection`.

**Non-Goals:**

- React Query mutation/cache (nothing is persisted; the answer is ephemeral UI state).
- Map highlighting, day-aware or multi-segment optimization.

## Decisions

### API module `api/routeOrderOptimization.ts`

`optimizeRouteOrder({ points, transport_mode, bike_type? })` posts to `/routing/optimize/` through `apiClient` (header token on native, cookie plus CSRF on web, offline detection) with a 15 s timeout, longer than the server's 8 s provider timeout so the server's `504 provider_timeout` reaches the client. The response is validated: `order` must be a full permutation of `0..n-1` starting with `0` and ending with `n-1`; anything else throws an `ApiError` with status 502 and code `provider_response_invalid`. Alternative rejected: reusing `api/external/serverRouting.ts` (raw `fetch`, no auth) — the endpoint is `IsAuthenticated`.

### Pure module `components/trips/planning/routePointOrder.ts`

Named after its neighbours `routePointReorder.ts`/`routePointDays.ts`; `routeOrderSuggestion.ts` would collide with `RouteOrderSuggestion.tsx` on a case-insensitive file system. Contents: `routeOrderAvailability`, `routeOrderRequestPoints` (coordinates → `{lat, lng}` or `null` when a point lacks finite coordinates), `buildRouteOrderRequest`, `routeOrderSnapshotKey` (transport, bike type for bicycle trips, point ids and coordinates in draft order), `isIdentityOrder`, `routeOrderMoves` (decomposition of the permutation into sequential `moveItem` steps, independent of list contents), `applyRouteOrderMoves` (the reordered draft for the `applied` snapshot key), `routeOrderPreviewRows`, `routeOrderErrorKind` (backend `code` first, then offline/timeout, then HTTP status). No React.

### Availability with fixed endpoints

Contract v1 keeps the first and last point in place, and for exactly three points the server answers the identity order without calling the provider. The action therefore stays hidden below three points, is shown disabled with an explanation at three points (a request could only answer "nothing to reorder" and would spend the owner's 5/min throttle), and is enabled from four up to 50 points. A route with a point lacking coordinates or more than 50 points shows the disabled action with the reason.

### Hook `useRouteOrderSuggestion` inside `RouteOrderSuggestion`

`RoutePointsSection` renders `RouteOrderSuggestion` above the point list and passes `route` plus the `{ transport, bikeType, onReorder }` target from `RouteBuilder`, where `onReorder` is `handleReorder`. The hook exposes `availability`, `status` (`idle | pending | preview | unchanged | applied | error`), `errorKind`, preview `rows`, `request`, `apply`, `dismiss`. Every stored state carries the snapshot key it belongs to; a key mismatch renders as idle, so a pending, previewed, failed, or applied state disappears as soon as the draft changes. A request sequence number keeps an old answer from overwriting a newer request, and an in-flight key ref blocks a second press in the same tick. `apply` feeds every `routeOrderMoves` step to `onReorder` (its functional updates of the draft and the editing index are batched into one render) and marks the reordered draft as `applied`. An answer for an unmounted block is not guarded separately: React drops that state update itself.

### UI `RouteOrderSuggestion.tsx`

Secondary `Button` with the Feather `shuffle` icon, `loading` while pending, fixed-endpoints accessibility hint; hint text for disabled reasons; error text with `accessibilityRole="alert"`; preview card (the `editForm` frame) listing position badge, name, and "was N" for moved points, a warning that point days stay unchanged when the route is split by day, and "Apply"/"Dismiss" buttons; a notice after applying reminds the owner to save the route. Styles are added to `RouteBuilder.styles.ts` with existing tokens.

## Risks / Trade-offs

- The local backend answers only with `OPENROUTESERVICE_API_KEY` configured; without it the UI shows the "service unavailable" message (`503 provider_not_configured`).
- Globally optimized order ignores day labels; the preview warns about it instead of silently regrouping days.
- `bike_type` `electric` is not yet in the frontend `TripBikeType` (#1900); the request type allows it so no change is needed later.

## Migration Plan

None: additive UI, no data change.
