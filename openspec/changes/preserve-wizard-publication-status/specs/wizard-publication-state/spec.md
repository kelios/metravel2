## Purpose

Сохранение статьи в мастере должно сохранять её фактическое состояние публикации; переходы выполняются только по отдельной команде пользователя и подтверждаются сервером.

## ADDED Requirements

### Requirement: Canonical publication state
The wizard SHALL use `publication_status` as the authoritative state for draft, pending_review, approved and published, independently of legacy flags or moderation decisions.

#### Scenario: Pending article without a decision
- **WHEN** an author or administrator opens an article with pending_review and false/false legacy flags
- **THEN** the pending state is visible immediately and the administrator can access the existing moderation actions on desktop and mobile web.

#### Scenario: Legacy response
- **WHEN** the canonical field is absent
- **THEN** legacy false/false, true/false, false/true and true/true resolve to draft, pending_review, approved and published respectively.

#### Scenario: Unsupported canonical value
- **WHEN** a canonical field is null, empty or unknown
- **THEN** the wizard shows a localized observable error, preserves the content and blocks writes instead of silently treating the article as draft.

### Requirement: Content writes preserve publication state
Ordinary full save, text autosave and route save MUST preserve the confirmed publication state and existing moderation decision for all four states.

#### Scenario: Full or route save
- **WHEN** an existing article in state S is saved after a content or structural edit
- **THEN** the full request contains publication_status S and enforce_moderation_validation false without publish, moderation or moderation_decision_reason, and a subsequent read remains S.

#### Scenario: Text autosave
- **WHEN** only supported text fields change in an existing article in any supported state
- **THEN** autosave sends only changed text fields through content PATCH, without publication or moderation command fields, and a subsequent read keeps the state and decision.

#### Scenario: Write failure
- **WHEN** a write fails or is delayed
- **THEN** the form preserves newer edits, reports the failure, permits retry, and does not report an unconfirmed state transition.

### Requirement: Explicit moderation commands
Only explicit submit, approve and reject commands SHALL request publication transitions; ordinary save and reading a prior reason SHALL NOT create a moderation decision.

#### Scenario: Submit
- **WHEN** the author explicitly submits a valid draft
- **THEN** the request targets pending_review with moderation validation true and no legacy flags.

#### Scenario: Approve
- **WHEN** an authorized administrator explicitly approves a pending article
- **THEN** the request targets published with moderation validation false and no legacy flags or rejection reason.

#### Scenario: Reject with reason
- **WHEN** an authorized administrator rejects a pending article
- **THEN** only a trimmed reason of 1–2000 characters permits the request, targeting draft with validation false and the one-time reason.

#### Scenario: Failed rejection
- **WHEN** rejection fails
- **THEN** the confirmed state and entered reason remain available for retry without losing article content.

#### Scenario: Queued writes after a transition
- **WHEN** a save or autosave completes around an explicit command
- **THEN** later ordinary saves use the confirmed resulting state and do not restore the prior state or replay the command.
