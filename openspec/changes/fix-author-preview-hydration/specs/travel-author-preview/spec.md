## Purpose

Define a private author-preview entry that adopts the delivered document safely, reads owned drafts with the existing session, and preserves public access boundaries.

## ADDED Requirements

### Requirement: Cold author preview preserves the initial document route

The web application SHALL preserve the delivered creation route through its first client render and adopt its server markup before navigating to a valid saved travel preview. It MUST retain static rendering and MUST NOT suppress hydration errors or substitute an arbitrary navigation delay for the lifecycle handoff.

#### Scenario: Author opens a saved draft in a new tab

- **GIVEN** the author's valid web session and a saved private travel
- **WHEN** the author selects “Открыть путешествие” at either 390 or 1440 pixels
- **THEN** the new tab first adopts the creation document's existing loading markup
- **AND** it subsequently displays that travel's title and owned description at its numeric detail route
- **AND** zero React hydration errors, including #418 and #419, are recorded
- **AND** the creation form never appears in the preview tab

#### Scenario: Session restoration is slow

- **WHEN** a valid cold preview opens while the session's initial check is unresolved
- **THEN** the existing loading state remains until the session check settles
- **AND** the preview does not start an owner detail read classified as a confirmed guest read

### Requirement: Preview target accepts only internal positive numeric identities

The preview entry SHALL accept a positive numeric travel ID only on its creation route. Missing or invalid preview inputs MUST preserve ordinary creation behavior and MUST NOT generate an external destination or alter an edit route.

#### Scenario: Missing or invalid preview identity

- **WHEN** the creation route has no preview identity, zero, a negative number, a slug, or a path-like value
- **THEN** ordinary creation behavior is retained and no preview navigation occurs

#### Scenario: Preview input is supplied to another route

- **WHEN** an edit or public detail route includes the same preview query input
- **THEN** that route retains its ordinary behavior without a preview redirect

### Requirement: Public preloading does not read private preview destinations

Public preloading SHALL remain anonymous and SHALL be bound to the original eligible public document destination. A cold private-preview entry MUST NOT start an anonymous detail preload, and a delayed public preload MUST NOT fetch a different SPA destination.

#### Scenario: Private cold preview reaches detail loading

- **WHEN** the cold private preview starts its detail read
- **THEN** no anonymous public-preloader request is issued for that draft
- **AND** the existing authenticated detail request can return the owner-visible content

#### Scenario: Public preload executes after the route changes

- **GIVEN** a public document scheduled a preload for one travel
- **WHEN** the tab navigates to another travel before that preload executes
- **THEN** the delayed preload does not fetch the new destination
- **AND** ordinary detail loading remains available for the new destination

#### Scenario: Public detail opens normally

- **WHEN** a public ID or slug detail opens directly without a route change
- **THEN** its existing anonymous preload and payload reuse remain eligible
- **AND** public preloading does not start forwarding cookies or browser tokens

### Requirement: Preview retains private access and existing failure states

Owner preview SHALL use the existing cookie session and private-detail authorization. Anonymous or unauthorized access MUST remain denied; preview routing MUST NOT widen visibility, fabricate successful data, or replace the existing unknown-travel error state with a blank creation form.

#### Scenario: Guest requests the private draft

- **WHEN** a guest requests the owned test draft through the private detail endpoint
- **THEN** the response remains 404 and no private title or description is returned

#### Scenario: Unknown positive identity

- **WHEN** a preview entry targets an unknown positive travel ID
- **THEN** the existing detail error state appears after the denied detail read
- **AND** no hydration error or empty creation form replaces it

#### Scenario: Successful owner preview is validated

- **WHEN** the permanent browser regression exercises the actual editor preview action
- **THEN** it asserts document/visible title/description, records unfiltered page and console errors, and observes network initiators
- **AND** neither session-success nor detail-success responses are mocked
- **AND** only task-owned temporary travel data is cleaned up
