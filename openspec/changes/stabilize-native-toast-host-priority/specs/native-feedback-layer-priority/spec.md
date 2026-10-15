## Purpose

Keep transient feedback in the active native presentation while keyboard, layout and notification state change, and restore the retained parent after a presentation closes.

## ADDED Requirements

### Requirement: Active presentation retains feedback priority
The system SHALL deliver new native feedback to the most recently mounted active feedback presentation until it unmounts. Updates to an earlier presentation SHALL NOT change that priority.

#### Scenario: Keyboard or inset update beneath a retained modal
- **GIVEN** a root presentation and a later retained modal presentation are mounted
- **WHEN** keyboard or inset changes update the root and a success or error message is requested
- **THEN** only the retained modal receives the new message

#### Scenario: Earlier message expires beneath a retained modal
- **GIVEN** a timed root message exists before a retained modal mounts
- **WHEN** the root message expires and new feedback is requested
- **THEN** the new feedback belongs to the retained modal
- **AND** the expired root message is not replayed

### Requirement: Nested presentation close restores its parent
The system SHALL return subsequent feedback to the most recently mounted presentation that remains after a child presentation unmounts.

#### Scenario: Nested child and parent close in order
- **GIVEN** root, retained parent and retained child presentations are mounted in that order
- **WHEN** lower presentations update and feedback is requested
- **THEN** the child receives it once
- **WHEN** the child closes and another message is requested
- **THEN** the parent receives it once
- **WHEN** the parent closes and another message is requested
- **THEN** the root receives it once without replaying a closed presentation's message

### Requirement: Current feedback options and actions remain effective
The system SHALL use the selected presentation's current options and callbacks for subsequent feedback. Dismissal, replacement, expiry and actions SHALL preserve their existing timing and invocation semantics.

#### Scenario: Options change while a presentation remains mounted
- **GIVEN** the selected presentation remains mounted
- **WHEN** its default callbacks or options change and another message is requested
- **THEN** the message uses the updated options and callbacks

#### Scenario: Action and public dismissal
- **WHEN** a user invokes a feedback action
- **THEN** the selected notification is hidden and its action runs once
- **WHEN** another message is requested and public dismissal is invoked
- **THEN** that selected message is hidden and its current hide callback runs once
