## Purpose

Keep guest PDF export useful without issuing predictable unauthorized capability or session-probing requests to authenticated book-export services.

## ADDED Requirements

### Requirement: Guest capability boundary
A known guest starting PDF export SHALL NOT call auth-only book capability endpoints or probe authentication to select local export. Existing local export and authenticated server export SHALL remain available according to their current contracts.

#### Scenario: Guest export
- **WHEN** a known guest opens and starts travel PDF export
- **THEN** local export runs without an auth-only capability request or session probe

#### Scenario: Signed-in export
- **WHEN** a signed-in user starts export with an available server capability
- **THEN** the existing server export path remains usable without guest logic suppressing it

#### Scenario: Capability service fails
- **WHEN** authenticated capability lookup fails or server rendering is unavailable
- **THEN** the existing supported fallback/error behavior remains visible and no capability is fabricated
