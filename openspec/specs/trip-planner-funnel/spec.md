# trip-planner-funnel Specification

## Purpose
Make the planner entry, available form and confirmed first save observable by source and initial authentication cohort without collecting trip content.
## Requirements
### Requirement: Preserve planner entry cohort
The system SHALL record one entry per journey with source travel|quest|assistant|navigation|direct and initial auth_state guest|authenticated, preserving it through login and subsequent save stages.

#### Scenario: Guest enters from an assistant
- **WHEN** a guest opens the planner from the assistant and signs in
- **THEN** entry and ready form retain assistant and guest attribution and a required-login outcome is observable

#### Scenario: Restoring authentication
- **WHEN** authentication is not yet restored
- **THEN** the system MUST NOT classify the visitor as a guest or record a form as ready
- **AND** a navigation action SHALL preserve its finite source until the form restores authentication

#### Scenario: Consented reload after login
- **WHEN** the same canonical form target is reopened after login or reload with analytics consent and available session storage
- **THEN** the latest unexpired local journey SHALL retain its initial cohort without adding another entry

### Requirement: Count confirmed saves only
The system SHALL reuse trip_created only for confirmed successful creation and route_point_added with outcome first_saved once per journey only after a confirmed nonempty saved route. Unsaved edits SHALL use outcome draft and failed creation SHALL have a separate error outcome.

#### Scenario: Failed creation or unsaved point
- **WHEN** creation fails or a point remains in a local draft
- **THEN** no created or first_saved result is recorded

#### Scenario: Initial route and repeated save
- **WHEN** a created trip has a confirmed route or its route is successfully saved and later saved again
- **THEN** first_saved is recorded once with the original entry cohort

### Requirement: Private and comparable reporting
The system MUST exclude titles, addresses, coordinates, dates, notes and journey tokens from analytics payloads and SHALL respect analytics consent. Reports SHALL use entries as the common denominator per source and initial auth_state, retain missing attribution and describe incomplete data and date-boundary limitations.

#### Scenario: Provider-visible navigation
- **WHEN** planner and nested login URLs are observed by the actual page tracker
- **THEN** planner context in page locations, referrers and history SHALL contain only finite planner_source and no random journey id or local target fingerprint
- **AND** local matching SHALL persist only a fingerprint of canonical form query values rather than raw form content

#### Scenario: Consent denied
- **WHEN** analytics consent is absent
- **THEN** no analytics session context is persisted and existing consent handling prevents provider delivery

#### Scenario: Report by source
- **WHEN** the report shows entry, form, creation and first point totals
- **THEN** each stage ratio uses that row's entry count and errors remain attempt counts rather than conversion rates
