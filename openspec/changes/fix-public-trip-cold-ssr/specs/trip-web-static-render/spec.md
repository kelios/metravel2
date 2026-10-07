## Purpose

Preserve usable static trip pages and deterministic first-client rendering, with observable cold-load and authenticated-flow checks that expose hydration recovery rather than hiding it.

## ADDED Requirements

### Requirement: Cold catalog output is usable before client initialization
The public trip catalog SHALL expose its established loading or data state and route metadata in the initial static response. Client initialization MUST preserve the first-render structure without hydration recovery errors or subtree replacement.

#### Scenario: Cold loading with a slow catalog response
- **GIVEN** a fresh guest session and a delayed catalog response
- **WHEN** the user enters `/trips` directly
- **THEN** the initial response contains the catalog's loading state and canonical metadata, and the page reaches its populated or empty state without React #418/#419 or a page exception

#### Scenario: Real empty and populated catalog
- **WHEN** the catalog response is a valid empty collection or a collection containing trips
- **THEN** the page shows the corresponding established empty or populated state, preserves applicable search/filter controls, and does not recover a failed server subtree

### Requirement: Errors and offline recovery remain truthful
The trip catalog SHALL retain the existing error, retry and available offline-data behavior. A failed response MUST NOT be represented as a successful empty collection merely to keep the initial render quiet.

#### Scenario: Failed first response and successful retry
- **WHEN** a catalog request fails and the user retries after connectivity returns
- **THEN** the existing error/retry state is reachable, successful data replaces it, and no unhandled page or hydration error is emitted

#### Scenario: Filtered-empty catalog
- **GIVEN** the user has entered a search or filter that matches no trips
- **WHEN** the empty result is displayed
- **THEN** the existing search/filter/reset semantics remain available and the page does not confuse a filtered result with the unfiltered-empty state

### Requirement: Trip navigation and locale initialization preserve first-render semantics
Direct and in-app trip navigation SHALL preserve route metadata, headings, keyboard/focus behavior and locale initialization for RU, BE, UK, PL and EN without an artificial whole-screen client-only delay.

#### Scenario: Theme and locale cold entry
- **GIVEN** a supported locale and light or dark theme
- **WHEN** the user enters the public catalog in a fresh session
- **THEN** the initial static and first-client structures agree, translated labels retain their existing meanings, and the page emits no React #418/#419

#### Scenario: In-app navigation and own-trip dashboard
- **WHEN** the user opens the catalog through in-app navigation and then opens `/trips/my`
- **THEN** the established navigation, search semantics, route metadata and own-trip loading/content states remain usable without new page or hydration errors

### Requirement: Authenticated trip flows remain covered by the canonical acceptance
Creating a trip, viewing its detail as another account, applying, cancelling the application and viewing own trips SHALL complete with the existing endpoints and authentication semantics. Normal authenticated requests MUST NOT cause avoidable 400/401 failures, page exceptions or React #418/#419 errors.

#### Scenario: Create and application lifecycle
- **GIVEN** two usable test-owned authenticated accounts
- **WHEN** account A creates a public trip and account B opens it, applies, cancels and opens its own-trip dashboard
- **THEN** the expected persisted trip/application state is observed, no unexpected 400/401 or page/hydration errors occur, and test-owned data can be cleaned up through the established procedure
