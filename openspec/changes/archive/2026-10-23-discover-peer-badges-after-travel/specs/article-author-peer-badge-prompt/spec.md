## Purpose

Lets a reader discover awards for the author immediately after reading an article, while preserving authentication, the existing award rules and truthful measurement.

## ADDED Requirements

### Requirement: Invitation follows the article text

The system SHALL show a labelled invitation to reward the author after the complete main article text and before subsequent sections/author. It MUST hide the invitation for the author, unknown recipient, absent article text and pending authentication.

#### Scenario: Authenticated reader
- **WHEN** a reader opens another author's article and reaches the end of its main text
- **THEN** the invitation and labelled award action are available before subsequent sections

#### Scenario: Ineligible or unresolved identity
- **WHEN** the article is owned by the viewer, the recipient is invalid, the main text is absent or authentication is unresolved
- **THEN** the invitation and its analytics events are absent

### Requirement: Awards target the author and reflect server state

The system SHALL use the existing user award selection and grant/revoke rules for the article author. Article-target awards MUST retain their existing meaning. Loading, empty and error states MUST remain distinct, and failed grants MUST NOT appear successful.

Personal award state for authors and articles MUST be isolated between anonymous viewers and different authenticated viewers, including after refresh and delayed responses.

#### Scenario: Award and revoke
- **WHEN** a reader selects an author award and later revokes it
- **THEN** the recipient is the author and each confirmed state matches the persisted server state

#### Scenario: Read or grant failure
- **WHEN** catalogue/author awards cannot load or a grant is rejected, including a production 400 response
- **THEN** an error and retry are available without fabricated options, empty state or successful award

#### Scenario: Article or authentication changes
- **WHEN** the article recipient changes or the viewer loses authentication while selection is open
- **THEN** the prior selection cannot submit an award to a stale recipient

#### Scenario: Viewer-specific received state
- **WHEN** a reader grants an author or article award, refreshes the state, then another reader or a guest opens that target
- **THEN** the initiating reader sees their confirmed grant while other viewers receive their own grant state without reusing that reader's personalized response

### Requirement: Guest authentication returns to the article

The system SHALL send guests to authentication with a safe internal return address preserving the article path, query and fragment. Login/registration navigation MUST preserve this return address without automatically granting an award.

#### Scenario: Guest enters through login or registration
- **WHEN** a guest activates the invitation and completes login, including after switching to registration
- **THEN** the viewer returns to the original article with no automatic grant

### Requirement: Visibility and clicks are measured separately

The system SHALL send peer_badge_prompt_impression when at least half the eligible invitation becomes visible, and peer_badge_prompt_click before an activation navigates or opens selection. Both MUST contain travel_id and exclude personal data.

#### Scenario: Offscreen and repeated exposure
- **WHEN** the prompt mounts below the viewport, then is shown and scrolled past repeatedly in the same article presentation
- **THEN** no impression fires before exposure and only one impression is counted for that presentation

#### Scenario: Reader or guest activates
- **WHEN** an eligible viewer activates the award action
- **THEN** one click event is sent for that activation before selection/authentication

### Requirement: Localized accessible responsive presentation

The invitation SHALL preserve its full meaning and visible action label in RU/BE/UK/PL/EN at 390 and 1440 px, with keyboard access and visible focus.

#### Scenario: Languages and widths
- **WHEN** the invitation is viewed in each current locale at either required width
- **THEN** text wraps without horizontal overflow or overlap and the award action remains labelled and keyboard accessible
