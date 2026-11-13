## MODIFIED Requirements

### Requirement: Reference measurement uses the production build context

Release byte ceilings MUST come from the same fixed isolated production checkout, shared dependencies, effective compiler inputs and build pipeline used for publication. Diagnostic exports in another checkout SHALL NOT establish release ceilings. Public client evidence and private provenance MUST survive cleanup after a failed build, and after a successful measurement when retention is explicitly requested. Incomplete or mismatched provenance SHALL be ineligible for pinning. A retained-canonical reference MUST truthfully identify its source, browser-input fingerprint, manifest/report SHA-256 hashes, retained raw artifacts and measured exact pins; historical references MUST retain their distinct historical identity. Calibration and independent review MUST verify the actual retained artifacts, complete matching report and eligible canonical context. Ordinary builds SHALL validate the committed reference descriptor and matching pins without requiring private baseline artifacts on every workstation; this structural validation SHALL NOT be represented as rehashing baseline artifacts on each build. Current-run evidence MUST still receive its normal archive validation.

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

#### Scenario: Retained calibration and portable validation
- **WHEN** a complete eligible retained canonical failed measurement establishes tighter exact byte pins
- **THEN** calibration and independent review verify the actual manifest/report hashes, identity, context and measured pins
- **AND** ordinary builds validate the truthful retained descriptor and matching pins without depending on private baseline files
- **AND** the failed reference remains a measurement rather than a successful publication

#### Scenario: Historical reference compatibility
- **WHEN** a historical canonical reference has its original report and parity-proof descriptor
- **THEN** its existing historical validation remains valid without relabelling it as retained raw evidence

### Requirement: Exact Brotli ratchets have no spare bytes

An explicitly configured integer Brotli byte ceiling SHALL include generated loader metadata and SHALL be checked without percentage tolerance or KiB rounding. The entry and home ceilings MUST equal their final measured bytes. Each named chunk row SHALL select exactly one Brotli enforcement mode when a Brotli ceiling is configured: `maxBrotliBytes` selects full delivered exact bytes, while `maxBrotliKB` selects the existing normalized KiB/tolerance policy. Presence of both fields SHALL be invalid, including null values; there SHALL be no silent priority. Raw/gzip policy and eager route coarse/exact policies SHALL remain unchanged. Updating a named row SHALL preserve its chosen exact mode and exact pin without recreating the legacy field; legacy-only rows SHALL retain their existing updater behavior. Reports SHALL retain full and normalized measurements as separate diagnostics.

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

#### Scenario: Mixed named modes fail closed
- **WHEN** a named chunk row contains both Brotli fields, even if either field is null
- **THEN** validation fails instead of silently discarding either configured policy

#### Scenario: Exact mode and normalized diagnostic disagree
- **WHEN** an exact-mode named chunk fits its full delivered ceiling while its normalized recompression is larger
- **THEN** its Brotli check passes using full delivered bytes
- **AND** the report keeps the normalized measurement visible without enforcing an unconfigured legacy ceiling

#### Scenario: Updater preserves mode
- **WHEN** the budget updater processes an exact-mode named chunk
- **THEN** it keeps the exact pin without adding `maxBrotliKB`
- **AND** raw/gzip updating and legacy-only named rows keep their existing behavior

#### Scenario: Eager route budgets retain their basis
- **WHEN** an eager HTML route has coarse and exact Brotli ceilings
- **THEN** both continue to check the full HTML script set under their existing policies
- **AND** named-chunk field exclusivity does not remove either route ceiling
