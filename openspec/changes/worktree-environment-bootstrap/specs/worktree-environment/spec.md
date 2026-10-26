## Purpose

Prepare ignored development prerequisites in an owned frontend checkout while
preserving existing local files and preventing secret disclosure or escape.

## ADDED Requirements

### Requirement: Owned checkout boundary
Bootstrap MUST resolve the primary owned frontend checkout from linked worktree
metadata or a verified local shared-clone relationship and reject other targets.

#### Scenario: Linked worktree or shared clone
- **WHEN** an owned linked worktree or local shared clone requests bootstrap
- **THEN** prerequisites are read from its verified primary frontend checkout

#### Scenario: Unsupported source
- **WHEN** ownership, source relationship or filesystem containment is unproved
- **THEN** bootstrap fails without copying any secret

### Requirement: Explicit and non-destructive preparation
Bootstrap SHALL copy only its declared ignored allowlist, preserve existing
destinations unless force is explicit, and never print file contents.

#### Scenario: Fresh checkout
- **WHEN** allowed prerequisites exist at the source and are absent at the target
- **THEN** independent copies are created and only path/status information is shown

#### Scenario: Repeat and force
- **WHEN** an allowed target already exists
- **THEN** it remains unchanged unless the caller explicitly requests force

#### Scenario: Missing prerequisite
- **WHEN** an allowed source is missing
- **THEN** its absence is reported without generating substitute credentials

### Requirement: Preserve operational authority
Bootstrap MUST leave native installation, release authorization and operation
locks intact and give actionable missing-prerequisite diagnostics.

#### Scenario: Native preparation
- **WHEN** native generated dependencies are absent
- **THEN** bootstrap identifies the separate preparation commands without running them

#### Scenario: Missing environment consumed
- **WHEN** a dependent build or test needs absent local prerequisites
- **THEN** its diagnostic names bootstrap and the relevant setup alternative
