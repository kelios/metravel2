# Author moderation feedback Specification

## Purpose

Let authors understand a moderator's decision and correct rejected articles while preserving the current publication state, private feedback boundaries, and explicit submission workflow.

## Requirements

### Requirement: Current publication state qualifies historical decisions

The author editor and own travel list SHALL display rejection feedback only when the current resolved publication state is draft and the recorded decision is rejected. Historical decisions MUST NOT override pending review, approved, published, or invalid current state.

#### Scenario: Rejected draft
- **WHEN** an authorized author opens a draft with a rejected decision
- **THEN** both author surfaces display a localized Rejected status and correction action without changing its draft publication state

#### Scenario: Published article
- **WHEN** the current publication state is published
- **THEN** the author surfaces display Published regardless of an optional recorded decision and do not display rejection feedback

#### Scenario: Unpublished historical approval
- **WHEN** an article is now a draft and retains an earlier approved decision
- **THEN** it displays Draft and never Published

#### Scenario: Other current states take priority
- **WHEN** current publication state is pending review or approved and a stale rejected decision is present
- **THEN** the surfaces display the corresponding current state without a rejection reason or correction action

#### Scenario: Invalid current state
- **WHEN** an explicit current publication state is invalid, null, empty, or unknown
- **THEN** the existing unsupported-state error and write block remain and no decision fabricates a valid state

### Requirement: Optional feedback remains compatible

The system SHALL tolerate absent, null, unknown, or incorrectly typed optional decision fields without fabricating a decision or reason. Absent decision feedback SHALL retain the existing publication-state behavior, including legacy fallback only when canonical state is absent.

#### Scenario: Old response
- **WHEN** the author receives an article with no decision fields
- **THEN** the previous publication-state presentation and editing flow remain available without an error caused by those missing fields

#### Scenario: Unknown decision
- **WHEN** a response contains an unrecognized decision or a non-string reason
- **THEN** the system does not invent feedback from that value and retains current-state behavior

#### Scenario: Rejection without a usable reason or date
- **WHEN** a rejected draft has an empty or missing reason and a malformed or missing decision date
- **THEN** Rejected and the correction action remain visible, while no reason/date placeholder or invalid-date text appears

### Requirement: Moderator text is readable and localized appropriately

The system SHALL present a nonempty rejection reason as the moderator's plain text without translation or markup interpretation. Long reasons SHALL have a bounded preview and an accessible full-text disclosure. App-owned labels and valid optional dates SHALL follow the selected RU/BE/UK/PL/EN locale.

#### Scenario: Long reason at narrow width
- **WHEN** the author views a rejected article at 390px and opens its full reason
- **THEN** the complete text is available without horizontal overflow or stretching the list grid, and closing returns to the preview and initiating control

#### Scenario: Moderator text resembles markup
- **WHEN** the reason contains markup-like characters and line breaks
- **THEN** it remains plain text rather than executable markup and its complete content can be read

#### Scenario: Closing a reason portal preserves normal card interaction
- **WHEN** an author opens a reason from a hovered desktop card, moves the pointer outside the card, and closes the sheet
- **THEN** the card automatically returns to its resting visual bounds without an extra enter/leave gesture or grid reflow, focus returns to the initiating control, and subsequently hovering the card or its hoisted actions still lifts them together

#### Scenario: Language change
- **WHEN** the author selects any supported UI locale
- **THEN** feedback labels and date formatting follow that locale while the reason content stays unchanged

### Requirement: Decision dates match the current qualified decision

The author surfaces SHALL show a valid optional decision date only for a rejected draft or a published article whose recorded decision is approved. They MUST hide absent, invalid, or historical dates in other current-state combinations.

#### Scenario: Published approval date
- **WHEN** an authorized author views a published article with an approved decision and a valid decision timestamp
- **THEN** the Published status includes the locale-formatted decision date without rejection feedback or correction action

#### Scenario: Historical approval date after unpublish
- **WHEN** the article is now a draft with an old approved decision and timestamp
- **THEN** it displays Draft without the historical decision date

#### Scenario: Unusable approval date
- **WHEN** a published article has an approved decision but an absent or invalid timestamp
- **THEN** Published remains visible without a date placeholder or invalid-date text

### Requirement: Correction navigation does not submit

The correction action SHALL open the existing article editor from the list and return to editing content from the final wizard step. It MUST NOT save, submit, change publication state, or clear decision feedback merely because it was activated.

#### Scenario: Open correction from list
- **WHEN** the author activates Correct and send again on a rejected draft in their list
- **THEN** the existing editor opens for that article, and no write or moderation request is sent by that action

#### Scenario: Return to content in wizard
- **WHEN** the author activates correction on the final wizard step
- **THEN** the first editing step opens without selecting submission or writing the article

#### Scenario: Ordinary save after correction
- **WHEN** the author saves edits to a rejected draft without explicitly submitting
- **THEN** draft state and the server's rejection feedback are retained and no new moderation is requested

#### Scenario: Explicit resubmission
- **WHEN** a corrected draft is explicitly submitted and the server confirms pending review with cleared decision fields
- **THEN** the UI displays pending review and removes old rejection feedback; a failed submission retains the last confirmed status and the author's edits

### Requirement: Feedback respects context and loading boundaries

The system SHALL display decision feedback only to the article owner or authorized superuser in the editor or own-list context. Public profiles and catalog cards MUST NOT expose reasons even if a response unexpectedly contains them. Loading and failed reads MUST NOT be presented as a fabricated decision.

#### Scenario: Unauthorized or public context
- **WHEN** a public profile or catalog record includes private decision fields, or a different viewer opens that record
- **THEN** no private reason, decision date, or correction feedback is exposed there

#### Scenario: Slow or failed loading
- **WHEN** an author detail/list request is still loading or fails
- **THEN** existing loading/error UI remains without flashing fabricated Published or Rejected feedback

#### Scenario: Article or account changes
- **WHEN** the author switches to another article or viewer context while a full reason was open
- **THEN** the previous record's reason is not retained in the new context

#### Scenario: Accessible card actions
- **WHEN** an author uses keyboard or touch on a feedback action inside their travel-list cell
- **THEN** the intended action occurs once, with accessible labels and without triggering the article link or nested interactive semantics
