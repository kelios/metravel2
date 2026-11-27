## Purpose

Provide one local workstation assistant for MeTravel development and image drafts while preserving existing workflow controls and reporting tested model limits honestly.

## ADDED Requirements

### Requirement: Local repository and image work
The agent SHALL use the configured local inference provider and SHALL be able to inspect/edit task-owned repository files, execute local checks and request a local image without claiming unexecuted actions.

#### Scenario: Code repair
- **WHEN** a user supplies a local failing-code task
- **THEN** the agent can read the file, apply an edit and report the actual check result.

#### Scenario: Image draft
- **WHEN** a user requests an image
- **THEN** the agent can invoke the local generator and return the saved PNG path without publishing it.

### Requirement: Canonical instructions and protected board operations
The agent MUST reuse existing project instructions and skills and MUST apply the existing quality, claim and review controls before applicable board mutations.

#### Scenario: Missing task contract
- **WHEN** a board mutation fails the existing task-quality control
- **THEN** no board write occurs and the agent receives the actual denial.

#### Scenario: Destructive request
- **WHEN** a task or sprint deletion is proposed
- **THEN** the specific destructive operation requires user confirmation; capability configuration alone does not authorize deletion.

### Requirement: Evidence-bound capability reporting
The agent setup SHALL distinguish tool availability, structural validation, semantic quality and production acceptance.

#### Scenario: Translation evaluation
- **WHEN** a local draft is collected for a real translation task
- **THEN** raw output is preserved, canonical checks and independent semantic judgment are recorded, and no production publication follows from a structural pass alone.

#### Scenario: Untested deployment
- **WHEN** deployment tooling is available but no authorized production change is deployed
- **THEN** the report states that deployment execution was not verified and retains the existing review, Git and operation gates.

### Requirement: Useful supervised assignments
The setup SHALL support a bounded student profile and preserve the original attempt separately from teacher corrections and accepted delivery.

#### Scenario: A failed useful draft
- **WHEN** a real assigned draft fails checks
- **THEN** the teacher preserves its evidence, corrects useful work and completes the applicable publication or Git workflow without increasing the student's original score.

#### Scenario: Bounded coding context
- **WHEN** a teacher runs a code assignment through the student launcher
- **THEN** canonical instruction discovery and board reads remain available, board writes and delegation are disabled, and unused image/knowledge tools are not embedded in the code request.

#### Scenario: Alternative local model
- **WHEN** the teacher selects an alternative backend
- **THEN** the launcher uses only its declared loopback endpoint, never substitutes a cloud or other model, and reports unavailable service or unverified capability honestly.
