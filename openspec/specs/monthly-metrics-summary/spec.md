# Monthly Metrics Summary Specification

## Purpose

Provide reproducible monthly growth evidence with source attribution, trustworthy comparisons and explicit limits of community history inferred from a current public content snapshot.

## Requirements

### Requirement: Completed calendar-month reporting
The summary SHALL default to the last twelve completed calendar months, collect preceding comparison months when available, and state the generation date, absolute reporting window and source calendar conventions. Operators SHALL be able to select an explicit ending month and GA4 property and request machine-readable JSON alongside the saved Markdown.

#### Scenario: October execution
- **WHEN** the summary runs on 2026-10-19
- **THEN** its principal reporting window is 2025-10-01 through 2026-09-30 and its YoY baseline window is 2024-10-01 through 2025-09-30

#### Scenario: Leap-year boundary
- **WHEN** a reporting month is February 2024
- **THEN** the month includes February 29 without overlapping March

### Requirement: Source metrics and independently qualified availability
The summary SHALL include GSC clicks, impressions, CTR and average position; GA4 active users, sessions, bounce rate and channels; and counts for quest_start, quest_finish, registration_view, registration_complete, Affiliate_Impression, Affiliate_Click and app_download_click. Yandex SHALL be collected when configured access exists, otherwise reported as a gap. Missing, partial, invalid or historically unavailable data MUST NOT be presented as measured zero.

#### Scenario: Successful month
- **WHEN** a source returns a complete valid monthly response
- **THEN** its monthly numbers include the source identity and measurement period

#### Scenario: Optional access failure
- **WHEN** Yandex credentials are unavailable or one Google source cannot be accessed
- **THEN** the report identifies that gap and preserves independently available sources

#### Scenario: Empty or incomplete source
- **WHEN** a source returns no observations without sufficient coverage evidence or returns a truncated response
- **THEN** the affected measurements are marked unavailable or partial and are excluded from definitive growth claims

#### Scenario: Slow network
- **WHEN** a source does not respond within its request deadline
- **THEN** collection terminates that request and the summary records a timeout gap

### Requirement: Comparison arithmetic reflects available evidence
The summary SHALL compare matching calendar months one year apart only when both values are valid. A zero or absent denominator SHALL produce an explicit non-calculable comparison, never fabricated percentage growth. CTR and bounce changes SHALL use percentage points and average-position changes SHALL retain their directional interpretation.

#### Scenario: Available baseline
- **WHEN** valid monthly sessions are 150 and the prior-year month is 100
- **THEN** the sessions YoY result is 50 percent

#### Scenario: Zero baseline
- **WHEN** the prior-year month has zero or unavailable observations
- **THEN** the percentage comparison is explicitly non-calculable

### Requirement: Current content and qualified community history
The summary SHALL report current public articles, author-1 share, distinct identifiable authors, quests and quest completions. Monthly community values SHALL traverse all currently published article history before the reporting window, use publication timestamps when the catalogue advertises them, and use created_at only when the publication-date field is unavailable catalogue-wide, explicitly labelled as a trip-date proxy. The report MUST NOT mix these two date meanings in one community series. New authors SHALL mean first observed dated publication among currently public articles, qualified as an approximation. An undated article for an author MUST prevent claiming a known first publication month for that author. Missing identity or date fields and incomplete catalogues SHALL be explicit gaps.

#### Scenario: Existing author predates reporting window
- **WHEN** an author has a currently public article before the window and another inside it
- **THEN** the author is excluded from new-author counts inside the window

#### Scenario: Undated earlier history
- **WHEN** an author has both a dated article inside the window and an article without a usable date
- **THEN** no first-publication month is asserted for that author

#### Scenario: Advertised publication-date contract
- **WHEN** the catalogue advertises publication timestamps but some articles have no usable publication date
- **THEN** those articles remain undated rather than falling back individually to a trip date

#### Scenario: Catalogue has no publication-date field
- **WHEN** no article advertises the publication-date field
- **THEN** usable created_at dates form an explicitly labelled trip-date approximation

### Requirement: Durable readable report and safe output
The command SHALL save Markdown in the ignored metrics-summary directory with a date-based filename and display the resulting path. The report SHALL include monthly evidence, snapshot scope, comparison availability and gaps while excluding credentials and untrusted raw authentication responses. Existing individual statistics commands SHALL retain their documented behavior.

#### Scenario: Report generation
- **WHEN** collection completes with any combination of available sources and gaps
- **THEN** the dated Markdown report contains the absolute window, source attribution and gap explanations and its path is displayed

#### Scenario: Upstream authentication error
- **WHEN** an upstream authentication response contains sensitive details
- **THEN** the report contains a bounded sanitized reason without tokens or raw authentication payloads

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
