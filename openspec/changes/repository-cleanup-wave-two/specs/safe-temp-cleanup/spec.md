## Purpose

Allow maintainers to inspect and reclaim reconstructible local build caches without losing active work, shared dependencies or durable editorial and operational evidence.

## ADDED Requirements

### Requirement: Inventory is read-only by default
The cleanup command SHALL report eligible paths and total estimated bytes without deleting anything unless explicit apply is requested. Invalid arguments MUST fail without deletion.

#### Scenario: Default inventory
- **WHEN** the command runs without apply
- **THEN** eligible paths and their total size are printed and all files remain intact

#### Scenario: Empty or invalid input
- **WHEN** no eligible paths exist
- **THEN** the command reports zero candidates and exits successfully
- **WHEN** an unknown argument is supplied
- **THEN** the command fails before any filesystem deletion

### Requirement: Only inactive reconstructible data is eligible
The command SHALL consider only allowlisted build caches inside temporary entries inactive for at least three days. It SHALL consider deployment package archives only after fourteen days. Recent descendant activity MUST preserve the containing entry.

#### Scenario: Old cache and recent sibling entry
- **WHEN** one entry is inactive for three days and another contains a recently modified descendant
- **THEN** only allowlisted caches in the inactive entry are eligible

#### Scenario: Deployment retention
- **WHEN** an archive is thirteen days old and a deployment log is older than fourteen days
- **THEN** both remain intact

### Requirement: Working stores and shared targets are preserved
The command MUST preserve protected editorial/operational stores, virtual environments and symlinked dependency directories. It MUST NOT follow symbolic links or remove a cache or worktree located below a protected store. Store names are matched outside caches and registered worktrees only: below a cache root they are package content and below a worktree root they are repository content, so they MUST NOT veto an otherwise eligible candidate. Virtual environments are protected at every depth. Ordinary links inside an eligible real cache can be unlinked without following their targets.

#### Scenario: Shared dependencies
- **WHEN** an inactive entry contains a symbolic dependency directory pointing outside temporary storage
- **THEN** both the symbolic directory and its target remain intact

#### Scenario: Nested virtual environment
- **WHEN** an otherwise eligible cache contains a virtual environment
- **THEN** that cache is preserved

#### Scenario: Cache below a protected store
- **WHEN** a stale cache or registered worktree lies below a directory named like a protected store
- **THEN** it is not a candidate

#### Scenario: Store name inside package or repository content
- **WHEN** a stale real dependency cache contains a package directory named like a protected store, or a clean merged worktree tracks files named like one
- **THEN** the cache or worktree remains an eligible candidate

### Requirement: Whole worktree removal requires independent Git safety
Whole registered worktrees SHALL be eligible only when inactive, clean, unlocked, non-current and merged into the canonical remote branch. Removal MUST use the normal Git worktree operation without force. Independent clones MUST NOT be removed wholesale.

#### Scenario: Dirty or unmerged worktree
- **WHEN** a registered worktree has uncommitted content or an unmerged commit
- **THEN** whole worktree removal is refused

#### Scenario: Ignored non-reconstructible files
- **WHEN** a registered worktree contains ignored files outside allowlisted caches (for example `.env*` or `.secrets/`)
- **THEN** whole worktree removal is refused, because ordinary `git worktree remove` deletes ignored files

#### Scenario: Git safety cannot be verified
- **WHEN** worktree metadata or canonical ancestry cannot be read
- **THEN** whole worktree removal is refused without affecting other safe inventory entries

### Requirement: Apply revalidates before deletion
Apply MUST revalidate path identity, confinement, activity and protection before deleting each candidate. A changed or newly protected candidate MUST be preserved and reported.

#### Scenario: Concurrent change
- **WHEN** a candidate changes or gains recent activity after inventory
- **THEN** apply skips that candidate without following a replacement symlink
