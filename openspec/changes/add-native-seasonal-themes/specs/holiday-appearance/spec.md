## ADDED Requirements

### Requirement: Native seasonal appearance parity
The system SHALL provide all seven seasonal choices (automatic, off and the five existing seasonal themes) in the existing theme menus on Android and iOS for guests and authenticated users, and in authenticated settings. Each manual choice SHALL immediately apply its respective light or dark palette and recognizable static header motif. Seasonal selection SHALL remain independent from light/dark/system selection. Existing web behavior SHALL remain available.

#### Scenario: Native menu and settings selection
- **WHEN** a guest opens the theme menu or an authenticated user opens the menu or settings on Android or iOS
- **THEN** all seven localized seasonal choices are available with exactly one selected radio state
- **WHEN** a manual theme is selected
- **THEN** the selection and visible palette/motif update without restarting the app

#### Scenario: Independent dark mode
- **WHEN** a user selects Christmas and changes the ordinary scheme from light to dark or system
- **THEN** Christmas remains selected and its palette follows the resulting light/dark scheme

#### Scenario: Native disable
- **WHEN** off is selected during a calendar holiday
- **THEN** the ordinary palette is restored and seasonal decoration disappears

#### Scenario: Localization and touch accessibility
- **WHEN** a theme control is displayed in RU, BE, UK, PL or EN on a narrow phone or resizable tablet window
- **THEN** all labels and automatic-period dates are localized, labels wrap within the available width and touch targets are at least 44dp

#### Scenario: Native decoration isolation
- **WHEN** any native theme is active while reading an article, viewing a map or pressing a header control
- **THEN** decoration remains static within the header, does not cover reading content or intercept input, and preserves header height and safe-area geometry

#### Scenario: Offline appearance
- **WHEN** a user selects a seasonal theme without network connectivity
- **THEN** palette and decoration still apply without an external media or calendar request

#### Scenario: Contrast
- **WHEN** each seasonal theme is displayed in light and dark mode
- **THEN** ordinary-sized text on its actual surfaces has contrast of at least 4.5:1 and safety/status colors retain their meaning
