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


### Requirement: Network status preserves navigation access
Web network-status notifications SHALL keep the quest header and bottom navigation visible and reachable. Simultaneous bottom notices SHALL have stable non-overlapping positions, and the reading content SHALL provide sufficient trailing space to reveal its final action above visible notices.

#### Scenario: Offline tablet navigation
- **WHEN** a loaded quest loses connectivity at a tablet or landscape viewport
- **THEN** its existing header Back and More controls and bottom navigation remain visible and operable, while the unsent answer and current route point remain intact

#### Scenario: Status with other notices and the More menu
- **WHEN** network status, consent or an install offer coexist and the reader opens the bottom More menu
- **THEN** the menu remains unobstructed, notification positions do not grow in a feedback loop, and a still-relevant status returns after closing the menu

#### Scenario: Reconnected or removed status
- **WHEN** connectivity recovers and the status finishes dismissing, or the status owner unmounts
- **THEN** its reserved space and invisible hit area are released while other visible notices retain their own space


#### Scenario: Short phone with several eligible notices
- **WHEN** a short phone window such as 600×320 has pending consent and an install offer when a network-status notice becomes relevant
- **THEN** network status takes temporary presentation priority above the dock without reaching the header, lower notices retain their pending state, and they return after the status lifecycle finishes

#### Scenario: More while a critical notice is pending
- **WHEN** More opens and closes before offline or restored status has finished
- **THEN** status releases its occupied space while hidden but retains presentation priority, so lower notices do not briefly return beneath the menu or ahead of the status
