## Purpose

Let a planned-trip owner ask the server for a better visiting order of the draft route points and decide explicitly whether to apply it.

## ADDED Requirements

### Requirement: Owner-only suggestion action
The system SHALL show a "Suggest optimal order" action inside the route points step only to the trip owner, only when the draft route has at least three points, and only when the trip transport is car, bicycle, or walking.

#### Scenario: Route with three or more points
- **WHEN** the owner opens the planner with three or more draft points on a car, bicycle, or walking trip
- **THEN** the suggestion action is visible and enabled

#### Scenario: Route with fewer than three points
- **WHEN** the draft route has one or two points
- **THEN** the suggestion action is not shown

#### Scenario: A point has no coordinates
- **WHEN** at least one draft point has no finite coordinates
- **THEN** the action is disabled and a hint explains that every point needs coordinates

### Requirement: Single snapshot request
The system MUST send exactly one `POST /api/routing/optimize/` request per press with the draft points as `{lat, lng}` in draft order, `transport_mode`, and `bike_type` only for bicycle trips, and MUST NOT send point ids, names, or descriptions.

#### Scenario: Owner presses the action on a bicycle trip
- **WHEN** the owner presses the action on a bicycle trip with a selected bike type
- **THEN** one request is sent with all point coordinates, `transport_mode: "bike"`, and the selected `bike_type`

### Requirement: Preview without side effects
The system SHALL present the returned order as a preview listing each point with its new position and previous position, and SHALL keep the draft route, the saved trip, and the map unchanged while the preview is shown.

#### Scenario: Server returns a different order
- **WHEN** the response is a valid permutation different from the draft order
- **THEN** the preview lists the points in the suggested order
- **AND** the draft list and the map still show the manual order

#### Scenario: Server returns the identity order
- **WHEN** the response order equals the draft order
- **THEN** the system shows a notice that there is nothing to reorder and offers no "Apply" action

### Requirement: Explicit apply or dismiss
The system SHALL reorder the draft only when the owner presses "Apply", using the existing reorder arithmetic so an open point editor follows its point, and SHALL leave the draft untouched when the owner presses "Dismiss".

#### Scenario: Apply
- **WHEN** the owner presses "Apply"
- **THEN** the draft points take the suggested order and the preview closes
- **AND** saving the route sends the reordered list

#### Scenario: Dismiss
- **WHEN** the owner presses "Dismiss"
- **THEN** the preview closes and the draft order is unchanged

### Requirement: Stale answers are discarded
The system MUST discard a pending or shown suggestion when the draft points, their coordinates, the transport, or the bike type change after the request was sent.

#### Scenario: Draft changes while waiting
- **WHEN** the owner adds, removes, moves, or edits a point before the response arrives
- **THEN** the response is not shown and not applied

### Requirement: Failure reporting
The system SHALL keep the manual order and show a localized, non-technical message for every failed request: invalid request, authentication required, provider unavailable or not configured, rate limit, incomplete optimization, timeout, invalid response, missing endpoint, and offline.

#### Scenario: Provider not configured
- **WHEN** the server answers 503 with code `provider_not_configured`
- **THEN** the system shows the "service unavailable" message and no preview
