## Purpose

Retain the canonical bundle guard's exact measurements and provenance after deployment cleanup, and allow engineers to compare completed checks without rebuilding.

## ADDED Requirements

### Requirement: Exact diagnostic measurements

The bundle guard SHALL expose schema version 1 with full source SHA, dirty flag, UTC generation time, configuration and toolchain fingerprints, lockfile fingerprint, exact integer raw/gzip/Brotli bytes for named owners and their files, release/all/deferred/eager totals, worst route, every observed route request count, payload counts and exact breaches. Named measurements SHALL exclude loader metadata while release/eager measurements SHALL include it. Legacy JSON fields and existing budget verdicts SHALL remain compatible. Unavailable measurements SHALL be explicit and SHALL NOT become zero or pass.

#### Scenario: Small byte differences
- **WHEN** two measurements round to the same displayed KiB
- **THEN** their reports retain their different exact bytes

#### Scenario: Missing asset
- **WHEN** a required asset or measurement is missing
- **THEN** the report identifies an incomplete/error measurement and the existing failing guard remains failing

### Requirement: Durable bounded reports

Every canonical completed guard SHALL atomically write its report to the shared ignored deploy archive before worktree cleanup and print the path. The archive SHALL retain at most 20 own reports, at most 30 days old, with at most 8 MiB per report. Oversized reports SHALL fail diagnostics explicitly without truncation. Retention SHALL preserve unrelated files. Diagnostic failures SHALL NOT turn a failed guard into a successful publication.

#### Scenario: Successful and failing cleanup
- **WHEN** either a green or red canonical guard is followed by worktree removal
- **THEN** its valid report remains readable in the shared archive and its original exit code is preserved

#### Scenario: Retention and write failure
- **WHEN** retention exceeds count/age bounds or an atomic write fails
- **THEN** only own expired/excess reports are removed, no partial report is published, and the diagnostic error is explicit

### Requirement: Exact comparison consumer

A comparison command SHALL validate both schema version 1 reports, display exact signed byte/count deltas, verdict/breach differences and configuration/toolchain changes. It SHALL refuse malformed, incomplete-structure or unknown-version input rather than invent measurements.

#### Scenario: Compare after cleanup
- **WHEN** two retained reports are compared after their temporary builds have been removed
- **THEN** the command uses only those reports and displays their exact measured differences

#### Scenario: Invalid input
- **WHEN** an unknown schema version, truncated JSON or invalid byte/count field is supplied
- **THEN** comparison exits unsuccessfully with a clear error
