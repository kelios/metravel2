## Purpose

Keep initial web JavaScript delivery measurable and prevent any byte growth after startup payload reductions, while preserving page rendering and language behavior.

## ADDED Requirements

### Requirement: Reference measurement uses the production build context

Release byte ceilings MUST come from the same fixed isolated production checkout, shared dependencies, effective compiler inputs and build pipeline used for publication. Diagnostic exports in another checkout SHALL NOT establish release ceilings. Public client evidence and private provenance MUST survive cleanup after a failed build, and after a successful measurement when retention is explicitly requested. Incomplete or mismatched provenance SHALL be ineligible for pinning.

#### Scenario: Build-only reference
- **WHEN** the existing build-only command is given the production SSR inputs for a reviewed revision
- **THEN** it uses the same fixed absolute checkout and shared dependency location as publication
- **AND** it applies the same compiler/default flags and never stages or publishes code

#### Scenario: Failed budget keeps evidence
- **WHEN** a build produces client files and a complete measurement but fails a byte ceiling
- **THEN** cleanup still runs and preserves the original failure code
- **AND** a bounded archive retains public client files, their full sizes/hashes, the matching report and private provenance
- **AND** environment files, secrets, server code and symlinks are absent from the archive

#### Scenario: Missing or invalid evidence
- **WHEN** the report, source identity, public files or canonical build context cannot be verified
- **THEN** the retained receipt reports incomplete evidence and cannot establish a byte ceiling

### Requirement: Initial payload is reduced from the recorded baseline

The normal production web build SHALL deliver an entry below 233211 B Brotli and a home document script set below 481252 B Brotli. The evidence MUST identify current startup dependencies and their home/article first-render ownership without treating diagnostic source-map annotations as normal production delivery.

#### Scenario: Normal production candidate
- **WHEN** the candidate is exported with production settings and no client source-map annotations
- **THEN** its full entry and home initial script set are each strictly smaller than their recorded baseline
- **AND** each retained or removed startup dependency has an evidence-backed ownership decision

### Requirement: Exact Brotli ratchets have no spare bytes

An explicitly configured integer Brotli byte ceiling SHALL include generated loader metadata and SHALL be checked without percentage tolerance or KiB rounding. The entry and home ceilings MUST equal their final measured bytes.

#### Scenario: Exact equality
- **WHEN** delivered Brotli bytes equal the configured exact ceiling
- **THEN** the exact byte check passes

#### Scenario: One byte growth
- **WHEN** delivered Brotli bytes exceed the configured exact ceiling by one byte while legacy size tolerance would permit the payload
- **THEN** the budget check fails and reports exact actual and ceiling bytes

#### Scenario: Invalid or unavailable exact measurement
- **WHEN** an exact byte ceiling is malformed or its configured chunk or HTML route is absent
- **THEN** budget validation fails instead of silently dropping the ceiling

#### Scenario: Legacy compatibility
- **WHEN** a chunk or route has no exact byte ceiling
- **THEN** its existing KiB and tolerance policy is preserved

### Requirement: Startup behavior remains compatible

Home and article SHALL retain their public rendering, navigation and locale behavior without console errors. Supported language payloads MUST NOT grow as a consequence of the startup split.

#### Scenario: Representative pages and language boot
- **WHEN** home and an article open on mobile web and desktop web, including a persisted non-Russian language
- **THEN** their first render and interactions remain usable without console errors
- **AND** their existing language and URL selection behavior is preserved

#### Scenario: Slow language payload
- **WHEN** the existing language payload load fails or is slow
- **THEN** the existing recovery behavior and URL validation remain unchanged
