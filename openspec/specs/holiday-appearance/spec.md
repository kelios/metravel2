# holiday-appearance Specification

## Purpose

Создать узнаваемое спокойное оформление пяти сезонных тем, доступное на desktop и mobile web и управляемое на всех поддерживаемых языках.

## Requirements

### Requirement: Distinct calm seasonal motifs
The system SHALL provide light and dark appearances for all five themes: spring flowering branches and pink/green light, Easter pastel eggs and branches, autumn copper leaves and amber light, Halloween moon and lanterns, Christmas evergreen branches and gold lights/stars. Decoration SHALL be static, confined to header and upper edges, and absent from the central reading area.

#### Scenario: Theme identity
- **WHEN** each seasonal appearance is selected in light or dark mode
- **THEN** its respective motif and palette are visible without moving particles or flicker

#### Scenario: Reduced motion and print
- **WHEN** reduced motion or print is requested
- **THEN** reduced motion remains static and print contains no seasonal decorative layers

### Requirement: Logo and interaction geometry
The system SHALL preserve the recognizable bird, existing logo navigation, header geometry and a minimum 44px interactive logo target. Decoration SHALL NOT intercept input, reduce legibility, change header dimensions or introduce horizontal overflow.

#### Scenario: Desktop and mobile interaction
- **WHEN** a seasonal theme is displayed at widths 390, 767, 1279, 1280 or 1440 pixels
- **THEN** all header controls and the logo remain reachable, decorative layers do not intercept clicks, and the document does not exceed viewport width

#### Scenario: Long content
- **WHEN** a visitor reads or scrolls a travel page
- **THEN** seasonal decoration does not cover article text, photos or map controls

### Requirement: Localized choices and automatic status
The system SHALL expose automatic, off and all five manual themes to guests and authenticated visitors in desktop/mobile menus and settings. In automatic mode it SHALL show the current theme and its actual date range, or the nearest upcoming period outside all windows. Labels, status and date formatting SHALL support RU/BE/UK/PL/EN with RU fallback; choices SHALL preserve radio semantics, keyboard focus and wrapped labels.

#### Scenario: All localized options
- **WHEN** a visitor opens a theme control in any supported language
- **THEN** all seven choices have localized readable labels, valid icons and one selected radio state without missing translation keys

#### Scenario: Automatic status outside a period
- **WHEN** automatic mode is selected outside any calendar period
- **THEN** the control describes ordinary appearance and the next period using localized dates, including its year when needed to disambiguate

#### Scenario: Two Easter windows
- **WHEN** automatic mode describes Easter in a year with disjoint windows
- **THEN** the displayed date range is the active or nearest window rather than a single range implying that Easter remains active in the gap

#### Scenario: Keyboard and touch access
- **WHEN** a desktop keyboard user or mobile touch user selects a theme
- **THEN** focus remains visible, the chosen radio state updates and wrapped controls remain within the menu viewport

### Requirement: Bounded resource impact
Seasonal selection SHALL NOT introduce additional external image/calendar requests or continuously running animation/polling. Existing content URLs, navigation, image source selection and analytics SHALL remain unchanged.

#### Scenario: Network and rendering budget
- **WHEN** a theme is selected or automatic mode crosses a period boundary
- **THEN** the transition requires no external calendar or decorative media request and no continuously running seasonal animation
