## Purpose

Measure whether visitors discover the places catalog and perform useful actions without exposing search text or confusing the catalog with the map surface.

## ADDED Requirements

### Requirement: Visible web navigation and catalog openings have finite attribution
The web client SHALL measure an entry impression only when at least half of the catalog link is visible, once per mounted link. It SHALL distinguish desktop_navigation, mobile_menu and direct openings, preserve real localized navigation hrefs and leave unrelated navigation unchanged.

#### Scenario: Closed mobile menu
- **WHEN** the mobile menu is closed or its catalog link has not entered the viewport
- **THEN** no catalog impression is emitted

#### Scenario: Visible navigation followed by opening
- **WHEN** a visitor activates a visible catalog link and opens the catalog
- **THEN** its impression, activation and opening retain the same finite source, including a new-tab opening via the real href

#### Scenario: Direct or invalid source
- **WHEN** the catalog is opened directly or with an unrecognized source
- **THEN** opening and subsequent events use direct without forwarding the supplied value

#### Scenario: Retained inactive tab
- **WHEN** the catalog tab stays mounted but loses focus and later regains it
- **THEN** it emits nothing while inactive and starts a new opening and first-action context on return

### Requirement: Catalog searches describe settled results without private values
The client SHALL emit one terminal search result per committed nonblank search/filter state, with found, empty or error outcome and a nonnegative results_count for successful results. It MUST exclude pending, placeholder, canceled and unrelated background or pagination changes. A successful retry after a reported error SHALL be distinguishable as a recovery.

#### Scenario: Debounced search with stale results
- **WHEN** input changes while the previous result remains visible
- **THEN** no found or empty result is reported until the matching search settles

#### Scenario: Completion, pagination and retry
- **WHEN** a search finishes, pagination/refetch repeats it, or an errored search is successfully retried
- **THEN** the first terminal outcome is reported once, pagination/refetch adds no duplicate, and successful retry adds one recovered terminal outcome

### Requirement: Catalog actions remain separate and private
The client SHALL distinguish collection, open_map and open_travel actions and mark the first action of the current catalog opening. Invalid navigation targets MUST NOT count as actions. Event payloads MUST NOT contain raw search text, category names, country names, raw URLs, titles, addresses, coordinates or local deduplication keys. Catalog events MUST NOT be emitted by /map or native screens.

#### Scenario: Collection and valid outgoing navigation
- **WHEN** a visitor chooses a collection or activates a valid map/article target
- **THEN** exactly one corresponding action event is emitted with finite source and action values

#### Scenario: Provider consent
- **WHEN** analytics consent is absent or automation is detected
- **THEN** existing transport policy prevents provider delivery; local intent observation remains available for web acceptance

### Requirement: Comparison documents its denominator and coverage
Reports SHALL provide source/device opening-session denominators separately from event counts and useful-action session aggregates. Unmeasured or empty denominators MUST remain unknown. Event-count ratios MUST NOT be presented as closed session-cohort conversions.

#### Scenario: No organic observations after release
- **WHEN** a full API response contains no observations
- **THEN** the report records the period, scope and absence of observations, and does not claim zero visibility or proven user abandonment
