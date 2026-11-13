## Purpose

Record visible human article visits independently of cached article reads while identifying renderer traffic so service requests do not inflate author view counts.

## ADDED Requirements

### Requirement: A visible article sends one human-view event per visit

The client SHALL send one bodyless `POST /api/travels/<id>/view/` after a valid article is displayed on the focused route and session restoration is complete. It MUST NOT send the event merely because article data was requested or server-rendered. The client MUST NOT implement a timed or global deduplication policy.

#### Scenario: Hydrated or fetched article becomes visible
- **WHEN** an article with a positive safe integer ID is displayed on a focused client route after session restoration
- **THEN** one POST is sent without a body or renderer marker
- **AND** the displayed counter is not optimistically incremented

#### Scenario: Stable visible article rerenders
- **WHEN** the displayed article rerenders, its responsive layout remounts the content subtree, or client effects replay without a new visit
- **THEN** no additional view POST is sent

#### Scenario: Another visible visit occurs
- **WHEN** the reader returns after leaving the article or displays a different article
- **THEN** that visible visit can send one new POST
- **AND** the backend determines whether it adds to the daily counter

#### Scenario: Article is not yet displayed
- **WHEN** only a loading fallback, an error, an invalid ID, an unfocused retained route, or a server-rendered document exists
- **THEN** no human-view POST is sent

### Requirement: Human-view events preserve platform authentication

Web view requests SHALL include session cookies and the existing CSRF token header when available. Native view requests SHALL use the existing secure stored Token credential when available, omit cookies, and omit CSRF. A guest MUST be able to send the event without a fabricated credential.

#### Scenario: Cookie-authenticated web reader
- **WHEN** a web reader has a session cookie and a CSRF cookie
- **THEN** the event includes credentials and the matching `X-CSRFToken` header
- **AND** no stored native Authorization token is read or sent

#### Scenario: Native reader
- **WHEN** an Android or iOS reader has a secure stored access token
- **THEN** the event carries `Authorization: Token <token>` with omitted cookies and no CSRF header

#### Scenario: Guest reader
- **WHEN** a reader has no authentication credential
- **THEN** one credential-free event can complete with 204 without an authenticated CSRF requirement

### Requirement: Human-view failures remain silent and are never retried

The client SHALL accept 204 success and SHALL silently finish all other HTTP outcomes, network failures and timeouts without a toast, unhandled rejection, counter mutation or retry. Existing retry defaults for unrelated requests SHALL remain unchanged.

#### Scenario: Endpoint rejects or cannot be reached
- **WHEN** the event receives 401, 403, 404, 429, 502 or another error, loses its network connection, or times out
- **THEN** no second request is sent during that visible visit
- **AND** article reading continues without an error notification or unhandled rejection

#### Scenario: Slow event reaches its deadline
- **WHEN** a view request remains unfinished at the existing request deadline
- **THEN** it is aborted and silently settles without retrying

### Requirement: Every renderer API request identifies service traffic

Renderer API requests SHALL carry `X-Metravel-Render: ssr` on original and existing retry attempts. Caller-supplied case variants MUST NOT override or duplicate that marker. Existing forwarded, custom, deadline, abort and response behavior SHALL be preserved.

#### Scenario: Renderer reads article and supporting data
- **WHEN** the server renderer requests public route data through either supported transport
- **THEN** every request carries the SSR marker
- **AND** article loading does not emit a human-view POST

#### Scenario: Renderer transport retries a transient connection failure
- **WHEN** an existing bounded retry is taken
- **THEN** the retry carries the same SSR marker and original request semantics

#### Scenario: Renderer caller supplies a conflicting marker
- **WHEN** request headers contain any case variant of `X-Metravel-Render`
- **THEN** the outgoing request contains one effective SSR marker
- **AND** caller headers are not mutated

### Requirement: Backend-owned view counting remains authoritative

The client SHALL preserve preloaded article reuse and server-owned count values. Counter acceptance MUST distinguish a successful event from a counted event: authors and service traffic do not increment, and repeated identity/article events within 24 hours do not increment again.

#### Scenario: Fresh human reader and repeated visit
- **WHEN** a non-author human reader opens an unused public article and reopens it within 24 hours
- **THEN** each opening emits exactly one event
- **AND** the real server counter changes by +1 on the first opening and +0 on the repeat

#### Scenario: Renderer activity on the controlled article
- **WHEN** only SSR/service requests read the controlled article
- **THEN** the real server counter changes by +0
