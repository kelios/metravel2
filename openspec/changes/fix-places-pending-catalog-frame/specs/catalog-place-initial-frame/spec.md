## Purpose

Keep the places catalog visually stable while its initial result is unresolved, including the interval before network fetching can begin.

## ADDED Requirements

### Requirement: Unresolved initial catalog preserves its loading frame

The catalog SHALL retain its loading grid while the current result has neither data nor a terminal error. A pending request that has not started fetching MUST NOT present a settled empty result.

#### Scenario: Cold route waits before fetching
- **GIVEN** a fresh guest opens the places catalog and saved state is still being restored
- **WHEN** the route commits its category selection before the first request starts
- **THEN** the existing loading grid remains mounted without an intervening empty frame
- **AND** its reserved layout does not collapse into the footer

#### Scenario: Successful nonempty response
- **WHEN** the initial request resolves with places
- **THEN** the loading grid is replaced by those places and the result count

#### Scenario: Settled empty response
- **WHEN** the initial request resolves successfully with zero places
- **THEN** the catalog presents its existing empty result and applicable reset actions

#### Scenario: Initial error
- **WHEN** the initial request ends in a terminal error without available places
- **THEN** the catalog presents its existing error and manual retry action

#### Scenario: Retained places during refresh
- **GIVEN** places are already available
- **WHEN** a filter or search update refreshes the result
- **THEN** existing places remain visible according to the existing refresh contract

### Requirement: Cold mobile catalog stays within the layout stability budget

The initial places page SHALL produce full, unfiltered layout-shift CLS at most 0.1 for each of five fresh guest visits at 390×844. No input or source filtering SHALL suppress the measurement.

#### Scenario: Production acceptance
- **WHEN** the published revision is opened five times in fresh guest contexts at 390×844 without interaction until ready
- **THEN** each visit has CLS≤0.1 and no loading-grid collapse before its result
- **AND** a desktop1280 control preserves functioning filters and catalog geometry
