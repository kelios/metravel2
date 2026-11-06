## Context

`usePlacesCatalogController` currently initializes the category array to the starter set for a missing route parameter. `usePlacesCatalogQueries` sends that array even after the visitor starts a search.

## Goals / Non-Goals

Make browsing, search and empty-state actions share the same interpretation of the route. Reuse the existing GET endpoint, debounce, filter UI and EmptyState. Keep the map and the starter collection definition outside this change.

## Decisions

- Preserve route intent as undefined, an empty array, or the explicit category names. Derive the effective categories alongside the search input in the controller. Encoding automatic expansion as an empty route parameter would make clearing the search lose the starter selection.
- Keep the hydration and debounce gates. Use the effective categories for list, facets and pagination. Reuse exact list-key reset for explicit expansion so cached later pages from the same scope cannot survive it.
- Show scope in the existing results heading with localized labels or a formatted list of API category names. The empty state uses the shared primary action for expansion and secondary action for general reset. Loading or a placeholder empty result cannot trigger expansion. Both actions use existing accessible buttons.

## Risks / Trade-offs

- An early list or scope request would consume server budget. Test request order and count on cold links and during rapid input, plus pagination and a warm all-category cache.
- Keep route parameters on the existing router and values on the existing GET path. Input handling, auth and external navigation use their current contracts. SEO metadata and analytics are outside the changed paths.
- Verify localized wrapping in the current responsive header. No media, dependency or platform-specific changes are required.

## Rollback

Revert the frontend commit. Existing route links and API payloads need no migration.

## Validation

Controller and screen Jest, focused lint, typecheck and all-locale resource checks before review. Production browser evidence on mobile web first and desktop web second for the published revision. Verify direct links, scope and expansion, the starter control, return from article, request budget and console. Native uses the same implementation with no native-only boundary change.
