## Purpose

Provide reproducible monthly growth evidence with source attribution, trustworthy comparisons and explicit limits of community history inferred from a current public content snapshot.

## ADDED Requirements

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
