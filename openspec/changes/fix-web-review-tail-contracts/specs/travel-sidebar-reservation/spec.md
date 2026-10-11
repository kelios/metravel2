## Purpose

Preserve travel sidebar bounds across lazy mount and loading transitions while keeping nearby map controls and popular items accessible.

## ADDED Requirements

### Requirement: Coordinate-aware nearby reservation
The nearby sidebar placeholder SHALL reserve a List/Map control exactly when the loaded nearby section can show it. At widths 390 and 1280, equivalent placeholder and loaded section geometry SHALL differ by no more than 1px.

#### Scenario: Route without coordinates
- **WHEN** a travel without valid origin or map points loads its nearby sidebar
- **THEN** neither placeholder nor loaded section reserves the List/Map control and their bounds agree within 1px

#### Scenario: Route with coordinates
- **WHEN** a travel with map origin or valid map points loads its nearby sidebar
- **THEN** both states reserve the same map-control row and card area

### Requirement: Stable popular reservation
Popular travel sidebar content SHALL keep one fixed responsive rail-height contract from deferred/loading through loaded state. Every existing result up to eight items SHALL remain reachable with normal rail navigation, and loading SHALL NOT shift content below the section.

#### Scenario: Eight results load
- **WHEN** eight popular routes replace the loading sidebar state at width 390 or 1280
- **THEN** the section's occupied bounds change by no more than 1px, content below does not shift, and all eight cards remain reachable

#### Scenario: Empty or failed results
- **WHEN** popular retrieval finishes empty or fails
- **THEN** normal empty/error/retry semantics remain accessible without a spinner-to-large-grid jump or fabricated cards
