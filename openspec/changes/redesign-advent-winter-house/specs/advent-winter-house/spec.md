## Purpose

Present the existing traveller advent campaign as an accessible, responsive winter apartment-house illustration while preserving all real campaign progression and holiday appearance preferences.

## ADDED Requirements

### Requirement: Main doors are apartment windows
The calendar SHALL present its 24 main doors as numbered windows on one stable six-floor apartment-house facade. It SHALL present three bonus doors separately by their actual calendar dates without changing their IDs or the main progress denominator.

#### Scenario: Campaign renders on a narrow screen
- **WHEN** the real 27-door campaign is rendered on a 320px phone
- **THEN** the house contains 24 correctly aligned numbered window targets, the three bonus dates are separately visible, and no horizontal overflow or overlapping touch targets occurs

### Requirement: Window appearance reflects real state
Unopened windows SHALL show dim warm light behind translucent frost. Opened and completed windows SHALL show clear bright interiors. The current-day window SHALL have a distinct number accent. The facade SHALL have restrained moonlit highlights.

#### Scenario: An available window opens
- **WHEN** a user opens an available window using the existing campaign action
- **THEN** the existing gift sheet opens, real progress is updated by the existing mechanism, and only that window loses its frost and dimming

#### Scenario: A future or unready window is activated
- **WHEN** a window is future-locked or identity/campaign hydration is not ready
- **THEN** its action remains disabled and no opening or completion is recorded

### Requirement: Artwork does not add visible window captions
The house SHALL show day numbers without narrative captions or hover tooltips. Every target SHALL retain localized accessible date/state information and keyboard interaction. Decorative layers SHALL not intercept input or accessibility focus.

#### Scenario: A pointer hovers a window
- **WHEN** the user hovers or focuses a numbered window
- **THEN** no scene-title tooltip or caption appears and the accessible name still communicates the day and real state

### Requirement: Gift media is optional
The gift sheet SHALL preserve the real gift/task/reward flow and display media only when a usable image is provided. Absent or terminally failed media SHALL not reserve a blank decorative block.

#### Scenario: A gift has no usable image
- **WHEN** the gift image is absent or fails permanently
- **THEN** the sheet starts with its textual content and real actions without an empty image panel

### Requirement: Seasonal branding is compact and optional
The Christmas brand mark SHALL retain the existing bird with an above-face cap and a small tree/light accent. The existing seasonal preference and calendar SHALL control the decoration; switching decoration off SHALL not hide the advent campaign.

#### Scenario: Christmas decoration is disabled
- **WHEN** the user selects seasonal off
- **THEN** the extra cap/tree decoration is absent while campaign availability, progress, dates and all gift actions retain their real behavior

#### Scenario: A compact brand mark is rendered
- **WHEN** Christmas is active in a compact header
- **THEN** the cap leaves the eye and beak visible, no scarf/tail strip appears, and header controls remain usable
