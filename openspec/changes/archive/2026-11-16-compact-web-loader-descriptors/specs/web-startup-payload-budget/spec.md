## ADDED Requirements

### Requirement: Compact loader descriptors preserve caller-local compatibility
The production web encoder SHALL emit a singleton `[mapId]` descriptor referencing the validated mc1 registry. The runtime SHALL also accept legacy `['mc1', mapId]` descriptors without changing caller-local module maps, ordered closures, prefix ownership, hashing, worker inputs, retry, prefetch, concurrent loading or completion. Registry version, descriptor shape and safe in-range integer validation MUST fail closed. Full delivered byte ceilings SHALL continue to include every descriptor, registry and decoder byte.

#### Scenario: New and retained descriptors
- **WHEN** a singleton or valid legacy tagged pair references a registry map
- **THEN** both expand to the same ordered upstream paths and cached loader results

#### Scenario: Distinct caller-local closures
- **WHEN** two callers use the same module ID with different closures
- **THEN** each descriptor retains its own map and ordered files

#### Scenario: Invalid metadata
- **WHEN** an unsupported version, malformed descriptor, invalid index or mismatched prefix is supplied
- **THEN** loading fails rather than accepting or guessing another registry entry

#### Scenario: Worker and delivery compatibility
- **WHEN** original object or scalar worker paths are used, or a normal release is measured
- **THEN** worker values retain identity and actual full delivered bytes are checked against the unchanged ceilings
