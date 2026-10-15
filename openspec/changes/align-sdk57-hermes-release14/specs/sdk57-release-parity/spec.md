## Purpose

Prevent distributing an iOS candidate with the known affected SDK 57 Hermes family or inconsistent native architecture and release identity.

## ADDED Requirements

### Requirement: Supported release dependency family

The release validation SHALL reject mismatched SDK 57 runtime dependencies and affected Hermes compiler/native Pod versions; React Native MUST remain within the supported Expo SDK 57 family.

#### Scenario: Affected runtime is restored

- **WHEN** the release source or native lock returns to React Native 0.86.0 or Hermes 250829098.0.14
- **THEN** release validation fails before signed build or upload

### Requirement: New Architecture and current release identity

The SDK 57 source MUST omit the removed app-schema architecture flag and retain enabled native New Architecture and the current iOS build number.

#### Scenario: Obsolete or disabled architecture

- **WHEN** the obsolete Expo architecture flag is added or native architecture is disabled
- **THEN** release validation fails

#### Scenario: Stale build metadata

- **WHEN** source or audited artifact identifies build 13 while candidate 14 is required
- **THEN** release validation fails
