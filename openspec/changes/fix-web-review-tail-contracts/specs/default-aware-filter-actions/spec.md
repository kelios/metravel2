## Purpose

Ensure filter reset controls reflect actual deviation from defaults and keep data-dependent filter groups from shifting the first loaded frame.

## ADDED Requirements

### Requirement: Default-aware group clearing
Global and group clear actions SHALL be absent when the relevant selection equals declared defaults regardless of order. Group clearing SHALL restore that group's defaults coherently; selected badges SHALL continue to describe actual selection.

#### Scenario: Default countries
- **WHEN** roulette uses its BY and PL country defaults on desktop or mobile
- **THEN** neither a global clear action nor a country group clear action is offered for those defaults

#### Scenario: Changed selection reset
- **WHEN** the country selection differs from defaults and the visitor clears the group
- **THEN** BY and PL are restored in one coherent outcome without clearing unrelated groups

### Requirement: Data-dependent filter reservation
Personal-trip filter loading SHALL reserve the optional location group's layout using the same responsive geometry as its populated state, without creating a focusable fake filter.

#### Scenario: Locations arrive after first frame
- **WHEN** delayed personal-trip data supplies nonempty regions
- **THEN** the location options occupy the reserved slot without inserting a new 83px block above the list

#### Scenario: No locations exist
- **WHEN** loaded personal-trip data has no regions
- **THEN** no misleading active location control is rendered and loading semantics are removed
