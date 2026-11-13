# AI feature build boundary Specification

## Purpose

Keep disabled AI features out of delivered application code while preserving synchronous shared form contracts and enabled feature behavior.

## Requirements


### Requirement: Disabled features do not load executable AI modules

The application SHALL load AI executable code only inside its literal build-time feature condition. With the feature disabled it MUST make no AI request; enabled requests, cancellation and rendered outcomes MUST retain their existing contract.

#### Scenario: Feature disabled
- **WHEN** the assistant or picks feature flag is absent
- **THEN** its executable module is not loaded by the affected authoring or near-route consumer and no request is sent

#### Scenario: Feature enabled and request superseded
- **WHEN** an enabled authoring action is superseded or its consumer unmounts during module or request loading
- **THEN** the obsolete action does not publish a result or start a request after cancellation

### Requirement: Shared form policy remains synchronous and independent

Shared authoring, tag and map policy SHALL expose the existing values and types synchronously without importing feature clients or their side effects. Existing feature-policy exports MUST remain compatible.

#### Scenario: Normalization without feature loading
- **WHEN** a caller normalizes map or tag input without loading an AI feature
- **THEN** the result is synchronous and uses the same limits and field identifiers as the feature policy

### Requirement: App-source publication checks enforce the AI boundary

Selective publication validation SHALL include the AI build-boundary check for application component, hook and API source edits. The check MUST recognize picks, assistant and static-similar literal conditions without allowing new static feature imports.

#### Scenario: Source edit outside a feature folder
- **WHEN** a component, hook or API source path changes
- **THEN** the normal selective pre-push test plan includes the AI build-boundary suite

#### Scenario: Existing static-similar condition
- **WHEN** a feature is guarded only by the static-similar literal flag
- **THEN** the check accepts that literal guard but rejects an unguarded or statically imported feature
