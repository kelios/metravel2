# travel-deferred-flow-stability Specification

## Purpose

Keep the reader's visible article sections stable while lower asynchronous content grows or resolves empty, across mobile and desktop web geometry.

## Requirements

### Requirement: Stable following content during asynchronous geometry changes
The article SHALL preserve the viewport position of already-visible following sections when an earlier deferred section changes height at the same responsive width. When that change starts below the reading line, the section under the reading line SHALL keep its viewport position instead and the following content SHALL take the change. The article SHALL preserve the user's scrolling and SHALL NOT leave a permanent guessed-height empty tail.

#### Scenario: Nearby resolves empty
- **WHEN** the nearby loading frame starts at or above the reading line and resolves to its compact empty state while popular or related articles are visible
- **THEN** the visible following section retains its viewport position and the empty message remains accessible without a permanent loading-height gap

#### Scenario: Loaded upstream slot changes height
- **WHEN** an already-mounted lower content slot grows or shrinks above the reader's visible sidebar, comments or footer
- **THEN** those following sections retain their viewport position throughout the update without an additional viewport jump or a permanent blank loading gap

#### Scenario: Excursions fallback resolves inside the map composition
- **WHEN** the existing Excursions fallback is replaced by its loaded section or that section grows again above Map/Points
- **THEN** Map/Points retain their viewport positions throughout the replacement and later content growth, while legitimate empty content leaves no reserved loading gap

#### Scenario: New nested content in a placeholder replacement
- **WHEN** a loading placeholder is replaced by its first real content containing a newly appearing nested section
- **THEN** an already-visible following section retains its viewport position and newly inserted content is not treated as the reader's previous position
- **AND** when no following reading frame is visible, the new section still takes its natural height without an unexpected scroll; later resizing and empty-content resolution preserve the reader's position without double movement

#### Scenario: Late block grows below the section the reader opened
- **WHEN** the reader opens a section from the article menu, the section is parked at the reading line, and a later block (similar articles, related-route arrows, a resolved nearby list) grows or shrinks below that line while a following section is still visible
- **THEN** the opened section stays within 20px of its parked position at 1440×900 and 390×844, the following section moves by the height of the change, and the article scroll offset is not rewritten for that change

### Requirement: Full-scroll article CLS budget
The article SHALL keep cumulative layout shifts without recent input at or below 0.1 during five complete fresh guest traversals at both 390×844 and 1440×900. Its mobile Lighthouse performance median SHALL remain at least 60.

#### Scenario: Complete article traversal
- **WHEN** each fresh guest visit to the affected article waits six seconds, then sends 120 wheel steps of 500px separated by 200ms and observes another two seconds
- **THEN** the actual article scroll owner reaches its bottom with the resolved footer and every traversal has supported layout-shift observation and cumulative CLS at most 0.1
- **AND** wheel input is hit-tested against that owner, its first step advances the article, and chosen coordinates/owner bounds are recorded; a traversal that stays at top is invalid
- **AND** the eligible fixture has resolved its Excursions flow to the actual positive-height section rather than retaining its loading placeholder; iframe mount/height are recorded and its viewport activation is verified separately

### Requirement: Article-provided route profile reserve
On web, an article with a positive integer `route_track_files_count` SHALL reserve route-profile space from the first deferred map frame, before route-file loading or parsing. Profiles SHALL appear immediately when ready, consuming this space. Surplus space SHALL be released through the article's existing stable-shrink behavior without moving visible route points or moving the reader away from the map. No extra early route-file request SHALL be introduced.

#### Scenario: Cold article and deferred map module
- **WHEN** the article declares route track files but neither the map section module nor its file list has loaded
- **THEN** the map placeholder already includes the profile reserve, and the first route-block frame retains it

#### Scenario: Initial server-rendered article data
- **WHEN** the public API includes a valid route track file count and the background detail request has not completed
- **THEN** the serialized initial article loader payload retains that count, including zero, through the shared article normalization contract

#### Scenario: File list resolves before deferred parsing and chart code
- **WHEN** the route list has resolved but parsing has not started or completed, or chart code is still loading
- **THEN** the profile reserve remains occupied and does not disappear for an intermediate frame

#### Scenario: Profiles fill the reserve
- **WHEN** current-article track parsing and chart code finish while the reader is on the map
- **THEN** the profiles are visible immediately and use the reserved space, without pushing already-visible route points out of the viewport

#### Scenario: The SVG replaces the chart reserve under web media CSS
- **WHEN** the profile measures its width and replaces its chart reserve with the real SVG while the reader can see the profile
- **THEN** the SVG retains the reserve's chart height despite the shared responsive media reset, and internal profile cards do not shift

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
