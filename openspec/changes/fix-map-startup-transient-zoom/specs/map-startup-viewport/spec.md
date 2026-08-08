## Purpose

Define the observable startup viewport of the map screen: which view the map
settles on for a given search radius, which intermediate views it may not pass
through, and the tile-level and byte budget a cold start must respect on each
active web viewport.

## ADDED Requirements

### Requirement: Map startup settles on the final view without an intermediate zoom level

A cold start of the map screen SHALL move the viewport to its final startup
view without first settling on any other zoom level. The map MUST NOT apply an
intermediate view derived from the selected search radius before the final fit.
Zoom levels that Leaflet itself produces while performing a single view change
are not intermediate views for this requirement.

#### Scenario: Cold start on desktop web with the default radius

- **GIVEN** a 1350×940 desktop viewport, an empty browser cache and the default
  50 km search radius
- **WHEN** the map screen is opened and the base layer settles
- **THEN** the recorded sequence of zoom-start and zoom-end events contains no
  settled zoom level other than the final startup zoom
- **AND** no settled zoom level corresponds to the radius-derived zoom that the
  previous behaviour visited

#### Scenario: Cold start on mobile web with the default radius

- **GIVEN** a 412×823 mobile viewport, an empty browser cache and the default
  50 km search radius
- **WHEN** the map screen is opened and the base layer settles
- **THEN** the recorded zoom-event sequence contains no settled zoom level other
  than the final startup zoom
- **AND** the radius circle is visible in that first settled view

#### Scenario: Cold start before any results are available

- **GIVEN** the search radius and its centre are known but no results have been
  returned yet
- **WHEN** the map screen settles its startup view
- **THEN** the settled view shows the whole radius circle and is never wider
  than that circle
- **AND** the map does not settle on an additional zoom level once results
  arrive, unless the results tighten the view within the circle

### Requirement: The final startup view is unchanged

The change to the startup sequence MUST preserve the view the user actually
sees. The final startup centre and final startup zoom SHALL be identical to the
values observed before the change for the same viewport, radius and data.

#### Scenario: Final desktop view is preserved

- **WHEN** the desktop startup view settles at 1350×940 with the default radius
- **THEN** the final zoom is 9
- **AND** the final centre matches the pre-change centre within the recorded
  measurement tolerance

#### Scenario: Final mobile view is preserved

- **WHEN** the mobile startup view settles at 412×823 with the default radius
- **THEN** the final zoom is 8
- **AND** the final centre matches the pre-change centre within the recorded
  measurement tolerance

#### Scenario: Startup view is visually identical

- **WHEN** the settled startup view is captured on each web viewport and
  compared with the pre-change capture of the same viewport, radius and data
- **THEN** the map area matches the pre-change baseline, with differences
  limited to tile decode timing and no shift of map content

### Requirement: Startup requests tiles for one zoom level within a byte budget

A cold start SHALL request base tiles for the final zoom level only, tolerating
at most one neighbouring zoom level produced by the map engine's own behaviour
during a single view change. Startup tile bytes MUST stay within the recorded
budget for each viewport, measured against the tile format in force at the time
of the change.

#### Scenario: Desktop startup tile inventory

- **GIVEN** at least five cold runs at 1350×940 with an empty cache
- **WHEN** the base-layer tile requests of each run are grouped by their zoom
  level
- **THEN** the median run contains at most two distinct zoom levels, one of
  which is the final startup zoom
- **AND** the median total of downloaded startup tile bytes is at most
  900 KiB, down from the recorded 1,748 KB baseline

#### Scenario: Mobile startup tile inventory

- **GIVEN** at least five cold runs at 412×823 with an empty cache
- **WHEN** the base-layer tile requests of each run are grouped by their zoom
  level
- **THEN** the median run contains at most two distinct zoom levels, one of
  which is the final startup zoom
- **AND** the median total of downloaded startup tile bytes is at most
  650 KiB, down from the recorded 750 KB baseline

#### Scenario: The removed zoom level never returns

- **WHEN** the startup tile inventory of any measured run is grouped by zoom
  level
- **THEN** no group corresponds to the radius-derived zoom level that the
  previous behaviour requested
- **AND** the count of tiles for that level is zero

#### Scenario: Evidence reports every observed level

- **WHEN** the startup measurement is reported
- **THEN** the report lists every observed zoom level with its tile count and
  downloaded bytes for each viewport
- **AND** a run that omits a level or reports only a total is not accepted as
  evidence

### Requirement: Startup keeps its existing delivery and failure behaviour

Reducing the number of startup zoom levels MUST NOT be achieved by suppressing,
delaying or substituting tiles. The map SHALL keep requesting base tiles from
its single existing tile source and SHALL keep its current behaviour when a tile
cannot be delivered.

#### Scenario: Tiles are still requested from the single source

- **WHEN** the startup tile requests are inspected
- **THEN** every base tile is requested from the established tile proxy path
- **AND** no additional tile source, second variant of the same tile, or
  duplicate URL for one tile position appears

#### Scenario: A tile fails to load

- **WHEN** a base tile request fails during startup
- **THEN** the map keeps its existing retry and empty-cell behaviour
- **AND** the failure does not change the settled centre or zoom

#### Scenario: The base layer is not withheld

- **WHEN** the startup sequence runs
- **THEN** the base layer is attached as soon as the map can render it
- **AND** no timer, reveal delay or suppressed layer is used to reduce the
  measured tile count

### Requirement: Later view changes and other map modes are unaffected

Removing the transient startup view SHALL NOT change any view change that
happens after startup, nor the startup behaviour of the map's route mode.

#### Scenario: The user changes the search radius

- **WHEN** a different search radius is selected after the startup view settled
- **THEN** the map re-fits to the new radius circle as it did before the change
- **AND** the new settled view shows the whole new circle

#### Scenario: The user focuses a point or cluster

- **WHEN** a marker or cluster is activated after startup
- **THEN** the map performs its existing focus movement and zoom
- **AND** clustering continues to use the settled zoom value after that movement

#### Scenario: Route mode is opened

- **WHEN** the map screen is opened in route mode
- **THEN** its startup view settles exactly as it did before the change

#### Scenario: The shared map configuration on Android is unchanged

- **WHEN** the same map screen is opened in a locally built Android app on the
  connected USB device
- **THEN** the map renders its startup view with the same centre semantics,
  radius circle and points as before the change
- **AND** no new startup error, blank map or missing base layer appears
