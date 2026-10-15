## Purpose

Ensure native recording preparation relies on actual executed business assertions and identifies each requested complete scene or child segment without inflating partial coverage.

## ADDED Requirements

### Requirement: Readiness requires completed intended execution
A physical rehearsal SHALL contain exactly one intended passing testcase, zero failures, zero skips, zero expected failures, and a matching received-script hash with complete step and assertion counts. Passed labels and process exit zero alone MUST NOT qualify.

#### Scenario: Matching completed rehearsal
- **WHEN** the intended testcase passed and its received-script hash and completed counts match the requested scenario
- **THEN** execution verification permits the otherwise matching rehearsal

#### Scenario: Old label without execution
- **WHEN** a report claims passed and exit zero but lacks completed execution evidence
- **THEN** readiness rejects it

#### Scenario: Missing or incomplete execution
- **WHEN** no test ran, any test skipped or failed, the testcase identity differs, or script hash or completed counts differ
- **THEN** readiness rejects the report

### Requirement: Child coverage uses a closed parent and segment mapping
Content-report readiness SHALL recognize exactly the travel, comment, message, trip-chat, quest-review and photo segments under ugc-flag-content. Each requested child SHALL have an explicit exact coverage declaration and matching scenario/report identity. Unknown parents, segments or mapping declarations MUST be rejected. Requested identities SHALL be unique by parent and optional segment.

#### Scenario: Two independent assigned children
- **WHEN** photo and quest-review each have their own matching fresh complete child rehearsal
- **THEN** readiness can permit those two segments without claiming their parent or other four segments

#### Scenario: Unknown or duplicate mapping
- **WHEN** a segment is unknown, belongs to another parent, or repeats the same parent and segment request
- **THEN** readiness rejects that request

### Requirement: Full scene coverage cannot be inferred from children
Full parent readiness SHALL retain the explicit complete-parent coverage requirement and require declarations for all six required child segments in that parent's own complete scenario. Separate partial child reports MUST NOT aggregate into full parent readiness.

#### Scenario: Two children are not a parent
- **WHEN** photo and quest-review pass but the full parent is requested without its complete declaration and six segments
- **THEN** full parent readiness fails

#### Scenario: Full parent remains explicit
- **WHEN** a complete parent scenario declares the complete parent and all required segments and has matching successful execution
- **THEN** full parent readiness can pass without substituting independent partial reports

### Requirement: Child rehearsals preserve existing identity and history boundaries
Every child SHALL retain exact candidate, environment, runner, scenario hash, installed version/build observations and freshness checks. Readiness output SHALL distinguish requested complete scenes from requested segments and SHALL NOT attest installed TestFlight source, final video or privacy from synthetic evidence.

#### Scenario: Child candidate changes
- **WHEN** a child report's candidate, environment or scenario differs from its request
- **THEN** readiness rejects only the mismatching request

#### Scenario: Historical child is stale
- **WHEN** a child's rehearsal is older than 24 hours or has invalid timestamps
- **THEN** readiness rejects it while preserving unrelated existing evidence
