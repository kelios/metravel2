## Purpose

Let readers discover a museum passport and obtain its reading pages, printable booklet, matching wrap cover and stickers without registration.

## ADDED Requirements

### Requirement: Discover a museum passport
The Books catalogue SHALL list published museum passports in a separate section with country and museum-theme filtering, and SHALL open the matching edition detail.

#### Scenario: Reader selects Poland and museums
- **WHEN** a reader selects Poland and the museum theme
- **THEN** the published Krakow passport is available and unrelated editions are excluded.

### Requirement: Download purpose-specific immutable files
The edition SHALL provide a sequential A4 reading PDF, imposed A3 booklet PDF, outside A3 wrap cover and A4 sticker PDF from one immutable revision without authentication. The detail SHALL distinguish booklet duplex short-edge printing from single-sided cover and sticker printing, and SHALL not claim unverified print-shop readiness.

#### Scenario: Reader prints the booklet
- **WHEN** a reader downloads the booklet from its edition
- **THEN** the instructions identify A3 duplex short-edge printing and explain that booklet imposition must not be enabled again.

#### Scenario: Publication resources differ
- **WHEN** an asset belongs to another revision or its staged bytes differ from the declared checksum
- **THEN** publication is rejected without changing the active edition pointer.

### Requirement: Keep content and navigation consistent
The edition SHALL show the exact final museum count and numbered contents matching the printable files; app-owned controls SHALL support RU/BE/UK/PL/EN while editorial content keeps its original language.

#### Scenario: A museum is excluded from the edition
- **WHEN** content preparation removes a place unavailable to individual visitors
- **THEN** the PDF, stickers and published numbered contents use the same resulting selection and count.
