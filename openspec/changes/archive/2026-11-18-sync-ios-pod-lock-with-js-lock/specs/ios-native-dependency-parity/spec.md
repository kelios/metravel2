## ADDED Requirements

### Requirement: Frozen native dependency parity before iOS QA
An iOS QA candidate SHALL use native dependency versions consistent with the project's frozen JavaScript dependency set, with a reproducible strict dependency install and matching build provenance.

#### Scenario: Native version drift is detected
- **WHEN** a native dependency version differs from its frozen JavaScript version
- **THEN** strict installation refuses the inconsistent set and the old candidate is not accepted as current QA evidence

#### Scenario: Dependency locks are synchronized
- **WHEN** native dependencies are generated from the existing frozen JavaScript set
- **THEN** a repeated strict installation completes without tracked changes and the installed manifest matches the native lock

#### Scenario: Updated QA candidate is built
- **WHEN** an unsigned simulator candidate is rebuilt from the synchronized dependency set
- **THEN** its recorded native provenance matches the current project before runtime acceptance begins
