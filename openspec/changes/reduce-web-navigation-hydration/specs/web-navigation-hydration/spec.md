## ADDED Requirements

### Requirement: Bound web navigation preparation to visited screens

The web app SHALL preserve Expo tab history and prepare tab view descriptors only for routes in the current tab state.

#### Scenario: Open and revisit an article

- **WHEN** a reader opens article A, visits article B and search, then uses app and browser Back
- **THEN** the URL and active article agree after each navigation
- **AND** the cold entry does not prepare tab view options for an unvisited search screen

### Requirement: Preserve independent server-rendered hero content

The web article SHALL keep its server-rendered caption and facts independently hydratable.

#### Scenario: Tap the gallery on the first frame

- **WHEN** the first interaction hydrates the gallery while scroll tracking selects gallery
- **THEN** the existing caption and facts keep their server content
- **AND** selecting a different visible section updates its quick link
