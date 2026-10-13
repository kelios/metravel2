## Purpose

Keep explicitly authorized implementation moving through planning and validate the current commit independently of unfinished work in a shared checkout, preserving all required operation and quality gates.

## ADDED Requirements

### Requirement: Implementation authority survives planning
The agent SHALL retain an explicit implement/build/fix instruction through required planning and apply without requesting the same authorization again. An accompanying proposal instruction SHALL NOT discard implementation authority. A request for planning alone SHALL NOT authorize implementation. Existing store and external operation gates SHALL remain in force.

#### Scenario: Direct implementation
- **WHEN** the owner asks to implement a feature that requires a plan
- **THEN** the agent prepares, reviews and validates the plan and proceeds to implementation without a second confirmation

#### Scenario: Combined request
- **WHEN** the owner asks to propose and implement an improvement
- **THEN** completion of the proposal does not cancel the implementation instruction

#### Scenario: Planning only
- **WHEN** the owner requests a proposal without requesting implementation
- **THEN** the agent presents the planning result and does not modify product code

#### Scenario: Independently gated operation
- **WHEN** implementation is authorized but a store upload or release is not
- **THEN** implementation authority does not authorize that operation

### Requirement: Commit validation selects index paths
Pre-commit validation SHALL select paths included in the current Git index and SHALL retain the existing applicable and global quality checks. Unrelated unstaged or untracked paths SHALL NOT be added to feature-test or lint scope solely because they exist in the shared checkout. Renamed and deleted indexed paths SHALL remain relevant validation inputs. Manually requested working-tree checks SHALL retain their existing scope.

#### Scenario: Parallel unfinished files
- **WHEN** a valid staged task coexists with unfinished unstaged and untracked files from another task
- **THEN** the commit's feature-test/lint input includes only indexed paths and the existing quality runner remains active

#### Scenario: Rename and deletion
- **WHEN** the index contains a rename and a deletion
- **THEN** both original and destination rename paths and the deleted path reach applicable check selection

### Requirement: Commit validation fails closed and cleans artifacts
Errors obtaining the path list, failing checks and unsupported path representations SHALL prevent the commit. Supported Unicode and internal-space filenames SHALL retain their exact identity. Temporary validation manifests SHALL be cleaned after successful or failed checking and normal termination.

#### Scenario: Failed validator
- **WHEN** a required check returns a nonzero exit code
- **THEN** the hook returns failure and removes its temporary manifest

#### Scenario: Failed path enumeration
- **WHEN** indexed paths cannot be read
- **THEN** checking does not proceed with an empty fallback scope and the commit fails

#### Scenario: Supported and unsupported names
- **WHEN** indexed names contain Unicode or internal spaces
- **THEN** their identity is preserved
- **WHEN** a name cannot be represented by the checker's path-list protocol
- **THEN** the hook reports failure instead of silently changing or omitting that name
