## ADDED Requirements

### Requirement: Persistent native point photo timeout feedback
The native point editor SHALL retain a visible, localized photo-upload timeout message until dismissal or selection of a replacement photo, while preserving immediate toast feedback and upload save protection.

#### Scenario: Slow upload times out
- **WHEN** a point photo upload times out
- **THEN** the message and its dismissal action remain visible above Save after the toast disappears and after ordinary edits or rerenders

#### Scenario: Explicit dismissal
- **WHEN** the author dismisses the message
- **THEN** it disappears and stays dismissed until a new timeout

#### Scenario: Picker cancellation
- **WHEN** the author opens the picker and cancels without choosing a replacement
- **THEN** the existing timeout message remains visible

#### Scenario: Replacement and successful upload
- **WHEN** the author selects a replacement photo
- **THEN** the previous timeout message is cleared and Save remains protected until the upload finishes

#### Scenario: Other point or editor session
- **WHEN** another point is opened or the editor is closed and reopened
- **THEN** an earlier point's timeout and late responses do not appear in the new editor session

#### Scenario: Permission or network failure outside timeout
- **WHEN** photo permissions are denied or an upload fails without a timeout
- **THEN** existing immediate feedback remains and no persistent timeout message is shown
