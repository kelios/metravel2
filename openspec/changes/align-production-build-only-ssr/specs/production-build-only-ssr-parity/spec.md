## ADDED Requirements

### Requirement: Production wrapper modes select the same SSR inputs
The canonical production wrapper SHALL require the backend SSR capability and set
METRAVEL_WEB_OUTPUT=server, EXPO_PUBLIC_WEB_RUNTIME_SSR=true and
EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR=true for both DEPLOY=0 and DEPLOY=1 before export.

#### Scenario: A build-only caller inherits static flags
- **WHEN** DEPLOY=0 starts with static or disabled runtime input values
- **THEN** the validated production capability selects the same three SSR values as DEPLOY=1
- **AND** build-prod.sh receives DEPLOY=0

### Requirement: Capability errors stop both modes before export
The wrapper SHALL fail clearly before invoking build-prod.sh when capability is
unreachable, malformed or does not advertise the required quest SSR runtime.

#### Scenario: Build-only cannot obtain capability
- **WHEN** the capability command fails or returns an invalid/disabled capability
- **THEN** the wrapper returns a failure, retains its diagnosis and removes its worktree
- **AND** no static fallback export starts

### Requirement: Build-only remains non-publishing
DEPLOY=0 SHALL skip production checkout mutation guards and published-release
verification while retaining the existing build lock, isolated worktree and cleanup.

#### Scenario: A production checkout is dirty during a build-only measurement
- **WHEN** a valid capability allows a DEPLOY=0 export
- **THEN** no publishing checkout check, publication or rollback runs
- **AND** the measurement uses the same canonical worktree as a production export
