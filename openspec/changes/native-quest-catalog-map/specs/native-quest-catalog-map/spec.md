## Purpose

Keep the native quest catalogue map tied to quest locations and expose truthful
data states while retaining navigation to each quest and the catalogue.

## ADDED Requirements

### Requirement: Catalogue-owned quest markers
The native quest map SHALL display supplied quest locations without a radius
filter or travel-place cluster substitution and SHALL fit all valid coordinates,
even when the complete set requires a zoom below the radius map's lower zoom.

#### Scenario: Global catalogue opens
- **WHEN** quests include valid nearby and distant `lat,lng` coordinates
- **THEN** the map uses those quest points without a radius circle or travel-place clusters
- **THEN** the original coordinate order is preserved
- **THEN** every supplied valid point is within the initial map bounds

#### Scenario: The catalogue viewport changes size
- **WHEN** the quest map's viewport changes size
- **THEN** all supplied valid points remain within its refitted bounds
- **THEN** base tiles remain available at the required lower zoom

#### Scenario: The map returns to a radius or route surface
- **WHEN** the points-only catalogue target is removed
- **THEN** the normal base lower zoom is restored without changing its height-fill protection

#### Scenario: A quest marker is selected
- **WHEN** the reader selects a quest marker
- **THEN** its quest route opens using the marker's quest identity

### Requirement: Truthful catalogue read states
The map SHALL distinguish loading, failed reads and a successful empty location set.

#### Scenario: Initial catalogue read is pending
- **WHEN** no catalogue result has arrived
- **THEN** the existing loading indicator is visible without a web-only claim

#### Scenario: Initial catalogue read failed
- **WHEN** no usable catalogue exists after a failed read
- **THEN** the reader sees the existing retryable error state
- **THEN** invoking Retry restarts the read and exposes retry activity

#### Scenario: Successful catalogue contains no valid coordinates
- **WHEN** the read succeeded but no valid quest coordinates exist
- **THEN** the existing empty-map message is visible

### Requirement: Native Back ownership
The native map SHALL retain a single Back action owned by its application header.

#### Scenario: Any native map state is rendered
- **WHEN** the map, loading, error or empty state is visible
- **THEN** the route does not add a floating or inline duplicate Back action
