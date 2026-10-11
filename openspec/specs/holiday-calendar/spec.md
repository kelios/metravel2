# holiday-calendar Specification

## Purpose

Обеспечить ежегодное автоматическое праздничное оформление по местной дате посетителя, сохраняя ручной выбор и одинаковый вид до и после загрузки приложения.

## Requirements

### Requirement: Automatic calendar periods
The system SHALL use automatic mode by default and evaluate inclusive periods using the visitor's local civil date: spring 1–10 March, autumn 15 September–14 October, Halloween 15 October–1 November, and Christmas 1 December–14 January across the year boundary. Outside all periods, the ordinary appearance SHALL apply.

#### Scenario: Existing holiday boundaries
- **WHEN** automatic mode reaches 15 October, 1 November, 2 November, 1 December, 14 January or 15 January
- **THEN** the active appearance is respectively Halloween, Halloween, ordinary, Christmas, Christmas or ordinary

#### Scenario: New seasonal boundaries
- **WHEN** automatic mode reaches 1 March, 10 March, 11 March, 15 September or 14 October outside any Easter window
- **THEN** the active appearance is respectively spring, spring, ordinary, autumn or autumn

#### Scenario: No stored preference
- **WHEN** a visitor with no saved preference loads the site during an active period
- **THEN** that period's theme applies automatically without a selection step

### Requirement: Movable Easter period
The system SHALL calculate Western and Orthodox Easter for the current civil year and apply the same Easter theme during each inclusive window from seven days before to two days after its date. Overlapping windows SHALL merge without duplicates; any gap between disjoint windows SHALL use the otherwise applicable appearance. Language SHALL NOT determine religious calendar or date.

#### Scenario: Dates coincide
- **WHEN** both Easter dates coincide in a year
- **THEN** one Easter period covers the ten inclusive calendar days from seven days before to two days after that date

#### Scenario: Dates differ
- **WHEN** the dates produce disjoint windows
- **THEN** Easter is active in both windows and inactive in their gap unless another calendar period applies

#### Scenario: Boundary days
- **WHEN** the local date is eight days before, seven days before, two days after or three days after either Easter date and outside the other Easter window
- **THEN** Easter is respectively inactive, active, active or inactive

### Requirement: Stable preference and conflict resolution
The system SHALL preserve saved auto/off/manual choices. Off SHALL suppress all seasonal appearance; a valid manual choice SHALL override calendar periods. Unknown saved values and inaccessible storage SHALL safely use automatic mode. Easter SHALL outrank seasonal spring/autumn periods; calendar selection SHALL NOT depend on ordering of options.

#### Scenario: Manual override and return to automatic mode
- **WHEN** a visitor selects Halloween during the Christmas period and later selects automatic mode
- **THEN** Halloween remains until automatic mode is selected, after which Christmas applies

#### Scenario: Explicit disable
- **WHEN** off is selected during any active period and the page reloads
- **THEN** ordinary appearance remains with no seasonal decoration

#### Scenario: Invalid or unavailable storage
- **WHEN** a saved value is unknown or reading storage throws
- **THEN** the active calendar theme applies without an uncaught error or a required persistence write

#### Scenario: Overlapping periods
- **WHEN** Easter and another seasonal period match the same date
- **THEN** Easter wins consistently regardless of presentation order

### Requirement: Date transitions and first-frame consistency
The system SHALL update automatic appearance within two seconds after local midnight in a continuously visible responsive tab and immediately when an overdue tab resumes execution through focus, visibility or restoration. Manual/off preferences SHALL remain unchanged. The initial appearance SHALL match the post-load appearance for the same date and preference without an ordinary/opposite-theme flash.

#### Scenario: Visible midnight
- **WHEN** a continuously visible tab crosses a start or end boundary at local midnight
- **THEN** automatic appearance reflects the new date within two seconds under normal browser scheduling

#### Scenario: Sleeping or restored tab
- **WHEN** a tab resumes after crossing a period boundary while suspended
- **THEN** it recomputes the active theme when execution resumes without needing a reload

#### Scenario: Daylight saving change
- **WHEN** the next local civil day is separated by 23 or 25 hours
- **THEN** the appearance transition follows local midnight rather than a fixed 24-hour delay

#### Scenario: First-frame match
- **WHEN** a page loads at an Easter boundary or across the Christmas year boundary with a saved preference
- **THEN** first-frame and loaded appearances agree and the saved light/dark mode remains independent
