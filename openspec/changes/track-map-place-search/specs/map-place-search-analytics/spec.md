## ADDED Requirements

### Requirement: Record settled web map place searches

The web map SHALL report `map_place_search` through the existing consent-aware analytics transport for a non-empty place-name search with a settled response in radius mode. The explicit payload SHALL include only `outcome`, `layout` and `radius_km`.

#### Scenario: The active search settles

- **WHEN** the debounced query matches the current input and the active radius request settles while the map is focused
- **THEN** the event reports `found`, `empty` or `error` according to the returned map results and request status.

#### Scenario: The input changes before the response

- **WHEN** the input no longer matches the debounced query, the result is a placeholder, or the request is pending
- **THEN** the app sends no event for that state.

#### Scenario: The same term stays in the field

- **WHEN** the settled result re-renders, refetches, paginates, or the user returns to the still-mounted screen
- **THEN** the app does not send a second event for the same reported term and radius until a different term or radius is reported, or the field is cleared.

#### Scenario: Another map mode or a native client is active

- **WHEN** the map uses route mode or the client is native
- **THEN** the web radius search event is not delivered.
