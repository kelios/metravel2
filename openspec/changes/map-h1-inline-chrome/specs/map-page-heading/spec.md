## Purpose

Define the page-level heading of the map route on the web: how many headings the
document carries before and after hydration, where the visible heading appears
in each render state of the map chrome, and what that heading is allowed to cost
in page layout.

## ADDED Requirements

### Requirement: The map route always carries exactly one page heading

The `/map` document SHALL contain exactly one level-1 heading at every observable
moment, from the first byte of the static response until the page is unloaded.
There MUST be no observable point at which the document contains zero level-1
headings, and no observable point at which it contains more than one. This holds
independently of viewport width, of whether the side panel is expanded, of
whether deferred parts of the map chrome have loaded, and of whether map data
loaded successfully.

"Observable" means detectable by a DOM query issued from outside the rendering
commit — a crawler, an automated browser check, or a page audit. Intermediate
states that exist only inside a single synchronous rendering commit are not
observable.

#### Scenario: Static response before any script runs

- **GIVEN** the static HTML of `/map` as delivered to a crawler
- **WHEN** the level-1 headings in that HTML are counted
- **THEN** the count is exactly one
- **AND** that heading carries the map page title text

#### Scenario: The runtime heading replaces the static heading

- **WHEN** the runtime map heading first appears in the document
- **THEN** the static heading is gone from the document
- **AND** a query for level-1 headings issued at any point before, during or
  after that exchange returns exactly one node

#### Scenario: Deferred chrome has not loaded yet

- **GIVEN** the page has hydrated but the deferred parts of the map chrome have
  not resolved
- **WHEN** the level-1 headings in the document are counted
- **THEN** the count is exactly one

#### Scenario: A deferred chunk never loads

- **GIVEN** the page has hydrated and a deferred chunk of the map chrome fails
  to load
- **WHEN** the level-1 headings in the document are counted
- **THEN** the count is still exactly one
- **AND** that heading carries the map page title text

#### Scenario: Map data fails to load

- **GIVEN** the map screen renders its error state instead of the map
- **WHEN** the level-1 headings in the document are counted
- **THEN** the count is exactly one
- **AND** that heading is visible to the user

#### Scenario: The user switches between chrome layouts

- **GIVEN** the page is hydrated and fully loaded
- **WHEN** the viewport crosses the mobile/desktop breakpoint, or the side panel
  is collapsed or expanded
- **THEN** a query for level-1 headings after the layout settles returns exactly
  one node
- **AND** no query issued during the transition returns two nodes

### Requirement: The visible heading is part of the map chrome, not a band above it

Once the runtime heading is mounted, it SHALL be presented inside the existing
map chrome. The heading MUST NOT occupy a full-width horizontal strip spanning
the viewport above the map, and MUST NOT be centred across the full page width.
The heading SHALL remain visible to a sighted user in every render state in
which it is mounted.

#### Scenario: Desktop web with the side panel expanded

- **GIVEN** a desktop web viewport with the map side panel expanded
- **WHEN** the page is hydrated and settled
- **THEN** the visible heading is rendered within the side panel's header area,
  above the panel's tab row
- **AND** the heading is aligned to the same left edge as the panel's tab row
- **AND** the heading is not horizontally centred

#### Scenario: Desktop web with the side panel collapsed

- **GIVEN** a desktop web viewport where the user has collapsed the side panel
- **WHEN** the page settles
- **THEN** the visible heading is rendered inside the map area as a compact
  element pinned near its top-left corner
- **AND** the heading does not overlap the collapsed panel strip

#### Scenario: Mobile web

- **GIVEN** a mobile web viewport
- **WHEN** the page is hydrated and settled
- **THEN** the visible heading is rendered inside the map area as a compact
  element
- **AND** it does not overlap the map's own control buttons

#### Scenario: The heading is readable over the map

- **GIVEN** the heading is rendered inside the map area
- **WHEN** the base map beneath it changes to any available layer, including a
  dark or high-detail one
- **THEN** the contrast between the heading text and its own background meets
  WCAG AA for its text size
- **AND** that contrast does not depend on which tiles are underneath

#### Scenario: The heading does not intercept map interaction

- **GIVEN** the heading is rendered inside the map area
- **WHEN** the user presses, drags or taps at a point covered by the heading
- **THEN** the map receives that interaction exactly as it would if the heading
  were absent

### Requirement: The heading does not reduce the height available to the map

The heading SHALL NOT consume vertical space from the map viewport. The height
of the map area on `/map` MUST equal the height it would have if the heading
were not rendered at all, on every supported web width.

#### Scenario: Desktop web map height

- **GIVEN** a desktop web viewport
- **WHEN** the height of the map area is measured after the page settles
- **THEN** it equals the viewport height minus the reserved chrome height for
  that width
- **AND** it is not reduced by the height of the heading

#### Scenario: The page does not overflow its own reserve

- **GIVEN** any supported web width, including a narrow phone width where the
  heading text wraps to more than one line
- **WHEN** the total height of the page content is measured
- **THEN** it does not exceed the viewport height minus the reserved chrome
  height for that width

#### Scenario: The bottom of the map is not covered

- **GIVEN** a web width at which a fixed bottom bar is present
- **WHEN** the bottom edge of the map area is compared with the top edge of that
  bar
- **THEN** the map area ends at the top edge of the bar rather than continuing
  underneath it

#### Scenario: Wrapping does not change the map height

- **GIVEN** a locale or viewport width at which the heading text occupies more
  than one line
- **WHEN** the height of the map area is measured
- **THEN** it is the same as at a width where the heading occupies one line

### Requirement: The heading preserves its text and its metadata contract

The heading SHALL present the map page title without truncation, and the change
of its position MUST NOT alter the route's metadata.

#### Scenario: The heading text is complete

- **GIVEN** any supported locale and any supported web width down to the
  narrowest one
- **WHEN** the rendered heading text is read
- **THEN** it is the full map page title with no ellipsis and no clipped
  characters
- **AND** it does not include the site-name suffix used in the document title

#### Scenario: Long translations wrap rather than truncate

- **GIVEN** a locale whose translation of the map page title is longer than the
  default one
- **WHEN** the heading is rendered at the narrowest supported width
- **THEN** the text wraps onto additional lines
- **AND** no part of the text is hidden or replaced by an ellipsis

#### Scenario: Route metadata is unchanged

- **WHEN** the document title, meta description, canonical URL, robots
  directives, Open Graph tags and structured data of `/map` are compared with
  their values before this change
- **THEN** each is identical

#### Scenario: Neighbouring routes are unaffected

- **WHEN** the heading presentation of the routes that share the previous
  heading treatment is inspected
- **THEN** each keeps the heading presentation it had before this change
