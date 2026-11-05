## Purpose

Keep travel articles readable and their galleries interactive during mobile web startup while bounding initial main-thread blocking and preserving the reader's position as sections settle.

## ADDED Requirements

### Requirement: Mobile travel loading reaches the requested green score
The published Nesvizh/Mir article SHALL reach mobile Google PageSpeed Performance at least 90 on the requested canonical URL without weakening the measurement profile or hiding functional content.

#### Scenario: Cold direct article load
- **WHEN** a guest opens `/travels/nesvizh-i-mir-rasstoianie-i-marshrut-na-dva-dnia` with a cold mobile browser
- **THEN** its title, metadata, hero and full article text are present in server HTML, the gallery supports horizontal drag and vertical scrolling, and a live mobile PageSpeed report scores at least 90

### Requirement: Settling sections preserve reading position
The page MUST preserve visible reading anchors during real section growth and MUST avoid repeated anchor traversal when a resize notification leaves section flow unchanged.

#### Scenario: Repeated unchanged resize notifications
- **WHEN** an already measured section receives repeated resize notifications with the same flow dimensions
- **THEN** the page performs no anchor search or scroll correction for those notifications and subsequent real content growth still preserves the visible following frame

#### Scenario: Responsive or nested section changes
- **WHEN** a nested section grows, reserve slack changes or the viewport width changes
- **THEN** its geometry owner retains the existing responsive anchoring and reserved-height behavior without moving the reader past the page start
