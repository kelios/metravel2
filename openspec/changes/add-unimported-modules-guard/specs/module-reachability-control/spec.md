## Purpose

Detect source modules disconnected from legitimate production or tooling entries, and prevent new disconnected modules from being hidden in an exception ledger while preserving supported platform and type dependency paths.

## ADDED Requirements

### Requirement: Production-entry reachability

The lint control SHALL classify source modules by normalized repository paths and their transitive dependencies from legitimate application, configuration and tooling entries. Merely living near an entry SHALL NOT make an unrelated helper reachable. Test-only and end-to-end-test-only importers SHALL NOT establish production reachability. A disconnected cycle SHALL remain unreachable.

#### Scenario: New disconnected module
- **WHEN** a new in-scope module has no dependency path from a legitimate entry and is absent from the reviewed exception ledger
- **THEN** lint exits 1 and reports its path with kind `unreachable`.

#### Scenario: Test-only dependency
- **WHEN** a module is imported only by a unit test or end-to-end test
- **THEN** it remains unreachable and lint reports it unless an existing reviewed exception permits it.

#### Scenario: Disconnected cycle
- **WHEN** two modules import each other without an entry reaching either module
- **THEN** both modules remain unreachable regardless of their incoming edge counts.

#### Scenario: Helper beside an entry
- **WHEN** an unrelated helper is placed beside application routes but has neither a valid entry contract nor a dependency path from an entry
- **THEN** directory membership does not exempt it from the control.

### Requirement: Supported dependency forms

The lint control SHALL preserve reachability through repository aliases, relative paths, directory indexes, reexports, literal lazy imports, literal require and the supported web/native/iOS/Android variants. Type dependencies SHALL be retained as compile-time usage without being falsely described as runtime execution. Analysis SHALL NOT execute the analyzed modules.

#### Scenario: Alias and live barrel
- **WHEN** an entry reaches a module through an alias and a reexport chain
- **THEN** the resolved path and its dependency chain are reachable, independent of local binding names.

#### Scenario: Platform variants
- **WHEN** a reachable platform-neutral import resolves to supported platform alternatives
- **THEN** the legitimate alternatives and their dependencies are retained, including a platform adapter that reexports another supported adapter.

#### Scenario: Explicit variant
- **WHEN** an entry explicitly imports one platform-qualified path
- **THEN** unrelated platform siblings are not exempted merely by sharing its basename.

#### Scenario: Literal lazy dependency
- **WHEN** a reachable entry uses a literal dynamic import or literal require to load a local module
- **THEN** the target remains reachable without invoking its loader.

#### Scenario: Type dependency
- **WHEN** a reachable source requires a local type-only module or an explicitly configured declaration contract
- **THEN** the required type module is retained with compile-time provenance, without a runtime-reachability claim.

#### Scenario: Operator-selected tooling input
- **WHEN** a tooling-only entry consumes an operator-selected input file rather than a statically declared application dependency
- **THEN** the control reports that analysis boundary and the input confers no source-module reachability, even when the chosen input resides in an application source directory.

#### Scenario: Opaque application loader
- **WHEN** a production application entry uses an unresolved computed local dependency without a finite source-backed target contract
- **THEN** the control refuses explicitly rather than guessing targets or accepting a directory-wide exception.

### Requirement: Reviewed initialization and shrink-only exceptions

The lint control SHALL use one initial committed inventory of existing unreachable paths, independently reviewed path by path with nonempty reason and accountable owner. This committed authority SHALL be established before the control is enabled in default lint gates. Independent review SHALL NOT require an additional user-baseline approval beyond the change's apply authorization. Normal checking SHALL require the fixed, verified initial authority and SHALL NOT initialize from an uncommitted ledger, a failed lookup or a later ledger introduction. Once initialized, the ledger SHALL only remove entries; it SHALL reject added or replaced exception paths by comparison with committed evidence, including when a new unreachable module and its exception are added together. Editing the working ledger SHALL NOT redefine the accepted comparison baseline.

#### Scenario: Reviewed first introduction precedes default wiring
- **WHEN** the exact current unreachable inventory and every reason/owner row have passed independent review and the initial ledger introduction is committed
- **THEN** that committed boundary can be fixed as the sole initial authority before enabling default lint checking.

#### Scenario: Initial authority has not been committed
- **WHEN** normal checking is invoked before the reviewed initial authority has been committed and fixed
- **THEN** it refuses explicitly rather than adopting a fresh working ledger, and this control is not yet enabled in default gates.

#### Scenario: Initial authority is verified after wiring
- **WHEN** default lint runs after the first authority is fixed and the committed ledger's identity, ancestry and complete history verify
- **THEN** checking uses that authority and applies shrink-only and stale-ledger rules without an initialization switch.

#### Scenario: Ledger deletion followed by recreation
- **WHEN** a committed ledger is deleted and later recreated after its initial authority was established
- **THEN** the control fails rather than treating the recreation as a new allowed first introduction.

#### Scenario: Same-change exception growth
- **WHEN** a new unreachable module and a matching exception are added in the same working change
- **THEN** the control fails rather than accepting the modified working ledger as authority.

#### Scenario: Committed growth
- **WHEN** an already initialized committed ledger revision adds an exception path relative to its accepted predecessor
- **THEN** the control rejects the growth even if the current working ledger equals the new committed revision.

#### Scenario: Missing accountable metadata
- **WHEN** an exception lacks a nonempty reason or owner
- **THEN** the control fails with an explicit invalid-ledger diagnostic.

### Requirement: Stale exception rejection

The lint control SHALL reject exceptions whose module was deleted or became reachable. A legitimate cleanup SHALL remove the corresponding exception in the same change.

#### Scenario: Deleted module retains exception
- **WHEN** an excepted module is deleted but its exception remains
- **THEN** lint exits 1 and reports the path with kind `stale-baseline`.

#### Scenario: Module becomes reachable
- **WHEN** a production entry begins to reach an excepted module but its exception remains
- **THEN** lint exits 1 and reports the stale exception until it is removed.

### Requirement: Deterministic failure and bounded execution

The lint control SHALL report unreachable and stale-ledger violations in deterministic path order with their distinct kinds, exit 0 only for a valid complete analysis, and fail explicitly for malformed policy, unresolved local literal dependencies or unverifiable committed evidence. Its warm-tree elapsed execution on the designated project machine SHALL be at most 10 seconds, measured with the input revision and environment recorded. It SHALL perform no network requests or filesystem mutations during a normal check.

#### Scenario: Valid empty finding set
- **WHEN** every in-scope module is reachable or covered by the valid unchanged ledger and no exception is stale
- **THEN** lint exits 0 with a stable summary.

#### Scenario: Invalid local dependency
- **WHEN** an in-scope literal local dependency cannot resolve within the repository
- **THEN** the control fails with an explicit resolution diagnostic rather than silently treating the source as safely analyzed.

#### Scenario: Missing committed evidence
- **WHEN** initialized ledger history cannot be verified in the available repository metadata
- **THEN** the control fails with a precise missing-history diagnostic and does not reset initialization automatically.

#### Scenario: Measured execution budget
- **WHEN** the control is measured on the designated project machine after a warm-up using the same source revision
- **THEN** every one of three recorded runs completes within 10 seconds, with no source mutation or network request.
