## ADDED Requirements

### Requirement: Article-provided route profile reserve
On web, an article with a positive integer `route_track_files_count` SHALL reserve route-profile space from the first deferred map frame, before route-file loading or parsing. Profiles SHALL appear immediately when ready, consuming this space. Surplus space SHALL be released through the article's existing stable-shrink behavior without moving visible route points or moving the reader away from the map. No extra early route-file request SHALL be introduced.

#### Scenario: Cold article and deferred map module
- **WHEN** the article declares route track files but neither the map section module nor its file list has loaded
- **THEN** the map placeholder already includes the profile reserve, and the first route-block frame retains it

#### Scenario: File list resolves before deferred parsing and chart code
- **WHEN** the route list has resolved but parsing has not started or completed, or chart code is still loading
- **THEN** the profile reserve remains occupied and does not disappear for an intermediate frame

#### Scenario: Profiles fill the reserve
- **WHEN** current-article track parsing and chart code finish while the reader is on the map
- **THEN** the profiles are visible immediately and use the reserved space, without pushing already-visible route points out of the viewport

#### Scenario: Track produces no drawable profile
- **WHEN** a declared file cannot produce a profile or loading fails
- **THEN** unused space is released when existing stable-shrink rules permit, without moving visible content or retaining a permanent guessed-height gap

#### Scenario: Old or empty article payload
- **WHEN** the field is absent, zero or invalid
- **THEN** no profile reserve is added and existing route rendering remains available

#### Scenario: Article navigation during parsing
- **WHEN** navigation changes the article or file snapshot while earlier parsing is unresolved
- **THEN** earlier completion does not release the new article's reserve

#### Scenario: Native reading
- **WHEN** the same additive article field is received on Android or iOS
- **THEN** native map, profile rendering and request timing retain their existing behavior
