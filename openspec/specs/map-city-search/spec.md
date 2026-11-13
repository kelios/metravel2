# Map city search Specification

## Purpose

Let a visitor recover an empty nearby place search by explicitly choosing a verified city beyond the current search area.

## Requirements


### Requirement: Offer verified cities after an empty nearby search

The web map SHALL offer an explicit city-lookup action only after the nearby place search has settled empty. It MUST NOT query the external geocoder automatically on mount, typing, scope changes or refocus. Verified settlements for the requested text MUST have a settlement name and finite coordinates within WGS84 bounds; a point of interest merely located in a city MUST NOT qualify as that city.

#### Scenario: City outside the current radius

- **GIVEN** a guest searches from the initial Minsk area with radius 50 km
- **WHEN** «Несвиж» has no local catalog matches, the visitor requests a city lookup and a verified city is returned
- **THEN** the city is offered as a labelled action without moving the map before selection.

#### Scenario: Local matches or an unsettled search

- **WHEN** the nearby search has matches, is pending, fails or is offline
- **THEN** no city offer is presented as recovery for that search.

#### Scenario: Unsafe or unrelated result

- **WHEN** a location result has blank, non-finite or out-of-range coordinates, lacks a settlement identity, or describes an object inside a settlement
- **THEN** it is not offered as a city.

### Requirement: City selection owns the search area and camera

An explicit city selection SHALL move the camera and make that city the manual nearby-search center. The search text, radius and category selections MUST remain unchanged, and the city MUST NOT become the visitor's trusted GPS position or route origin.

#### Scenario: Select a city

- **WHEN** the visitor selects the offered city «Несвиж»
- **THEN** the camera moves to that city and subsequent nearby results use its coordinates with the existing query, radius and categories.

#### Scenario: Late response after editing

- **WHEN** the visitor edits or clears the search before an earlier city response arrives
- **THEN** the earlier city is not offered or applied to the new search.

### Requirement: Preserve honest city recovery states

City lookup SHALL distinguish pending and failed lookup from a settled absence of verified cities. Existing nearby-search feedback and radius expansion MUST remain available.

#### Scenario: Change the search after requesting a city

- **WHEN** the visitor changes the text, interface language, radius, categories or search center
- **THEN** the previous city lookup is disarmed and any new external lookup requires another explicit action.

#### Scenario: Window focus or restored connection

- **WHEN** an armed city lookup has failed or become stale and the browser regains focus or its connection
- **THEN** that lookup does not automatically issue another external request without an explicit lookup or retry action.

#### Scenario: Offline attempt is disarmed before reconnect

- **WHEN** an explicit lookup is attempted during an offline-state race and the visitor then changes the search
- **THEN** the attempted lookup reports failure without retaining a queued request that starts later when connectivity returns.

#### Scenario: Rapid repeated actions

- **WHEN** a visitor repeats lookup or retry within one second or while a request is pending
- **THEN** the new city-lookup consumer does not start a duplicate external request in the current browser context.

#### Scenario: Display geocoder results over another basemap

- **WHEN** verified city results are displayed
- **THEN** visible OpenStreetMap contributor credit remains available with its copyright link independently of the chosen basemap.

#### Scenario: No city found

- **WHEN** city lookup succeeds without a verified city
- **THEN** the existing empty-area feedback and radius expansion remain available without a city action.

#### Scenario: Lookup fails or is slow

- **WHEN** city lookup is pending or fails
- **THEN** a corresponding localized status is shown, failure offers retry, and the map does not move.
