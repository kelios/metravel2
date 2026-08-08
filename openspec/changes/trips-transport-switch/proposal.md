## Why

The planned-trip route builder displays the current transport as a static label even though the deployed API already supports changing `transport_mode` and rebuilding the route in the same request. Owners need to compare car, walking, and bicycle routes without leaving the planner or reopening the full edit form.

## What Changes

- Add an owner-only segmented transport control above the planned-trip map for car, walking, and bicycle modes.
- Send exactly one focused `PATCH /api/trips/planned/{id}/` request with `transport_mode` and apply the returned transport, geometry, summary, and routing state atomically.
- Disable the control while the request is pending and preserve the prior route plus an explicit error state when the request fails.
- Preserve the existing direct/degraded route hint when the routing provider cannot produce an optimal route.
- Add localized labels and accessibility text for RU/BE/UK/PL/EN using the existing `trips` namespace and transport dictionaries.
- Add regression coverage for the exact payload, one-request invariant, pending/error states, and shared UI behavior.

### User-visible result

The trip owner can switch among car, walking, and bicycle directly above the route map. The selected segment, route line, distance, duration, and routing state update together after the server responds.

### Existing behavior to preserve

- Non-owners cannot edit the trip or see an enabled transport control.
- A provider fallback remains renderable through the existing approximate-route hint.
- Route points, visibility, dates, participants, and unrelated edit fields are not changed by a transport-only action.
- Mobile web and Android expose the same segment order, states, and touch semantics.

### Dependencies and fallback/mock policy

- The existing backend contract is deployed and represented by `transportToBe`: `car`, `walk`, and `bicycle` are the accepted API values; the backend rebuilds the route inside the same PATCH response.
- There is no hard dependency on another open task. The bicycle subtype task remains separate.
- Mock data may support layout and state tests only. Missing or rejected backend behavior must not be reported as success and must not trigger a client-fabricated route.

### Out of scope / Non-goals

- Bicycle subtype selection (`regular`, `road`, `mountain`).
- New routing endpoints, a second rebuild request, or backend changes.
- Public-transport and mixed-mode controls.
- Redesigning the planner, route point editor, or summary bar.
- Deployment or production publication.

### Open questions

None. The board Task Contract and existing API adapter define the observable behavior and request shape.

## Capabilities

### New Capabilities

- `planned-trips-transport-switch`: Owner transport selection, one-request route rebuild, pending/error behavior, and cross-platform accessibility contract.

### Modified Capabilities

None; no living OpenSpec capability currently covers planned-trip transport selection.

## Impact

- **Frontend paths:** planned-trip route builder/screen, planned-trip API request adapter/types, `trips` localization resources, and focused Jest/browser/device tests.
- **Data/API:** reuses `PATCH /api/trips/planned/{id}/` with `{ transport_mode: 'car' | 'walk' | 'bicycle' }`; no backend schema or endpoint change.
- **Platform impact:** shared — desktop web, mobile web, and Android; mobile web and Android require paired validation.
- **Localization impact:** all current locales — RU/BE/UK/PL/EN.
- **Accessibility:** the control needs a group label, selected/busy/disabled semantics, keyboard access on web, and touch targets of at least 44 dp.
- **Performance:** one request per committed selection; no request storm and no additional route rebuild call.
- **SEO:** none; this is an authenticated planner interaction with no URL or metadata change.
- **Security:** no new credentials or trust boundary; owner authorization remains enforced by the existing API and UI ownership state.
- **Analytics:** no new event is required; existing trip update/routing observability remains unchanged.
