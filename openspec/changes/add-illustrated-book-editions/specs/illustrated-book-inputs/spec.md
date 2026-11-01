## ADDED Requirements

### Requirement: One source boundary for illustrated editions

Illustrated editions SHALL consume selected stops and verified same-article
source records from the existing shared source loader. The style loader SHALL
NOT select a replacement place, author, article, photograph or editorial copy.
It SHALL reject missing, duplicate or extra selected stop IDs and mismatched
country/style/source/image hashes. Graphic and fantasy SHALL use the same
loading mechanism.

#### Scenario: A different photograph is supplied
- **WHEN** an illustration names an original URI or SHA that does not match the selected source
- **THEN** assembly fails before returning render inputs, without substituting another asset

### Requirement: Durable provenance and explicit style approval

Tracked evidence SHALL retain original article/image association, rights,
native dimensions, source/art SHA, exact selected prompt, approved style SHA,
tool and observed model disclosure. Unknown model identity SHALL remain null.
Historical ignored audit records SHALL NOT be required to build from the final
verified source/art bytes and tracked inputs. An explicit approved visual
direction SHALL be required before series assembly; a pending sample SHALL
NOT count as approval.

#### Scenario: Old temporary generation journal is absent
- **WHEN** tracked evidence and final verified photo/art bytes exist but the old ignored generation journal is absent
- **THEN** the loader produces the same verified inputs without weakening source or hash checks

#### Scenario: Graphic sample still awaits a decision
- **WHEN** only a pending graphic proof exists
- **THEN** the full graphic edition is not assembled or published

### Requirement: Native image and licensed static font inputs

The loader SHALL preserve native image dimensions without upscaling, record
encoded bytes separately, and require a licensed static TTF covering current
RU/BE/UK/PL/EN characters and all selected copy. Cover artwork SHALL reuse
one verified selected stop in the same style. Final PDF/QR/font/overflow and
physical acceptance SHALL remain separate gates.

#### Scenario: A5 artwork is below 300 ppi
- **WHEN** the verified native artwork gives less than 300 ppi on A5
- **THEN** its native dimensions remain unchanged and printReady remains false

### Requirement: Validate full publication context while preserving raw staged editions

The publisher SHALL validate the complete candidate catalog, including current
accepted editions and the incoming subset, with the canonical publication
schema. Both watercolor countries SHALL remain mandatory. The staged manifest
SHALL contain only raw incoming editions; parser normalization SHALL NOT be
emitted into the incoming subset or previously accepted book objects.
Activation SHALL use the existing adapter, verify all staged bytes before
pointer/cache mutation and preserve immutable old files.

#### Scenario: Only a new photo or fantasy pair is staged
- **WHEN** the incoming subset contains both countries in one additional style
- **THEN** validation includes the accepted watercolor pair and emits only the raw incoming subset

#### Scenario: A schema returns normalized book objects
- **WHEN** complete-catalog validation returns normalized fields
- **THEN** those returned objects do not replace the accepted or staged raw records

#### Scenario: One later staged asset is corrupt
- **WHEN** activation finds invalid bytes after earlier valid assets
- **THEN** the existing manifest/related pointers, release snapshots and cache remain unchanged
