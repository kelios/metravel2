## Purpose

Turn an exploratory MeTravel session into replayable evidence and deduplicated defects without new service charges.

## ADDED Requirements

### Requirement: Bounded manual QA

The reviewer SHALL start on demand, explore a user goal on the selected target within a finite budget, and use local execution without purchasing additional compute, models or device services.

#### Scenario: Default guest walkthrough

- **WHEN** the operator starts a review without platform or target overrides
- **THEN** the reviewer starts with mobile web on deployed MeTravel and selects a desktop follow-up when it adds responsive evidence, performing only guest read-only actions on production.

#### Scenario: Missing native build or local fixture

- **WHEN** the selected device, build, local service or safe test data is unavailable
- **THEN** the reviewer records the blocked scenario and its prerequisite, and proceeds with any independent authorized checks in scope.

### Requirement: Reproducible evidence and board triage

The reviewer SHALL distinguish a verified product failure from a UX hypothesis, environment error and observed pass, and report the actual coverage.

#### Scenario: Stable failure in independent replay

- **WHEN** a fresh replay on the same target fails a check grounded in the expected user behavior
- **THEN** the reviewer records the target, steps, expected and actual behavior, replay result and sanitized artifacts, and deduplicates through the project board when publication is requested.

#### Scenario: Ambiguous or unreproduced observation

- **WHEN** the reviewer cannot demonstrate a reproducible contract violation
- **THEN** the observation stays in the report with its evidence and remaining verification step, without creating a defect ticket.
