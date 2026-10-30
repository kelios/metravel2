## Purpose

Keep global account navigation stable and usable while deferred header controls load, without changing existing responsive or native behavior.

## ADDED Requirements

### Requirement: Stable compact web account handoff

The web header SHALL keep its visible account fallback at the same position while deferred account controls are pending and SHALL preserve the existing header height through the handoff.

#### Scenario: Inner account controls remain pending

- **WHEN** a compact web header has appeared and its deferred account controls remain pending
- **THEN** the visible More link stays at its established position and remains usable
- **AND** account loading introduces no header layout-shift source

#### Scenario: Account menu becomes available

- **WHEN** the compact web account menu becomes available
- **THEN** the existing runtime menu takes over through the existing fallback-visibility behavior
- **AND** the established header height remains unchanged

### Requirement: Preserve other account layouts

The system SHALL preserve existing wide web account sizing and native account-container behavior.

#### Scenario: Wide web header loads

- **WHEN** account controls load at wide web widths
- **THEN** the existing reserved account width and header geometry remain unchanged

#### Scenario: Native compact header renders

- **WHEN** the compact native header renders account controls
- **THEN** its existing flexible account container remains present
