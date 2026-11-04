## Purpose

Load social profile lists and subscription status with a bounded number of requests while keeping viewer data separate.

## ADDED Requirements

### Requirement: Bounded social pages and exact subscription state

The signed-in client SHALL request only the active compact social list page and use its server totals and travel previews. The client SHALL scope pages and exact subscription status to the viewer. The invitation picker SHALL retain access to its legacy subscriber directory.

#### Scenario: Open the subscriptions tab

- **WHEN** the owner opens a social tab and requests another available page
- **THEN** each requested page loads once with no per-author travel requests
- **AND** a subscriber row reads its exact status only after the owner activates its disclosure

#### Scenario: Open a public author profile and change the relationship

- **WHEN** a signed-in visitor opens an eligible author's public profile
- **THEN** the button reads that author's exact status without fetching a subscriptions directory
- **AND** a failed relationship mutation restores the previous confirmed status

#### Scenario: Change the authenticated viewer

- **WHEN** the account changes while a social read is pending
- **THEN** the previous account's rows and status are excluded from the new viewer's UI
- **AND** an undispatched relationship mutation for the previous viewer is cancelled
