## Purpose

Keep the guest homepage book readable and fully interactive on wide, short windows while preserving its two-page artwork and static-to-loaded layout.

## ADDED Requirements

### Requirement: Mandatory book content remains reachable
The homepage SHALL retain its full title, description, search field and primary action in their existing order inside the book paper. Content SHALL be fully reachable through ordinary vertical scrolling when available height cannot contain it. It SHALL NOT be hidden, irreversibly clipped or painted outside paper; action targets SHALL remain at least 44px and text SHALL retain readable size.

#### Scenario: Wide short desktop
- **WHEN** a guest opens the loaded homepage at 2048×900 or 2560×640 in any supported locale
- **THEN** each mandatory element can be normally scrolled into full view with zero clipped area inside its clipping ancestors, and field/primary action accept ordinary clicks

#### Scenario: Keyboard reveal
- **WHEN** a keyboard user focuses search and the primary action while left-page content exceeds its frame
- **THEN** each focused control is brought within the paper scroll frame, remains visible and can be activated

### Requirement: Book capacity responds to viewport geometry
The book SHALL adapt its vertical capacity and text spacing to both viewport dimensions and available chrome space, including height-only resize. It SHALL preserve the spread and right-page photo without horizontal scrolling or header/footer overlap.

#### Scenario: Height-only resize
- **WHEN** a 2048×900 homepage is resized to 2048×640 and back without reloading
- **THEN** content capacity updates at the same width and all mandatory content stays reachable without overlapping the surrounding chrome

#### Scenario: Healthy responsive controls
- **WHEN** the homepage opens at 1440×900, 1280×900, 1279×900 or 390×844
- **THEN** its existing spread/tablet/mobile layout and content order remain effective with scroll width no greater than client width plus 1px

### Requirement: Static and loaded geometry share behavior
The first static homepage frame and loaded app SHALL use equivalent book bounds, page capacity and control ordering for the same viewport, without switching between incompatible geometry models.

#### Scenario: Cold startup
- **WHEN** a cold guest opens the homepage at a healthy or short desktop size and the application finishes loading
- **THEN** book form and mandatory controls retain their order and remain reachable before and after loading without a geometry-model layout switch

### Requirement: Appearance and data states preserve capacity
All supported locale, light/dark and seasonal appearance states SHALL keep the same capacity/accessibility guarantees. Existing loading/error/media fallbacks SHALL retain page geometry and SHALL NOT remove mandatory controls.

#### Scenario: Long labels and seasonal appearance
- **WHEN** RU/BE/UK/PL/EN existing labels render in light/dark with seasonal off/christmas at the short desktop sizes
- **THEN** all lines can be normally revealed inside paper and every mandatory control remains usable

#### Scenario: Media unavailable
- **WHEN** the right-page image cannot load
- **THEN** its existing fallback retains the slot and the title/search/action remain fully reachable
