## Purpose

Defines the availability, rollback, and readiness contract for publishing a frontend-only production release while preserving the live backend application and active client traffic.

## ADDED Requirements

### Requirement: Frontend publication preserves the backend application

A frontend-only production release SHALL publish the frontend artifact without stopping, restarting, recreating, or reloading the backend application process.

#### Scenario: Successful frontend-only production release

- **WHEN** a frontend artifact is published to production
- **THEN** the backend application container identity and start time remain unchanged
- **AND** public dynamic/API requests remain serviceable throughout the publication

#### Scenario: Publication fails after the static swap

- **WHEN** a frontend publication fails during proxy validation, graceful proxy reload, or readiness verification
- **THEN** the system MUST leave the backend application process untouched
- **AND** the failure path MUST NOT use a backend restart as recovery

### Requirement: Static publication retains a rollback point until readiness

The frontend production release SHALL retain the immediately previous static tree until the new tree is active through the proxy and public readiness has succeeded.

#### Scenario: New static tree becomes ready

- **WHEN** the new static tree has been atomically exposed, the proxy has accepted a graceful reload, and public readiness returns HTTP 200
- **THEN** the previous static tree may be removed

#### Scenario: Readiness does not succeed within the bounded window

- **WHEN** public readiness does not return HTTP 200 within 30 seconds after the static swap
- **THEN** the previous static tree MUST be restored atomically
- **AND** the proxy MUST be gracefully reloaded against the restored tree
- **AND** the deploy MUST exit unsuccessfully

### Requirement: Proxy activation is graceful and fail-closed

The frontend production release MUST validate the active proxy configuration before activation and SHALL activate the new static tree without stopping or recreating the proxy container.

#### Scenario: Proxy configuration is valid

- **WHEN** the active proxy configuration passes validation after the static swap
- **THEN** the release SHALL request a graceful proxy reload
- **AND** active client connections SHALL not be intentionally terminated by a container restart

#### Scenario: Proxy validation or reload fails

- **WHEN** proxy configuration validation or the graceful reload command fails
- **THEN** the release MUST restore the previous static tree
- **AND** the release MUST report failure before post-deploy acceptance checks run

### Requirement: Acceptance checks wait for public readiness

Post-deploy acceptance checks SHALL start only after the public production health route has returned HTTP 200 through the live proxy within a bounded retry window.

#### Scenario: Public readiness succeeds

- **WHEN** the public health route returns HTTP 200 within 30 seconds
- **THEN** post-deploy SEO and media acceptance checks may start

#### Scenario: Public readiness remains unavailable

- **WHEN** the public health route does not return HTTP 200 within 30 seconds
- **THEN** post-deploy acceptance checks MUST NOT run against the unavailable release
- **AND** the deploy MUST execute the static rollback path

### Requirement: Deploy regression control prevents backend restart

The repository MUST contain an automated regression control that fails when the canonical frontend production deploy can restart the backend application or when its activation sequence no longer preserves validation, graceful reload, readiness, and rollback ordering.

#### Scenario: Backend restart is reintroduced

- **WHEN** the canonical frontend deploy source contains an app restart or recreate command in its frontend publication path
- **THEN** the deploy-contract regression test MUST fail

#### Scenario: Safe activation ordering is removed

- **WHEN** the canonical frontend deploy deletes the previous static tree before proxy validation and readiness or runs post-deploy checks before readiness
- **THEN** the deploy-contract regression test MUST fail
