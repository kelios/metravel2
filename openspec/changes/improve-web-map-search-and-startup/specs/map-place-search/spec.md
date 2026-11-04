## ADDED Requirements

### Requirement: Recover from radius-limited place searches

The web map SHALL expose the active search scope and distinguish pending, empty and failed radius searches.

#### Scenario: Start a mobile search

- **WHEN** the visitor taps the labeled search action
- **THEN** the map opens and focuses the place-name input.

#### Scenario: Expand a settled empty search

- **WHEN** an active search returns zero results and the visitor selects a wider radius
- **THEN** the map preserves the query and evaluates it in the new radius.

#### Scenario: A search fails

- **WHEN** the active search cannot finish because the request fails
- **THEN** the map shows an error and a retry action.
