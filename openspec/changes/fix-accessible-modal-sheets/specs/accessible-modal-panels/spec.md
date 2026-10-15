## Purpose

Expose each existing modal action to assistive technology while preserving
keyboard reachability, nested dismissal, feedback and existing presentation.

## ADDED Requirements

### Requirement: Modal controls remain individually accessible

The system SHALL expose each actionable control and labelled input in the
report, achievement, quest-share and theme-paywall panels as a separate
accessible element, preserving existing labels, selected and disabled states.

#### Scenario: Report reasons are individually discoverable
- **WHEN** a user opens the report panel on iPhone with a populated reasons catalogue
- **THEN** Accessibility Inspector exposes at least six reason controls, the comment input, submit and close separately
- **AND** selecting a reason updates its selected state without closing the panel

#### Scenario: Other existing panels preserve accessible actions
- **WHEN** a user opens an achievement gallery, badge detail, badge share, peer award, rare award, quest-result share or theme paywall
- **THEN** assistive navigation reaches each available action separately
- **AND** existing disabled, loading, error and empty states remain available as applicable

### Requirement: Form actions remain reachable with the keyboard

The system SHALL keep the active input and submission or sharing actions
reachable while the software keyboard is open, without closing the panel or
requiring a second activation merely to dismiss the keyboard.

#### Scenario: User submits a report while editing a comment
- **WHEN** the user selects a reason and focuses the comment input with the keyboard open
- **THEN** the comment is not obscured and the submit action is reachable within the panel
- **AND** activating submit sends the existing report payload and success closes the report panel

#### Scenario: Submission error preserves the form
- **WHEN** a report submission fails
- **THEN** the existing error feedback appears and the reason and comment remain available for retry

#### Scenario: Other editable panels preserve keyboard access
- **WHEN** the user edits a quest-result name or a rare-award reason with the keyboard open
- **THEN** the input and corresponding share or submit controls remain reachable

### Requirement: Modal lifecycle preserves focus and feedback

The system SHALL preserve nested dismissal, modal-level feedback and existing
touch semantics while limiting keyboard focus to the active web panel.

#### Scenario: Web keyboard and backdrop dismissal
- **WHEN** a panel is open at web viewport width 390 or 1440
- **THEN** Tab and Shift+Tab traverse its available controls without reaching the underlying screen
- **AND** Escape or a backdrop activation closes the active panel
- **AND** focus returns to its opening control when that control remains mounted

#### Scenario: User closes nested achievement panels
- **WHEN** a user opens achievement gallery, badge detail and sharing in sequence and closes the topmost panel
- **THEN** only the topmost panel closes and the underlying panel remains usable

#### Scenario: Share or award feedback remains visible
- **WHEN** a share-copy or peer-award action emits its existing confirmation while its panel remains open
- **THEN** the confirmation appears above the panel in the active presentation layer

#### Scenario: Theme paywall retains its presentation
- **WHEN** a user opens the premium theme prompt
- **THEN** it remains a centred dialog with separately reachable unlock and dismiss actions
