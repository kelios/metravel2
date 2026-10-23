## Purpose

Keep quest detail navigation reachable while reserving most of the viewport for reading and answering, including tablet and landscape windows.

## ADDED Requirements

### Requirement: Bounded pinned top chrome
Web quest details SHALL have one quest title/action owner and combined pinned top site/quest chrome no greater than 20% of the viewport at 320×640, 390×844, 718×735, 960×640, 1024×768, 1440×900 and 844×390. Bottom navigation is outside this top-chrome budget. Controls MUST retain targets of at least 44px.

#### Scenario: Short tablet or landscape window
- **WHEN** a quest is opened at 960×640, 1024×768 or 844×390
- **THEN** route/progress scrolls with the reading content and only one title/action row remains pinned above it

#### Scenario: Wide desktop
- **WHEN** a quest is opened at 1440×900
- **THEN** the route sidebar remains reachable and the title/actions have exactly one owner

### Requirement: Stable route and answer interactions
The detail SHALL preserve the reading host, answer draft, current route point and open route sheet during resize, deferring relocation during an active input, keyboard, sheet or scroll gesture.

#### Scenario: Resize with an open route sheet
- **WHEN** a reader resizes between portrait and landscape with the route sheet open
- **THEN** the sheet and current point remain present and closing returns focus to live route navigation

#### Scenario: Offline answer draft
- **WHEN** a reader resizes an offline quest while editing an answer
- **THEN** the draft and saved progress remain intact and route navigation stays reachable

### Requirement: Locale and first-frame continuity
RU and BE/UK/PL/EN quest detail routes SHALL use the same shell contract, retain their route/content locale, and reserve the final top-row geometry before hydration without a duplicate title or hydration-driven header jump.

#### Scenario: Localized or fallback content
- **WHEN** any supported quest-detail locale is opened directly or from another route
- **THEN** its URL and content locale remain unchanged, the existing fallback-language notice remains available where required, and no language-version row is added above the quest

#### Scenario: Loading and error
- **WHEN** quest content is loading or fails to load
- **THEN** back navigation remains reachable within the same reserved header geometry
