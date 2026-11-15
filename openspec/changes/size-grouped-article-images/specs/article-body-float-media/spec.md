## Purpose

Ensure floated photographs in travel descriptions use the narrow rendered slot while preserving the existing full-width and mobile delivery contracts.

## ADDED Requirements

### Requirement: Floated body photographs select a narrow responsive slot
The application SHALL describe an authored left or right floated body photo as a 324 CSS pixel desktop slot and retain the existing mobile slot.

#### Scenario: Desktop narrow photo
- **WHEN** a travel description contains an authored floated photo on desktop
- **THEN** its responsive slot hint is 324px and the existing valid media ladder is retained

#### Scenario: Mobile and full-width controls
- **WHEN** the same photo is viewed on mobile or a full-width photo is rendered on desktop
- **THEN** the existing mobile slot or full-width slot respectively is preserved

### Requirement: The inert island and full render agree
The application SHALL use the same responsive slot hint for a floated body photograph before and after the deferred full renderer replaces its server island.

#### Scenario: Deferred replacement
- **WHEN** an authored floated photo is emitted by the server island and later by the full renderer
- **THEN** both expose the same sized source, source candidates and slot hint for the selected viewport

#### Scenario: Missing manifest or no responsive ladder
- **WHEN** a body photo has no manifest or has only one valid candidate
- **THEN** existing family caps and no-ladder handling remain intact
