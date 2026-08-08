## Purpose

Enable planned-trip owners to compare supported route modes in place while keeping the selected mode, route geometry, summary, and routing status consistent with the server response.

## ADDED Requirements

### Requirement: Owner transport selection
The system SHALL offer the planned-trip owner a transport selector for car, walking, and bicycle in that order, with the trip's persisted transport selected.

#### Scenario: Owner opens a supported planned trip
- **WHEN** the owner opens the route-planning workspace for a trip whose transport is car, walking, or bicycle
- **THEN** the system shows all three transport choices in the required order and marks the persisted choice as selected

#### Scenario: Non-owner views the route
- **WHEN** a user who is not the trip owner opens the route view
- **THEN** the system does not offer that user an interactive transport selector
- **AND** the route and its current transport remain visible in read-only form

### Requirement: Focused single-request update
The system MUST commit a new transport choice with exactly one `PATCH /api/trips/planned/{id}/` request whose body contains only the selected `transport_mode` value: `car`, `walk`, or `bicycle`.

#### Scenario: Owner chooses a different transport
- **WHEN** the owner selects a supported transport different from the persisted choice
- **THEN** the system sends exactly one PATCH request for that selection
- **AND** the request body contains only the matching `transport_mode`
- **AND** the system does not send a separate route-rebuild request

#### Scenario: Owner activates the current transport
- **WHEN** the owner activates the already persisted transport choice
- **THEN** the system sends no update request

### Requirement: Pending interaction state
The system SHALL prevent overlapping transport updates while a transport change is pending and SHALL keep the last persisted route state visible until the request completes.

#### Scenario: Transport update is pending
- **WHEN** a transport update request has not yet completed
- **THEN** all transport choices are disabled
- **AND** the previously persisted selected transport, route geometry, summary, and routing status remain visible

### Requirement: Atomic successful update
The system SHALL apply the transport, route geometry, route summary, and routing status from a successful server response as one consistent route state.

#### Scenario: Server rebuild succeeds
- **WHEN** the transport update response contains the updated trip and rebuilt route data
- **THEN** the selected transport, route line, distance, duration, and routing status change together to the returned values
- **AND** unrelated trip fields and route points remain as returned by the server

#### Scenario: Server returns a degraded route
- **WHEN** the successful response reports a non-optimal or fallback route
- **THEN** the system renders the returned route state
- **AND** the existing approximate-route explanation remains visible

### Requirement: Failed update recovery
The system MUST preserve the prior persisted route state when a transport update fails and SHALL present an explicit localized error before allowing another choice.

#### Scenario: Server rejects or cannot complete the update
- **WHEN** the transport PATCH request fails
- **THEN** the prior selected transport, route geometry, summary, and routing status remain unchanged
- **AND** the system shows a localized error associated with the transport control
- **AND** the control becomes available for retry after the request settles

#### Scenario: Backend behavior is unavailable
- **WHEN** the real backend does not support or rejects the focused transport update
- **THEN** the client does not report success
- **AND** the client does not fabricate a rebuilt route from mock or local estimates

### Requirement: Cross-platform localized and accessible control
The system SHALL expose equivalent transport choices and interaction states on desktop web, mobile web, and Android in RU, BE, UK, PL, and EN.

#### Scenario: User interacts on an active platform
- **WHEN** the owner uses the transport selector on desktop web, mobile web, or Android
- **THEN** the choices appear in the same order with equivalent selected, pending, error, and retry behavior
- **AND** each choice has a localized accessible name and selected or disabled state

#### Scenario: User operates the web selector with a keyboard
- **WHEN** the owner focuses the selector on web and uses supported keyboard activation
- **THEN** the focused choice can be activated without a pointer

#### Scenario: User operates the selector by touch
- **WHEN** the owner uses the selector on mobile web or Android
- **THEN** every transport choice provides a touch target of at least 44 CSS pixels or density-independent pixels
