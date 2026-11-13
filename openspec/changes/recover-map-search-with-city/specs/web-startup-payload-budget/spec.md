## ADDED Requirements

### Requirement: Deferred static leaves preserve protected web module IDs

The production numeric granular web serializer SHALL allocate its protected paths before remaining lazy-only static paths. The fixed priority order MUST be initial synchronous ownership and premodules, existing async/worker/weak boundary identities, then effective home/layout delivered modules including foreign shared factories and their synchronous closure. Each tier MUST use deterministic code-unit path ordering and first-wins deduplication. For unchanged protected path/edge/ownership/boundary sets and canonical layout, changes confined to remaining lazy static leaves MUST NOT renumber protected paths. This contract MUST NOT change chunk ownership, delivery requirements, the scoped allocator, metadata codec, filename hashing, factory ABI or exact FULL byte ceilings.

#### Scenario: Lazy-only static insertion
- **WHEN** two static leaves are inserted at different lexical positions in a deferred owner without changing protected sets
- **THEN** every protected numeric ID is identical between exports
- **AND** all module/dependency IDs remain unique, complete and idempotent

#### Scenario: Real initial and home ownership
- **WHEN** protected paths are selected
- **THEN** initial shared synchronous dependencies and premodules are included
- **AND** home uses effective `.web` route and ancestor layout delivery requirements including foreign shared factories
- **AND** deferred async target identities are allocated without making their factories eager

#### Scenario: Earlier allocation or invalid priorities
- **WHEN** selected priorities are malformed, outside the existing complete universe, required home/graph data is missing, or earlier numeric IDs conflict with the declared prefix
- **THEN** export fails before filename generation and publication
- **AND** an identical earlier prefix remains idempotently compatible without resetting any allocator

#### Scenario: Existing serializer defaults
- **WHEN** the hook is absent or context is native, dev, server, SSR, DOM, legacy, lazy or path-ID mode
- **THEN** existing allocation and serialization behavior remains unchanged
- **AND** server-loader identity, client-platform isolation and sealed worker runtime/delivery boundaries remain compatible

#### Scenario: Canonical full-byte acceptance
- **WHEN** the reviewed candidate is published through the canonical pipeline
- **THEN** FULL entry is at most 232602 B Brotli and FULL home is at most 480437 B Brotli with every other existing guard passing
- **AND** real root execution, lazy navigation and persisted non-RU language boot remain functional
- **AND** structural ID stability, normalized bytes or stale retained URLs after ID rewriting never substitute for canonical FULL measurement
