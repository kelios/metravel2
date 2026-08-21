## Purpose

Defines how a planned-trip route can be created from a local GPX or KML file while preserving preview, explicit confirmation, route-capacity, localization, and save boundaries across web, Android, and iPhone.

## ADDED Requirements

### Requirement: Cross-platform route file selection
The system SHALL let a user select exactly one local `.gpx` or `.kml` file from the planned-trip route tools on desktop web, mobile web, Android, and iPhone. Web SHALL use the browser file chooser, while Android and iPhone SHALL use the operating-system document chooser without changing the user-visible import flow.

#### Scenario: Supported file selected on web
- **WHEN** a user invokes route import on desktop or mobile web and selects one `.gpx` or `.kml` file
- **THEN** the system reads the selected file locally and starts preparing an import preview
- **AND** it does not upload the source file

#### Scenario: Supported file selected on Android or iPhone
- **WHEN** a user invokes route import in the native application and selects one `.gpx` or `.kml` document
- **THEN** the system reads the selected document locally and starts preparing the same import preview used on web
- **AND** the source document is not retained by MeTravel

#### Scenario: File chooser is cancelled
- **WHEN** a user closes the web or native file chooser without selecting a file
- **THEN** the existing route draft remains unchanged
- **AND** no import error is shown

### Requirement: Safe and bounded input validation
The system MUST accept only GPX and KML XML content no larger than 20 MiB, MUST reject XML that declares `DOCTYPE` or `ENTITY`, and MUST validate that the document root matches the selected file format before using any coordinates.

#### Scenario: Unsupported format is selected
- **WHEN** a selected file has neither a `.gpx` nor a `.kml` extension
- **THEN** the system shows the localized unsupported-format error
- **AND** the existing route draft remains unchanged

#### Scenario: File exceeds the size limit
- **WHEN** a selected file is larger than 20 MiB
- **THEN** the system rejects it before parsing and shows the localized too-large error
- **AND** the existing route draft remains unchanged

#### Scenario: XML content is unsafe or malformed
- **WHEN** the selected document is malformed XML, its root does not match GPX/KML, or it contains `DOCTYPE` or `ENTITY`
- **THEN** the system shows the localized damaged-file error
- **AND** it does not use or display coordinates from that document

### Requirement: Imported route preview
The system SHALL parse route geometry through the established route-file parsing contract and SHALL show a preview before the route draft can be changed. The preview MUST visually distinguish the imported geometry from the current route, fit both geometries on the map, and report the imported distance, original route-point count, and named waypoints.

#### Scenario: A valid route is parsed
- **WHEN** a valid GPX or KML document contains one route geometry with at least two valid coordinates
- **THEN** the system shows that geometry over the current route using distinguishable map lines
- **AND** it shows the geometry distance, original coordinate count, and every named waypoint found in the document

#### Scenario: File contains more than one route geometry
- **WHEN** parsing produces multiple non-empty route previews
- **THEN** the system lets the user select which route geometry to preview and apply
- **AND** the statistics and map update to the selected geometry without changing the route draft

#### Scenario: File has no usable route geometry
- **WHEN** a syntactically valid GPX or KML document contains fewer than two usable route coordinates in every parsed route
- **THEN** the system shows the localized empty-route error
- **AND** it does not offer replace or append actions

### Requirement: Named waypoint preservation
The system MUST convert every named GPX waypoint and named KML point in the selected document into a named planned-route point, retaining its valid coordinates and non-empty trimmed name.

#### Scenario: Selected route has named waypoints
- **WHEN** the user applies a selected route that has named waypoints
- **THEN** each named waypoint appears in the resulting route draft as a named point
- **AND** unnamed track vertices do not receive invented names

#### Scenario: Named waypoint shares an endpoint coordinate
- **WHEN** a named waypoint has the same coordinate as the selected route start or finish
- **THEN** the resulting draft contains one route point at that coordinate
- **AND** that point retains the waypoint name

### Requirement: Controlled replace and append modes
The system SHALL require an explicit replace or append action before changing the current route draft. Replace SHALL substitute the current points with the imported result; append SHALL retain current points in order and add the imported result after them.

#### Scenario: User replaces the route draft
- **WHEN** a valid preview is open and the user confirms replace
- **THEN** the route draft contains only the processed imported route points
- **AND** the import preview closes after successful application

#### Scenario: User appends to the route draft
- **WHEN** a valid preview is open and the user confirms append
- **THEN** the existing route points remain first and in their original order
- **AND** the processed imported route points follow them in route order

#### Scenario: Append boundary has the same coordinate
- **WHEN** the last existing point and first imported point have the same coordinate
- **THEN** the resulting draft contains only one point at that join
- **AND** any non-empty name from either point is preserved

#### Scenario: User dismisses the preview
- **WHEN** a user cancels or replaces a pending import without applying it
- **THEN** no point, name, transport mode, or saved trip data is changed by that pending import

### Requirement: Route capacity and geometry simplification
The system MUST keep the complete resulting planned route at or below 50 points. It SHALL preserve the selected route's exact first and last coordinates and every named waypoint, while reducing only non-mandatory track vertices with shape-preserving simplification.

#### Scenario: Replace requires simplification
- **WHEN** a selected imported geometry has more non-mandatory vertices than fit within 50 total route points
- **THEN** the processed imported route contains no more than 50 points
- **AND** its first and last coordinates exactly match the selected geometry
- **AND** all named waypoint coordinates and names are retained

#### Scenario: Append uses the remaining capacity
- **GIVEN** the existing route draft has `N` points
- **WHEN** the user chooses append
- **THEN** the imported route is processed within the remaining `50 - N` point budget, accounting for a deduplicated join
- **AND** the complete resulting route has no more than 50 points

#### Scenario: Mandatory points cannot fit
- **WHEN** the exact imported endpoints and named waypoints cannot fit within the available replace or append budget
- **THEN** the system shows a localized route-capacity error
- **AND** the current route draft remains unchanged

### Requirement: Existing preview and explicit save boundary
Applying an import SHALL update only the local route draft and MUST enter the established live route-preview flow. The system MUST persist the imported points only after the user invokes the existing explicit save action.

#### Scenario: Imported route is applied locally
- **WHEN** the user successfully confirms replace or append
- **THEN** the route editor displays the resulting points and requests its normal live routing preview
- **AND** no route-update request is sent merely because the import was applied

#### Scenario: User saves the applied import
- **WHEN** the user invokes the existing save-route action after applying an import
- **THEN** the system sends the complete current route draft through the existing planned-route update contract
- **AND** the normal success or save-error behavior is used

#### Scenario: User leaves without saving
- **WHEN** a user applies an import but leaves the editor before invoking save
- **THEN** the imported local draft is not represented as saved server state

### Requirement: Localized and accessible import states
All import controls, statistics, modes, loading states, and errors SHALL be available in RU, BE, UK, PL, and EN with RU fallback. Every action MUST have an accessible name and keyboard or touch activation, and status or error meaning MUST be conveyed by text rather than color alone.

#### Scenario: Any production locale uses import
- **WHEN** the active locale is RU, BE, UK, PL, or EN
- **THEN** route import displays translated user-facing copy for selection, preview, replace, append, cancellation, statistics, capacity, and every validation error
- **AND** no localization key is visible to the user

#### Scenario: User navigates without a pointer
- **WHEN** a keyboard or screen-reader user opens and operates route import
- **THEN** file selection, route selection, replace, append, and cancel are named and reachable in logical order
- **AND** loading, success, and error state changes are announced or exposed as readable status text

#### Scenario: User operates import on a touch surface
- **WHEN** route import is used on mobile web, Android, or iPhone
- **THEN** primary and tool actions meet the project's minimum touch-target size
- **AND** the hierarchy, action set, and result match across all three mobile surfaces
