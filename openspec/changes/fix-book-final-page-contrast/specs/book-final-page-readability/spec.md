## Purpose

Make the fixed pastel final postcard readable independently of the selected cover palette, including browser preview and printed PDF output.

## ADDED Requirements

### Requirement: Final postcard text contrast is independent of cover color
The final postcard SHALL provide at least 4.5:1 foreground/background contrast for every informational text element across every registered theme and RU/BE/UK/PL/EN. Cover text colors SHALL NOT reduce final-page readability.

#### Scenario: Near-white dark-theme cover text
- **WHEN** a book is generated with a dark theme whose cover foreground is near-white rather than exact white
- **THEN** the final heading, statistics, quote and stamp satisfy the minimum contrast on the actual pastel background in preview and printed PDF

#### Scenario: Every theme and locale
- **WHEN** the same book is generated for each registered theme and each production locale
- **THEN** the final postcard retains readable text, visible decorative ink and its existing localized labels without clipping

### Requirement: Final postcard paints predictably during printing
The final postcard SHALL retain its pale background and readable foreground during printing, without a white opaque glow caused by gradient alpha loss or screen compositing over informational text.

#### Scenario: Browser print with backgrounds
- **WHEN** the final postcard is printed with background graphics enabled
- **THEN** its background and decorative layers retain the intended pale palette and do not obscure informational text

### Requirement: Final summary and physical page remain intact
The final postcard MUST preserve selected summary statistics, quote escaping, pinned generation year, existing artwork and one physical A4 page with the existing footer band.

#### Scenario: Statistics and a long localized quote
- **WHEN** a book with travel, country, day and photo statistics and a supported localized quote is generated
- **THEN** all statistics and quote text are preserved on one final physical page with no clipping or text overlap

#### Scenario: Empty optional data
- **WHEN** the book has no optional quote or no nonzero summary statistics
- **THEN** absent optional content remains absent and the heading, explanatory text and stamp remain readable on one page
