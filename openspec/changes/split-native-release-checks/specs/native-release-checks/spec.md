## ADDED Requirements

### Requirement: Targeted native release gates

The release tooling SHALL provide separate source validation commands for Android and iOS and SHALL coordinate them through the existing quality lock.

#### Scenario: Validate Android

- **WHEN** an operator runs the Android source release check
- **THEN** it validates Android prerequisites, shared application contracts and Android/native tests
- **AND** it omits iOS-only tests, browser E2E, web export and the server PDF worker suite

#### Scenario: Validate iOS

- **WHEN** an operator runs the iOS source release check
- **THEN** it validates iOS source configuration, store listing, shared application contracts and iOS/native tests
- **AND** it omits Android-only tests, browser E2E, web export and the server PDF worker suite

#### Scenario: Build or publish a candidate

- **WHEN** a native source check passes
- **THEN** the operator still needs the applicable device and artifact evidence and authorization for the requested store operation
