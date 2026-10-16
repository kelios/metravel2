## Purpose

Make native regression and recording preparation reproducible, bounded and tied to the actual candidate so recording does not serve as first acceptance testing.

## ADDED Requirements

### Requirement: Native runs assert observable results
Native regression scenarios MUST declare their evidence layer, preconditions and expected results. A passing action sequence without business assertions MUST NOT count as rehearsal coverage.

#### Scenario: Modal cannot reopen
- **WHEN** a scenario opens a modal, closes it and attempts to reopen it but the second opening does not appear
- **THEN** the run fails at the missing expected state within the declared deadline

#### Scenario: Invalid scenario
- **WHEN** a scenario contains unsupported operations, ambiguous targets or lacks a required assertion
- **THEN** validation rejects it before contacting a device

### Requirement: Native execution is bounded and reproducible
Native runners MUST require explicit target selection, preserve existing evidence, stop on the first failure and record result, scenario identity, driver identity and execution duration. Reusable test helpers MUST be invalidated when their inputs change. Signing/profile mutation MUST remain opt-in under existing authority.

#### Scenario: Driver hangs
- **WHEN** a device operation exceeds its declared overall budget
- **THEN** the owned process group is stopped and the report records timeout without an automatic retry

#### Scenario: Device already owned
- **WHEN** a native runner tries to use a target already leased by a live runner
- **THEN** it exits without executing device actions and does not claim a pass

### Requirement: Recording requires exact-candidate rehearsal
Recording preparation MUST reject missing, failed, stale or mismatched rehearsals. Candidate, environment, driver and scenario identity MUST match the requested batch. A partial regression MUST NOT be presented as full App Review scene coverage.

#### Scenario: Unchanged successful rehearsal
- **WHEN** each requested scene has a fresh passing assertion-bearing rehearsal on the matching physical candidate and environment
- **THEN** the batch readiness check passes without rerunning unrelated completed scenes

#### Scenario: Candidate or scenario changes
- **WHEN** the candidate identity, scenario bytes, driver source, environment or evidence layer differ from the passing rehearsal
- **THEN** readiness fails and names the changed input

### Requirement: Coverage gaps and operational failures remain explicit
Native coverage MUST distinguish implemented tests, actually executed results, missing automation and hardware/attestation requirements. Recording failures MUST return to the owning implementation/test workflow rather than start unbounded in-recording debugging.

#### Scenario: Missing native scene
- **WHEN** an App Review scene has no complete executable native scenario
- **THEN** coverage reports it as a gap and does not infer coverage from a helper, screenshot or unrelated web test

#### Scenario: Repeated operational failure
- **WHEN** two attempts fail for the same access or environment cause without a changed precondition
- **THEN** the workflow stops that attempt and requests the exact unblock while preserving completed results
