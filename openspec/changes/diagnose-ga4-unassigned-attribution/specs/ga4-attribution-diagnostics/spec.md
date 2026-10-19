## Purpose

Allow operators to diagnose unexplained web acquisition with reproducible GA4 reports and preserve campaign/session attribution when sending application events.

## ADDED Requirements

### Requirement: Reproducible completed-day reporting
The reporting interface SHALL support N completed property-calendar days, explicit inclusive start/end dates for repeatable comparisons, and both readable and JSON output. It SHALL reject invalid dates, reversed ranges and nonpositive or nonintegral day counts before requesting credentials. Existing totals and optional event reporting SHALL remain available.

#### Scenario: Completed days
- **WHEN** an operator requests 30 days on property-calendar date 2026-10-19
- **THEN** the report covers 2026-09-19 through 2026-10-18 inclusive and identifies the property time zone and dates.

#### Scenario: Explicit comparison
- **WHEN** an operator supplies start 2026-10-20 and end 2026-10-26
- **THEN** the report uses those dates regardless of the day the command runs.

#### Scenario: Invalid input
- **WHEN** a date range is reversed or the requested day count is zero, fractional or malformed
- **THEN** the command fails with a useful error without calling the authenticated reporting service.

### Requirement: Independent channel and source diagnostics
The diagnostic report SHALL show overall sessions, Unassigned sessions and their percentage from independently aggregated reports, source/medium aggregates for Unassigned, and detail rows containing source, medium, landing page, device category, platform and stream with sessions and active users. Detail rows SHALL NOT be summed to manufacture a headline denominator or per-source totals.

#### Scenario: Non-additive detailed rows
- **WHEN** headline reports return 516 total sessions and 169 Unassigned sessions while detailed rows sum to 171
- **THEN** the reported Unassigned share is calculated as 169/516 and the report identifies the detail rows as non-additive.

#### Scenario: All pages retrieved
- **WHEN** the service returns more source or detail rows than fit in one page
- **THEN** the report retrieves the remaining pages or clearly marks the output incomplete.

### Requirement: Explicit data limitations and errors
The report SHALL retain service metadata relevant to thresholding, sampling, high-cardinality data loss, truncation and empty results. Missing data SHALL NOT be represented as evidence that attribution meets the target. Service permission/network errors SHALL fail explicitly without exposing credentials.

#### Scenario: Empty denominator
- **WHEN** no sessions exist in the requested window
- **THEN** the report identifies no data and does not claim a passing 0% Unassigned share.

#### Scenario: Thresholded output
- **WHEN** the service indicates thresholding or data loss
- **THEN** both output formats expose that limitation alongside the affected report.

### Requirement: GA event attribution isolation
Application UI origin and application-generated identity parameters SHALL reach GA under application-specific names without overwriting GA source, client identity or session identity. Other analytics providers and internal event consumers SHALL retain the original application payload.

#### Scenario: UI event
- **WHEN** an application event has source `quest_detail`, client_id and session_id
- **THEN** GA receives ui_source, metravel_client_id and metravel_session_id and does not receive those values as source, client_id or session_id, while other consumers retain the original names.

### Requirement: Initial page view before queued GA custom events
The first GA page view SHALL be queued after GA configuration and before deferred custom events. Events SHALL be delivered once per available provider, including when the providers become ready at different times. Existing consent, sensitive-URL redaction, automation exclusion and disabled native analytics SHALL remain effective.

#### Scenario: Staggered provider readiness
- **WHEN** application events occur before GA is ready while Metrika is already ready
- **THEN** Metrika receives each event once, GA receives its first page view before those custom events, and later readiness does not duplicate provider delivery.

### Requirement: Governed first-party campaign medium vocabulary
New first-party share links and share-card attribution payloads SHALL use the same allowed medium vocabulary with an enforced regression check. Campaign identity, existing supplied UTM values, URL path, unrelated query values and fragments SHALL be preserved.

#### Scenario: Share outputs agree
- **WHEN** a fresh share link and share-card payload are generated for the same campaign
- **THEN** both use a medium from the allowed vocabulary and retain the existing campaign identity.

#### Scenario: Existing attribution
- **WHEN** the supplied URL already contains UTM values and a fragment
- **THEN** those values and the fragment remain intact without duplicated UTM parameters.

### Requirement: Evidence-based temporal acceptance
The production attribution gate SHALL compare independently aggregated Unassigned and total sessions on seven fully deployed property-calendar days after processing allowance, with a strict target below 10%. Observed source explanations and unresolved unknowns SHALL remain explicit.

#### Scenario: Metric not yet observable
- **WHEN** seven fully deployed days plus processing allowance have not elapsed
- **THEN** the task retains a dated recheck gate and does not claim the metric passed.
