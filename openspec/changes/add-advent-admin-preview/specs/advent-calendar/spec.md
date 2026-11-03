## ADDED Requirements

### Requirement: Advent superuser preview

The Advent page SHALL offer an explicit preview to an authenticated superuser. The preview SHALL allow inspection of all campaign doors regardless of date or recorded progress. Preview interaction SHALL NOT save Advent progress, award rewards or emit Advent interaction analytics.

#### Scenario: Superuser inspects a future door

- **WHEN** an authenticated superuser enables preview before launch
- **THEN** every door can be opened and its gift, task and reward can be inspected
- **AND** client-checked tasks can be retried without saving real progress

#### Scenario: Visitor lacks preview privileges

- **WHEN** a guest or ordinary account visits the Advent page
- **THEN** the preview control is absent and normal calendar dates apply

#### Scenario: Preview ends

- **WHEN** the superuser exits preview or loses the required session role
- **THEN** the preview sheet and transient state are cleared and normal calendar dates apply
