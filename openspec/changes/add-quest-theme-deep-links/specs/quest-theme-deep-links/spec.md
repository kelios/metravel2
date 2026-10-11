## Purpose

Allow guests and signed-in users to open a thematic quest catalog selection from a shared URL with predictable priority and safe seasonal fallback.

## ADDED Requirements

### Requirement: Explicit theme URL selection
The catalog SHALL interpret an explicitly present `theme` query as an intentional selection ahead of any saved selection. Registered active theme IDs SHALL be recognized after trimming and case normalization. Empty, repeated, unknown or inactive IDs SHALL select All quests without a quest-detail error.

#### Scenario: Active theme overrides storage
- **GIVEN** Halloween is active and a different city was saved
- **WHEN** the visitor opens `/quests?theme=HALLOWEEN`
- **THEN** the catalog selects Halloween, displays its matching quests/count and saves that selection

#### Scenario: Invalid explicit query
- **WHEN** the visitor opens a query with an empty, repeated, unknown or out-of-season theme
- **THEN** All quests is selected and saved without a detail request, error screen or automatic geolocation prompt

#### Scenario: Absent query preserves restore
- **GIVEN** an out-of-season registered theme was saved
- **WHEN** the visitor opens the catalog without `theme`
- **THEN** the saved theme remains selected according to the existing restoration contract

### Requirement: Safe alias routing
The path `/quests/theme/<id>` SHALL enter the catalog through the same theme-query contract and SHALL NOT be interpreted as quest detail.

#### Scenario: Known or unknown alias
- **WHEN** the visitor opens `/quests/theme/halloween` or `/quests/theme/unknown`
- **THEN** the catalog receives the theme parameter and applies the same valid/fallback outcome without requesting quest detail for that ID

### Requirement: Selection ownership after navigation
The catalog SHALL apply a new explicit theme navigation once, prevent delayed restoration from replacing it, and preserve subsequent manual selection/reset. Cold and warm native deep links SHALL have the same selection outcomes as web entry.

#### Scenario: Slow restoration and reset
- **GIVEN** a valid theme URL is entered while saved-state retrieval is delayed
- **WHEN** the visitor resets the catalog before that retrieval finishes
- **THEN** All remains selected and saved after the retrieval and ordinary rerenders

#### Scenario: Warm native deep link
- **GIVEN** the app already displays a different catalog selection
- **WHEN** a new `metravel://quests?theme=detective` deep link arrives
- **THEN** the detective selection is applied and later manual changes remain effective

### Requirement: Static first-frame precedence
The static catalog entry SHALL use explicit URL selection ahead of saved selection for its intro visibility and SHALL release transitional visibility after the selected state is rendered.

#### Scenario: Invalid URL with saved narrowing selection
- **GIVEN** a narrowing city selection was saved
- **WHEN** `/quests?theme=unknown` opens
- **THEN** the All-catalog intro remains available and a stale saved selection does not cause it to disappear during startup

### Requirement: Existing data-state behavior
Theme entry SHALL preserve normal catalog loading, empty and error states without fabricating matching quests or suppressing catalog failures.

#### Scenario: Catalog unavailable
- **WHEN** catalog retrieval fails after a valid theme URL entry
- **THEN** the normal catalog error/retry state appears and no quest-detail lookup or fabricated theme count replaces it
