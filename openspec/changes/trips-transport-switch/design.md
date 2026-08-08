## Context

See [proposal.md](proposal.md) for motivation and [the capability spec](specs/planned-trips-transport-switch/spec.md) for observable behavior.

The planned-trip detail query owns the canonical `PlannedTrip` object through React Query. `RouteBuilder` receives that object, keeps only editable route points as local draft state, and derives saved geometry, summary, and routing state from the query result when the draft still matches the saved route. The existing full-trip update request already maps frontend transport values to backend values, but its payload includes unrelated editable fields and therefore cannot satisfy the focused-request contract.

The deployed backend is a read-only dependency for this frontend change. It accepts `car`, `walk`, and `bicycle` on the planned-trip detail PATCH and rebuilds route data within that response. No backend repository changes are planned.

## Goals / Non-Goals

**Goals:**

- Keep the planned-trip query cache as the single canonical source for the persisted transport and rebuilt route data.
- Reuse the existing transport mapping, route-state normalization, query keys, styling tokens, and segmented-control behavior.
- Isolate the focused transport mutation from the full edit mutation so payload and request-count tests can enforce the API contract.
- Keep failure recovery local to the route workspace without changing the saved trip or draft route.

**Non-Goals:**

- Generalize all planned-trip mutations into a new abstraction.
- Move transport mapping or route estimation into UI code.
- Add optimistic route calculation, background polling, or client-side route rebuilding.
- Extract or redesign the existing segmented-control primitive unless implementation reveals a concrete accessibility blocker that cannot be fixed safely in place.

## Decisions

### Add a focused transport request and input contract

Add a transport-only input type to the planned-trip domain types and a dedicated request function in the existing planned-trip request module. The request accepts only `car`, `foot`, or `bike` from the frontend domain, uses the existing transport mapper, and sends one PATCH body containing only `transport_mode`. The response continues through the existing trip normalizer so geometry, summary, and routing state use the established contracts.

An explicit trips-mock mode may update the in-memory fixture for isolated UI tests and local mock development. A real API failure MUST propagate; the focused request will not use the automatic missing-endpoint fallback that can turn a 404/501 into apparent success.

Alternative considered: reuse the full-trip update function. Rejected because it sends title, description, date, visibility, capacity, and cover fields, creating stale-write risk and violating the exact payload requirement.

Alternative considered: PATCH transport and call the route endpoint separately. Rejected because the backend already rebuilds within the PATCH and the capability requires one request.

### Encapsulate cache synchronization in a dedicated mutation hook

Add a focused React Query mutation beside the existing planned-trip mutations. On success it writes the complete normalized response into the trip-detail cache, invalidates collection queries whose cards or filters can expose transport, and returns the same object to the caller. `RouteBuilder` then aligns its local route-point draft with the returned route so its saved/draft signature immediately selects the returned geometry, summary, and routing state.

No optimistic cache update is used. Keeping the persisted trip unchanged during the request makes rollback unnecessary and guarantees that failure leaves all route fields consistent.

Alternative considered: mutate local component transport state and refetch the trip. Rejected because it creates an intermediate transport/geometry mismatch and an additional request.

### Reuse the existing segmented control and transport presentation dictionaries

Render the control only in the owner branch, directly above the route map. Use the existing three shared frontend transport values in the order `car`, `foot`, `bike`; labels come from the current localized transport dictionary and the request adapter maps them to `car`, `walk`, `bicycle`. The existing segmented control already supports a radio group, selected/disabled accessibility state, keyboard activation through press semantics, theming, and 44-pixel minimum height across web and native.

The component is imported from its current shared-use location because several non-map consumers already use it. Moving it during this feature would expand the regression surface without changing behavior.

Alternative considered: build new Pressable chips inside `RouteBuilder`. Rejected because that would duplicate selection, focus, disabled, and touch-target behavior.

### Treat the server response as an atomic state boundary

The displayed selection remains bound to `trip.transport`, not to the last pressed option. During the mutation the selector is disabled and the prior map and summary remain visible. Success replaces the cached trip and local saved route together. Failure preserves the prior state and renders a localized inline error adjacent to the selector; selecting again clears the stale error before retry.

This approach prevents request races without cancellation logic because the UI cannot start a second mutation while the first is pending.

Alternative considered: optimistic selection with rollback. Rejected because route geometry, summary, and fallback status cannot be predicted as one coherent optimistic result.

### Keep localization and accessibility inside existing contracts

Reuse existing localized transport labels for the three options. Add only the group label and focused failure/busy copy to the `trips` namespace for RU, BE, UK, PL, and EN. The group exposes its purpose; individual segments expose localized names plus checked and disabled state. Visual disabled/error states use theme tokens and do not rely on color alone.

No SEO or analytics changes are required: the workspace is authenticated, URLs and metadata do not change, and the task contract does not introduce a new product event.

## Affected frontend paths

- `api/plannedTripsTypes.ts`: focused input type constrained to the three supported modes.
- `api/plannedTripsRequests.ts`: exact PATCH payload, explicit-mock behavior, and normalized response.
- `api/plannedTrips.ts`: existing facade re-export remains the public API surface.
- `hooks/usePlannedTripsApi.ts`: mutation and cache synchronization.
- `components/trips/planning/RouteBuilder.tsx` and its styles: owner-only control, pending state, inline error, and response application.
- `components/MapPage/SegmentedControl.tsx`: reused unchanged unless a validated accessibility defect requires the smallest compatible fix.
- `i18n/locales/{ru,be,uk,pl,en}` trips resources: any new group, busy, and error copy.
- Focused adapter, hook/component, planner-screen, browser, and Android validation artifacts.

## Data and API contract

| Frontend choice | PATCH body | Success source of truth |
| --- | --- | --- |
| `car` | `{ "transport_mode": "car" }` | Normalized PATCH response |
| `foot` | `{ "transport_mode": "walk" }` | Normalized PATCH response |
| `bike` | `{ "transport_mode": "bicycle" }` | Normalized PATCH response |

The mutation sends no unrelated trip fields and no second rebuild request. The returned `transport_mode`, `route_geometry`, `route_summary`, `routing_state`, route points, and unrelated trip fields are normalized together. Authorization remains enforced by the existing owner-aware screen and backend permissions; a server authorization failure is shown as an update error and is never converted to mock success.

## Risks / Trade-offs

- [The response route points may receive different identifiers or normalization] → Replace the component's saved route draft with the returned route before deriving geometry and summary.
- [A rapid repeated press could start duplicate requests] → Ignore the current value and disable all segments synchronously while the mutation is pending; assert request cardinality in tests.
- [The existing generic segmented control lives under the map directory] → Reuse it without relocation for this bounded change and leave any component move to a separately justified refactor.
- [Automatic development fallbacks could hide a missing production contract] → Permit fixture mutation only when mock mode is explicitly enabled and propagate all real API failures.
- [Long translations can compress three equal-width segments on narrow screens] → Use the existing dense/compact responsive behavior, verify all five locales at the narrow mobile width, and keep full accessible labels even if visual text needs bounded layout treatment.
- [Transport updates affect list cards and transport-filtered catalogs] → Update the detail cache immediately and invalidate existing planned/public/community collection keys after success.

## Migration Plan

1. Add the focused request and mutation behind the existing owner-only route workspace; no persisted client migration or backend rollout is needed.
2. Add the selector and localized states, then run focused unit/integration checks before shared platform validation.
3. Validate the same owner flow on desktop web, mobile web, and a locally installed Android build, including success, failure, pending, and degraded-route states where controllable.
4. Deployment is outside this change. If a later authorized deployment reveals a regression, roll back the frontend commit; the backend contract and stored trip data remain compatible because the request uses the existing field and endpoint.

## Validation Matrix

| Surface | Required evidence |
| --- | --- |
| API adapter | Exact body for all three modes, one PATCH, no rebuild call, normalized response, and real-error propagation |
| React Query/component | Owner-only rendering, no-op current choice, disabled pending state, atomic success, preserved state plus localized error on failure |
| Desktop web | Mouse and keyboard activation; selection/map/summary/fallback consistency; console and network clean |
| Mobile web | Narrow layout, 44 px touch targets, same option order and states, console and network clean |
| Android | Locally built and installed app on USB device; same owner flow, 44 dp targets, pending/error/fallback parity |
| Locales | RU/BE/UK/PL/EN labels, group/error text, layout fit, and i18n contract checks |
| Regression | Existing route point editing/saving, non-owner read-only route, planner tabs, and nearby planned-trip cache consumers |
