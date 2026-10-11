## Purpose

Keep map category selections consistent across URL and data modes, with honest point identity and count scope under partial dictionary or paginated data.

## ADDED Requirements

### Requirement: Complete category selection
The map SHALL recognize registered category numeric IDs and legacy names from URL and interactive selection. Mixed selections SHALL retain OR semantics; unresolved members SHALL NOT be silently dropped when another member resolves. Dictionary loading SHALL NOT erase a pending selection.

#### Scenario: Numeric category URL
- **WHEN** `/map?categories=43` opens and the dictionary names category 43 Castle
- **THEN** Castle is selected and radius/marker/list filtering uses its registered identity

#### Scenario: Mixed dictionary coverage
- **WHEN** one selected category resolves to an ID and another selected name does not
- **THEN** matching loaded points from either category remain eligible, and the selection is not falsely represented as fully server-filtered

#### Scenario: Slow or unavailable dictionary
- **WHEN** category dictionary loading is delayed or fails
- **THEN** pending URL tokens remain available for later resolution and existing loading/error or loaded-data filtering behavior remains visible without fabricated counts

### Requirement: Honest map identity and count scope
Point totals SHALL be described as points rather than unique places unless authoritative place identity exists. Counts derived only from loaded pages SHALL state that scope. Map SEO title/description SHALL NOT falsely claim a fixed country when the map is centered elsewhere.

#### Scenario: Krakow radius
- **WHEN** the map is centered on Krakow at 50km and multiple point records share coordinates
- **THEN** the displayed total describes points, the heading does not claim Belarus, and loaded category counts are distinguished from radius-wide totals in every supported locale

#### Scenario: More pages arrive
- **WHEN** a new page adds categories or points
- **THEN** loaded-scope counts update without being represented as an authoritative complete-radius facet
