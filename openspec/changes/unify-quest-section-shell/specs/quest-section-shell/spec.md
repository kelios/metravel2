## Purpose

Provide a consistent, navigable quest section with responsive sidebar and advertising placement across catalog, informational, map, and gameplay routes.

## ADDED Requirements

### Requirement: Quest routes retain section navigation
Catalog, city, country, scenario and map pages SHALL show the shared section sidebar on desktop and expose it through a labelled mobile menu. Gameplay SHALL retain its route/progress navigation without an additional catalog sidebar.

#### Scenario: Open the scenario directly
- **WHEN** the user opens `/quests/scenario` on desktop
- **THEN** the scenario content appears alongside the same section navigation as the catalog
- **AND** selecting a city opens that city's quest catalog rather than replacing scenario content in place

#### Scenario: Choose a city on mobile
- **WHEN** the user opens the mobile section menu and chooses a city
- **THEN** the drawer closes and the selected catalog opens
- **AND** Escape or the close control dismisses the menu without navigation

### Requirement: Advertising has one responsive placement
Configured partner offers SHALL appear alongside content on wide screens and within the content flow on narrower screens. Each page SHALL mount at most one visible advertising group. Missing configuration SHALL render no empty reserved advertising column. Geographic text SHALL use actual route context only.

#### Scenario: Scenario without a selected city
- **WHEN** advertising is configured and the scenario has no city context
- **THEN** the page shows generic partner offers with the existing advertising disclosure
- **AND** no fictional city or coordinates are assigned

#### Scenario: Gameplay already has a provider
- **WHEN** the gameplay page can show its existing local advertising provider
- **THEN** that provider uses the shared placement without a second generic advertising group

### Requirement: Page content and reading remain intact
The section layout SHALL preserve route metadata, content, filtering behavior, map interaction and gameplay progress. Responsive changes SHALL not add horizontal overflow or cover the final action with the footer or mobile dock.

#### Scenario: Resize while reading
- **WHEN** the page changes between mobile and desktop widths
- **THEN** its content remains readable within the available main column
- **AND** the page keeps one H1 and one reading scroll host

#### Scenario: Narrow phone labels
- **WHEN** a long scenario label is shown on a 320 px viewport
- **THEN** its complete text wraps within the main column
