# catalog-place-search-scope Specification

## Purpose

Сделать область поиска в каталоге мест предсказуемой и сохранить явный выбор человека при смене запроса.

## Requirements

### Requirement: Search scope follows category intent
The catalog SHALL use starter categories only when the route has no category and the trimmed search is empty. It SHALL honor explicit categories and treat an explicitly empty category as all categories.

#### Scenario: Browse and search without a category
- **WHEN** a visitor opens the catalog without a category, then searches for a name outside the starter selection
- **THEN** the initial list uses starter categories and the search uses all categories within the current country
- **AND** clearing the search restores the starter selection

#### Scenario: Deep link with query and country
- **WHEN** a visitor opens a link with a nonempty query and a country
- **THEN** the first list request uses that query and country, with category filters only if the route names them
- **AND** an explicit category selection, including all categories, persists when the search is cleared

### Requirement: Visible scope and expansion from an empty result
The catalog SHALL display the explicit category names or the all-categories scope next to the results on narrow and wide layouts. A settled empty result with explicit category filters SHALL offer a way to search all categories.

#### Scenario: Expand an empty category result
- **WHEN** the visitor chooses to search all categories from a settled empty category result
- **THEN** the route has an explicit empty category and the list starts on page one with the same query, country and sort
- **AND** the visitor still has a separate action to reset the filters

#### Scenario: Pending results and retries
- **WHEN** search is waiting for typing to settle or a changed list is loading
- **THEN** stale empty results do not offer an action for the pending search
- **AND** a failed request can be retried with the same query and scope

#### Scenario: Request budget
- **WHEN** a visitor types several characters without pausing
- **THEN** the catalog issues one list request for the settled search and uses an unfiltered first page to populate its scope
- **AND** pagination continues with the same filters, scope and sort
