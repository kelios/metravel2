# profile-travel-pagination Specification

## Purpose

Позволяет автору продолжить неполный список маршрутов после отказа следующей страницы без перезагрузки профиля и потери уже загруженных карточек.

## Requirements

### Requirement: Persistent next-page failure recovery

The web profile SHALL preserve loaded cards after a next-page failure and show exactly one persistent footer with the cause and a localized retry action.

#### Scenario: Failure outlives notification
- **WHEN** page 2 fails with HTTP 503 after 20 cards were loaded
- **THEN** the same 20 cards and one retry footer with the cause remain visible after more than four seconds
- **AND** scrolling does not automatically retry the failed page

### Requirement: Retry preserves page and active scope

The profile SHALL retry the failed next page of the active author/publication scope and append successful rows without restarting page 1 or mixing scopes.

#### Scenario: Successful retry
- **WHEN** the user retries page 2 and it returns 20 further rows
- **THEN** the list contains 40 cards, the failure footer disappears, and subsequent pagination is available

#### Scenario: Repeated failure
- **WHEN** the retry returns another HTTP 503
- **THEN** the first 20 cards and exactly one retry footer remain available

#### Scenario: Independent publication tabs
- **WHEN** a publication tab has a failed next page and the user switches to another publication tab
- **THEN** retry and failure state follow the selected tab without requests to another tab's scope

#### Scenario: Background first-page refresh after next-page failure
- **WHEN** page 2 failed and a background refresh successfully reloads only the saved first page
- **THEN** the cause and retry action remain available for the still-unloaded page 2

#### Scenario: Refreshed list is already complete
- **WHEN** a refresh after a next-page failure returns all currently available routes
- **THEN** the complete list has no obsolete next-page failure or ineffective retry action

### Requirement: Existing first-page recovery remains available

The profile SHALL preserve the distinct empty first-page failure and its existing retry action.

#### Scenario: Empty list failure
- **WHEN** page 1 fails before any rows are loaded
- **THEN** the first-page error offers its existing retry and no next-page footer appears

### Requirement: Loaded cards remain free of render-cycle errors

The web profile SHALL show newly loaded cards without runtime or render-cycle errors.

#### Scenario: First healthy snapshot replaces a pending load
- **WHEN** the first successful author-list response makes cards visible after a pending load
- **THEN** the cards appear without a cross-component render-cycle error
