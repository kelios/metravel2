## ADDED Requirements

### Requirement: Native seasonal preference lifecycle
The system SHALL restore saved auto/off/manual seasonal preferences on Android and iOS and apply the same local-date periods and priorities as web. When native storage is available, a selected preference SHALL survive an app restart. A late preference read SHALL NOT overwrite a newer user selection. Invalid or unavailable storage SHALL safely use automatic mode without an uncaught error. The first visible themed application surface SHALL use restored preferences once the storage read settles, preserving the independent ordinary light/dark/system preference.

#### Scenario: Restore native manual choice
- **WHEN** a user selects Easter or off and restarts the app with available local storage
- **THEN** the selected seasonal appearance is restored independently of the saved light/dark/system choice

#### Scenario: Slow preference restore
- **WHEN** the user selects Halloween while an earlier preference read is pending
- **THEN** resolving that read does not replace Halloween with the older preference

#### Scenario: Invalid preference or storage failure
- **WHEN** native preference storage returns an unknown value or rejects a read
- **THEN** automatic mode applies the current calendar appearance and the app remains usable

#### Scenario: Failed persistence
- **WHEN** storage rejects a preference write
- **THEN** the chosen appearance remains active for the current session without an unhandled rejection

### Requirement: Native calendar refresh on midnight and foreground
The system SHALL recompute automatic seasonal appearance within two seconds of local midnight while the native app is active under normal scheduling, and immediately on returning to the foreground after a date boundary or time-zone change. Transitions SHALL follow local civil midnight through daylight-saving changes. Manual/off preferences SHALL remain unchanged. Date refresh SHALL NOT use continuous polling or leave listeners/timers active after their owner unmounts.

#### Scenario: Active native midnight
- **WHEN** Android or iOS remains active across midnight between 14 and 15 October in automatic mode
- **THEN** autumn changes to Halloween within two seconds and the localized period status updates

#### Scenario: Foreground after suspension
- **WHEN** the app resumes after crossing the Christmas start/end boundary or after a time-zone change
- **THEN** its automatic appearance and displayed period match the current local civil date without restart

#### Scenario: Daylight-saving transition
- **WHEN** a native local civil day lasts 23 or 25 hours
- **THEN** the next refresh follows local midnight rather than a fixed 24-hour delay

#### Scenario: Manual choice during resume
- **WHEN** an app with a manual theme or off resumes after a calendar boundary
- **THEN** its selected preference and appearance are preserved

#### Scenario: Lifecycle cleanup
- **WHEN** the themed application owner unmounts
- **THEN** no owned seasonal timer or foreground listener remains active
