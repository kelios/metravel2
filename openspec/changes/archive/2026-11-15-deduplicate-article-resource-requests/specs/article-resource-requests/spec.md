## Purpose

Preserve efficient and consistent resource loading on the public web surfaces covered by task #3439.

## ADDED Requirements

### Requirement: Canonical resource identity
The application SHALL satisfy the following observable contract: Opening the article catalog or an article produces zero article API redirects; a healthy numeric detail has exactly one detail request shared with breadcrumbs; first-party covers use their proxy URL.

#### Scenario: Healthy public navigation
- **WHEN** a guest opens the affected page at mobile 390 DPR3 or desktop 1440 DPR1 and scrolls five viewports
- **THEN** its observed requests satisfy the stated zero-redirect and single-resource limits

#### Scenario: Loading and unavailable data
- **WHEN** fresh content is loading, unavailable, or served from a supported offline cache
- **THEN** the existing loading/error/offline behavior remains available and no failure is presented as successful new content

#### Scenario: Unchanged adjacent content
- **WHEN** a neighboring catalog or an existing full-width image is displayed
- **THEN** the existing route, image geometry, alt text and navigation actions remain unchanged
