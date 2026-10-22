## ADDED Requirements

### Requirement: Qualified store downloads alongside referral clicks
The summary SHALL import official Apple Sales and Trends summary reports and Google Play monthly installation reports using explicit source, application identity, calendar and coverage metadata. Both supported formats MUST use their official Pacific Time calendar, represented as `America/Los_Angeles`; incompatible manifest calendars MUST be rejected without date conversion. Apple report boundaries MUST exactly match the manifest window. Apple initial downloads and redownloads SHALL be separate from Google device installs and user installs and from web referral clicks. Updates and in-app purchases MUST NOT count as downloads. Missing access, malformed input, incompatible application identity, unqualified coverage, negative acquisition adjustments and overlapping exports MUST produce explicit unavailable values or bounded gaps rather than fabricated downloads. One source failure MUST preserve independently valid evidence from the other source.

#### Scenario: Apple acquisition and updates
- **WHEN** a qualified Apple export includes initial acquisition, redownload, update and in-app purchase rows
- **THEN** the summary counts only initial acquisition and redownload rows in their separately labelled metrics

#### Scenario: Google dimension scope
- **WHEN** a qualified Google export contains one country breakdown of daily device and user installs
- **THEN** those metrics retain their respective definitions and are not combined with duplicate dimension exports or cumulative installed-user snapshots

#### Scenario: Missing or invalid export
- **WHEN** one store has no export, invalid metrics, an unsupported identity or conflicting overlapping exports
- **THEN** its affected measurements are unavailable with a safe explanation and independently valid measurements from the other store remain available

#### Scenario: Confirmed zero
- **WHEN** a valid complete export establishes zero acquisitions for its explicitly covered period
- **THEN** the summary can show measured zero for that period and does not extrapolate it beyond the established coverage

#### Scenario: Source calendar mismatch
- **WHEN** a manifest labels an Apple sales or Google installation export as UTC instead of the source's Pacific Time
- **THEN** the affected evidence is unavailable with an explicit calendar gap while the other store remains independent

#### Scenario: Daily Apple report claimed as a month
- **WHEN** a manifest declares a complete month for an Apple report whose Begin/End Date cover only a day
- **THEN** the report is rejected and no full-month total is asserted

### Requirement: Store evidence preserves exact reporting periods
The summary SHALL retain its existing twelve completed months and SHALL show imported store evidence outside that window in a separate section with absolute start/end dates, source calendar and coverage status. A completed-month store value MUST require complete evidence for that entire month. Partial or current periods MUST NOT appear as completed-month totals or participate in definitive year-over-year comparisons.

#### Scenario: Recent launch outside monthly window
- **WHEN** the completed monthly window ends in September and an October store export is available
- **THEN** the October export appears with its exact covered dates in the store evidence section without modifying the completed-month reporting window

#### Scenario: Partial month
- **WHEN** an export covers only part of a month or declares incomplete coverage
- **THEN** its exact qualified observations are labelled as partial and no full-month or annual comparison is asserted from them

### Requirement: Private and bounded store report import
Store import SHALL read only supported local report files inside the selected private report directory, with bounded sizes, validated dates and a versioned coverage manifest. Output MUST exclude raw report rows, credentials and untrusted diagnostic payloads. Existing statistics command behavior SHALL remain compatible when store input is absent.

#### Scenario: Path escapes report directory
- **WHEN** a manifest points outside its report directory, including through a symbolic link
- **THEN** the unsafe input is rejected without copying private file content into the report

#### Scenario: Missing optional input
- **WHEN** the default store input directory does not exist
- **THEN** the command still produces its existing report and records the absent store sources as unavailable
