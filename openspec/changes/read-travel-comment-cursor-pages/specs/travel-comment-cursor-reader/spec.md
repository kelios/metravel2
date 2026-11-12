## Purpose

Preserve complete travel discussions when the server limits each ordinary comment-list response to a bounded cursor page.

## ADDED Requirements

### Requirement: Complete ordinary comment reads
The shared client SHALL read all cursor pages for a travel or thread lookup and return the complete ordered comment array. It MUST retain the original lookup and transmit each opaque `next` token only as the `cursor` parameter.

#### Scenario: Multiple pages
- **WHEN** an ordinary list returns comments with a non-null next token
- **THEN** the client reads subsequent pages until next is null and returns their comments in order

#### Scenario: Older backend
- **WHEN** the first response is a legacy comment array
- **THEN** the client returns that array without requesting another page

#### Scenario: Expanded conversation
- **WHEN** a caller requests expanded sub-threads
- **THEN** the existing bounded expanded-list contract is used without cursor pagination

### Requirement: Incomplete reads fail explicitly
The client MUST reject malformed cursor pages, repeated continuation tokens and continuation errors instead of exposing an empty or partial discussion. Initial missing or inaccessible discussion behavior SHALL remain compatible.

#### Scenario: Continuation fails
- **WHEN** a continuation returns an HTTP error or an invalid page
- **THEN** the complete read rejects and no partial comment array is returned

#### Scenario: Repeated token
- **WHEN** a next token has already been used in this read
- **THEN** the read rejects without repeating that request

#### Scenario: Legacy sub-thread continuation fails
- **WHEN** an expanded-list fallback needs a child thread whose continuation fails
- **THEN** the conversation read rejects instead of silently omitting replies
