## Why

Board #2382 records residual findings from the BUGS-web train: map category selections can lose an unresolved name or ignore numeric URL IDs, default filter controls offer ineffective clearing, and deferred travel sections reserve different geometry from their loaded content. These related review tails need explicit contracts before another implementation pass.

## What Changes

- Normalize category ID/name selections consistently across URL, radius, cluster, route and offline paths; do not silently narrow a mixed selection to only resolved IDs.
- Describe point counts as points, use location-neutral map SEO copy, and make loaded-page category counts explicitly scoped rather than implying whole-radius facets.
- Make group clearing default-aware in the shared filter panel; keep personal-trip location filter geometry stable before data.
- Prevent guest PDF capabilities requests to auth-only endpoints and align documentation with the actual save/export action.
- Reserve complete nearby/popular sidebar geometry across deferred/loading/loaded states, using the existing fixed-height rail pattern and coordinate-aware map-toggle reservation.
- Make an explicitly bounded, behavior-preserving map API split a separate stage of the same approved work; record existing similar/nearby rail UX without changing it.

Goal / user-visible result: honest map labels and complete selection semantics, useful reset controls and no sidebar loading shift at the documented widths.
Existing behavior to preserve: category OR-selection, current endpoints/payloads, consent/auth boundaries, right order of travel sections, current nearby and similar layouts and default BY+PL selection.
Non-goals: backend edits, new facet endpoint, unique-place identity inference from coordinates, redesign, native-specific branches, changing item k UX without an explicit owner request.
Dependencies: #2374/#2375/#2369/#2253 are historical context; #2367 is currently testing and requires live-owner coordination before any overlapping apply. Exact radius-wide category facets require a separately owned backend contract; this change must not claim to deliver them from paginated client data.
Fallback/mock policy: Jest mocks only; acceptance uses production API. Unknown name filters retain a truthful loaded-data fallback; absent authoritative facets are explicitly labeled as loaded scope. No fabricated totals or guest auth probing.
Open questions: none for the bounded frontend work. Backend facet capability is an external follow-up, not hidden completion of item f.

## Capabilities

### New Capabilities
- `map-category-selection-integrity`: consistent category URL/selection and honest count scope.
- `default-aware-filter-actions`: reset actions and data-dependent filter slots that reflect real state.
- `travel-sidebar-reservation`: coordinate-aware nearby and fixed-height popular sidebar geometry.
- `guest-pdf-capability-access`: avoid auth-only capability traffic for guest export.

### Modified Capabilities
None; no existing main spec covers these tail contracts.

## Impact

- Platform impact: desktop/mobile web; shared leaf utilities/hooks retain native consumers but native branches unchanged. No automatic device gate. Planning itself: none.
- Localization impact: RU/BE/UK/PL/EN map point/count-scope labels and neutral SEO, via existing i18n. Planning itself: none.
- API/data: existing map/PDF endpoints and payloads preserved; exact backend facets deferred with explicit owner dependency. Scoped refactor preserves public `api/map.ts` exports.
- SEO: only location-neutral map title/description; preserve canonical/robots/sitemap and current heading semantics.
- Accessibility: effective clear labels, wrapped localized counts, 44px actions, decorative skeletons hidden from assistive technology.
- Performance: stable sidebar reservation and trip first frame; no increased map pagination to fake facets or extra auth probes.
- Security: validate category input against dictionary; preserve PDF authentication boundary and external-link chokepoint.
- Analytics: existing map/export events preserved; no new event requirement.
