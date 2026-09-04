## Purpose

Defines how an operator script reads a paginated list from the travels API: which
signal ends the walk, how a full last page is distinguished from a page that has a
successor, what happens when the envelope carries no cursor, and what an empty or
malformed answer must produce.

## ADDED Requirements

### Requirement: End of list is decided before the next page is requested
The system SHALL decide that a paginated list has ended from the answer already in
hand, and SHALL NOT request a page in order to learn that it does not exist.

#### Scenario: Item count is an exact multiple of the page size
- **GIVEN** the page size is 100 and the list holds exactly 300 items
- **WHEN** the system reads the list
- **THEN** the system returns all 300 items
- **AND** the system requests pages 1, 2 and 3 only
- **AND** the system does not request page 4

#### Scenario: Last page is not full
- **GIVEN** the page size is 100 and the list holds 320 items
- **WHEN** the system reads the list
- **THEN** the system returns all 320 items
- **AND** the system requests pages 1 through 4 only

#### Scenario: A page past the last one answers with an error
- **GIVEN** the source answers the page after the last one with `HTTP 404 «Invalid page»` rather than an empty list
- **WHEN** the system reads a list whose item count is an exact multiple of the page size
- **THEN** the read completes successfully
- **AND** no error is raised

### Requirement: Cursor is the leading end signal
The system SHALL treat the envelope's `next` cursor as the authoritative end
signal whenever the envelope carries that field: a falsy `next` MUST end the walk
and a non-empty `next` MUST continue it, regardless of how many rows the page
held.

#### Scenario: Full page carrying a null cursor
- **WHEN** a page returns the full page size of rows and `next` is `null`
- **THEN** the system ends the walk after that page

#### Scenario: Short page carrying a cursor
- **WHEN** a page returns fewer rows than the page size and `next` is a non-empty value
- **THEN** the system requests the following page

### Requirement: Fallback end signals for an envelope without a cursor
WHEN the envelope carries no `next` field, the system SHALL end the walk on the
first of these that applies: the accumulated item count has reached a declared
`count` or `total`, or the page returned fewer rows than the page size.

#### Scenario: Legacy envelope with a declared total
- **GIVEN** the page size is 100 and the envelope reports a total of 200 with no `next` field
- **WHEN** the system reads the list
- **THEN** the system returns 200 items
- **AND** the system requests pages 1 and 2 only

#### Scenario: Legacy envelope with neither cursor nor total
- **GIVEN** the page size is 100 and the envelope reports neither `next` nor a total
- **WHEN** a page returns fewer rows than the page size
- **THEN** the system ends the walk after that page

### Requirement: Page size is a single value
The system SHALL derive the requested page size and the short-page comparison from
one value, so that the request step and the end test cannot disagree.

#### Scenario: Requested size and comparison agree
- **WHEN** the system requests a page
- **THEN** the size it asks for is the same value it compares the returned row count against

### Requirement: Envelope shapes accepted for the rows
The system SHALL read the rows of a page from `results` in preference to the
legacy `data`, `items` and `rows` keys, and SHALL accept a bare array as the whole
page.

#### Scenario: Current API envelope
- **WHEN** a page answers `{count, next, previous, results}`
- **THEN** the system reads the rows from `results`

#### Scenario: Unreadable page
- **WHEN** a page answers with a value that is neither an array nor an object carrying any of the accepted row keys
- **THEN** the system reads that page as zero rows
- **AND** the system ends the walk without raising an error

### Requirement: An empty list stays a reportable outcome
The system SHALL return an empty list rather than raise when the first page holds
no rows, leaving the caller free to treat "nothing found" as a failure of its own.

#### Scenario: First page is empty
- **WHEN** the first page returns zero rows
- **THEN** the system returns an empty list
- **AND** the caller's own empty-selection guard decides whether that is an error

### Requirement: Runaway guard
The system SHALL stop after a bounded number of pages even if the source keeps
advertising a successor, so a misbehaving source cannot make a run walk forever.

#### Scenario: Source always advertises a next page
- **WHEN** every page returns a non-empty `next`
- **THEN** the system stops at the bound and returns what it has read
