# search-catalog-render-state Specification

## Purpose

Expose incomplete search catalog HTML to the existing cache boundary while preserving catalog availability and isolating response state between requests.

## Requirements

### Requirement: Incomplete first catalog page carries a renderer marker

The renderer SHALL include `X-Metravel-Search-Catalog-State: degraded` when a first-page catalog-links request fails or returns an unusable payload. It SHALL preserve the existing HTTP 200 document without the catalog-link block.

#### Scenario: First-page API failure

- **WHEN** catalog links cannot be fetched for `/search` or `/search?page=1`
- **THEN** the renderer returns HTTP 200 without the catalog-link block and includes `X-Metravel-Search-Catalog-State: degraded`

#### Scenario: First-page unusable response

- **WHEN** the first-page catalog-links endpoint returns HTTP 200 with an unusable payload
- **THEN** the renderer preserves the same fallback and includes the degraded marker

### Requirement: Complete and ineligible responses carry no degraded marker

The renderer SHALL omit the catalog-state header for successfully loaded catalog links and for requests that do not attempt a catalog-links fetch. Header state SHALL remain local to one response.

#### Scenario: Complete catalog response

- **WHEN** catalog links load successfully for page 1 or a later page
- **THEN** the renderer response omits `X-Metravel-Search-Catalog-State`

#### Scenario: Filtered or non-SSR request

- **WHEN** the request is filtered or does not use the SSR catalog loader
- **THEN** the loader preserves its existing behavior and emits no degraded marker

#### Scenario: Interleaved and sequential responses

- **WHEN** a failed first-page render overlaps with or precedes a successful render
- **THEN** only the failed response carries the degraded marker

### Requirement: Later-page failure remains a refusal

The renderer SHALL preserve existing later-page failure semantics instead of rendering the first-page fallback, and SHALL NOT emit the degraded marker for those refusals.

#### Scenario: Later-page API unavailable

- **WHEN** catalog links fail for a page greater than 1
- **THEN** the request fails with HTTP 503 instead of returning a fallback catalog document

#### Scenario: Page outside catalog range

- **WHEN** a requested catalog page does not exist
- **THEN** the request retains its existing HTTP 404 refusal
