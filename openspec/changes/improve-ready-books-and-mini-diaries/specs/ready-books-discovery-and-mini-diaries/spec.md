## Purpose

Help a guest choose a free travel diary, get the right files, and discover compact diaries with verified content and rights.

## ADDED Requirements

### Requirement: Reachable books catalogue
The web catalogue SHALL present the primary selection action on the first 390 × 844 screen and group styles of a country edition. All existing edition URLs and topic-specific entries SHALL remain reachable.

#### Scenario: Mobile guest opens the catalogue
- **WHEN** a guest opens the catalogue on a 390 × 844 viewport
- **THEN** the selection action is visible before scrolling and leads to a chooser with styles grouped by country edition

#### Scenario: Desktop header has limited space
- **WHEN** the user opens the site at 1280 pixels
- **THEN** the books entry is visible or reachable through an explicitly visible menu

### Requirement: Truthful download composition
Each download SHALL identify the content and purpose of the actual file, the selected profile and the status of printing checks.

#### Scenario: A book body and cover are separate
- **WHEN** an edition provides separate body and cover PDFs
- **THEN** the guest sees separate labelled actions and can distinguish reading from home and copy-shop print files

### Requirement: Related entry points and measurement
Verified articles SHALL link to an edition that includes the relevant place or subject. Measurement SHALL distinguish an entry, preview and download request under existing analytics consent.

#### Scenario: Guest follows a verified article link
- **WHEN** a guest opens the edition from a verified source and requests the PDF
- **THEN** the source class and edition identify the journey without including personal input or claiming the PDF was printed

### Requirement: Release evidence for book resources
A new publication SHALL require revision-bound rights evidence covering content and assets. Existing editions SHALL be inventoried, with unresolved rights distinguished from verified rights.

#### Scenario: Missing proof
- **WHEN** an edition being staged lacks a matching rights record or required attribution
- **THEN** its new revision is rejected and the missing evidence is identified

### Requirement: Compact travel diary pilots
A compact diary SHALL be a distinct six-page A5 PDF with three separately usable journeys. Its site card SHALL show its language, page count and a preview of the same revision, and expose a download only after validation and publication.

#### Scenario: Valid pilot
- **WHEN** an approved pilot has matching rights, preview and downloadable assets in the published storage
- **THEN** the catalogue links to the pilot page and a guest can download its PDF without signing in
- **AND** the cover thumbnail keeps the proportions of the A5 cover on mobile and desktop

#### Scenario: Visual acceptance of a revised pilot
- **WHEN** a compact diary is prepared for publication
- **THEN** the exact six-page PDF is reviewed page by page for readable hierarchy, legible navigation and usable space for a personal memory
- **AND** its cover and sample are rendered from the reviewed PDF

#### Scenario: Pilot awaits publication
- **WHEN** the pilot resources are staged but absent from the verified public manifest
- **THEN** the site omits its public download
