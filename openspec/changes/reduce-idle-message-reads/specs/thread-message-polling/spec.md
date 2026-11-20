## ADDED Requirements

### Requirement: Incremental conversation refresh

An open conversation SHALL synchronize with the thread-scoped changes cursor, retain older paged history, and discard inaccessible or obsolete results.

#### Scenario: Quiet foreground conversation

- **WHEN** the open screen stays unchanged for ten minutes after loading
- **THEN** polling the conversation and thread list takes at most thirty reads in total and supported change responses contain no unchanged message bodies

#### Scenario: Catch-up and explicit activity

- **WHEN** a poll, successful send or return to the foreground starts a refresh
- **THEN** the client consumes successive change pages, replaces messages by ID, and applies removals

#### Scenario: Scope changes

- **WHEN** the reader or conversation changes, a cursor is reset, or access is denied
- **THEN** the old messages and checkpoint are discarded and late requests cannot restore them

#### Scenario: Numbered history

- **WHEN** the reader requests older messages
- **THEN** the client uses numbered pages and deduplicates overlapping results
