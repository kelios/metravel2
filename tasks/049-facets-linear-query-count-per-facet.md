# TASK-20260609-049: Facets endpoint issues ~18 queries — one distinct-join per facet

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Consolidate the per-facet `Count(distinct)` queries in the facets endpoint into a smaller
set of aggregated queries (or a single query using conditional aggregation) so that the
number of DB round-trips no longer grows linearly with the number of active facets.

## Context

`travels/views.py:854-953` computes facet counts for the search/filter UI. The current
implementation:

1. Calls `_build_filtered_queryset_for_facets` once per facet (~9 facets) — each call
   rebuilds the full filtered queryset from scratch.
2. Executes a `Count('travel_id', distinct=True)` query joined through the facet's
   through-table for each facet.
3. Executes a separate `total.count()` query.

Total: approximately 9 × 2 + 1 = ~19 DB queries per facets request.

Prod observation: with an empty `where` filter (no active constraints), facets returns in
~0.31 s. With active filters each rebuilt queryset is more complex, compounding the cost.

Note: the `use_cache(300)` decorator is already present on the view, but has no effect
while `CACHED_VIEWS = False` (tracked in task 030/BE-030). Once caching is re-enabled
this issue becomes secondary, but the underlying query explosion should still be fixed.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] The number of SQL queries for a facets request is ≤ 5 regardless of the number of active facets (verified via `assertNumQueries`).
- [ ] Facet counts returned to the client are numerically identical to the current implementation for the same `where` filter.
- [ ] `_build_filtered_queryset_for_facets` is called at most once per request (queryset built once, reused).
- [ ] Response time for an empty filter drops below 0.15 s (baseline 0.31 s).
- [ ] Existing facets API contract (field names, structure) is unchanged.

## Gherkin Tests

```gherkin
Feature: Efficient facet count computation

  Scenario: Facets computed with bounded query count
    Given a travels database with 1000 published rows and 9 active facet types
    When GET /api/travels/facets/?where={} is called
    Then at most 5 SQL queries are executed
    And the response contains count values for all 9 facets

  Scenario: Facet counts are correct
    Given a known dataset where facet A has 7 matching travels
    When GET /api/travels/facets/?where=<filter> is called
    Then facet A returns count=7
    And all other facet counts match the expected values

  Scenario: Filtered facets use a single base queryset
    Given an active filter reducing the visible travels to 50
    When the facets endpoint is called
    Then _build_filtered_queryset_for_facets is called exactly once
    And all individual facet counts are derived from that single queryset
```

## Assignment

Primary owner: Backend Developer
Support agents: Tester (assertNumQueries, count correctness), Reviewer (ORM aggregation review)

## Likely Files Or Areas

- `travels/views.py` (lines 854-953 — facets view and `_build_filtered_queryset_for_facets`)
- `travels/models.py` (through-table relations used by facets)
- `travels/tests/test_views.py` (add `assertNumQueries` test for facets)

## Plan

1. Extract `_build_filtered_queryset_for_facets` so it is called once and its result is
   passed to all per-facet count computations.
2. Evaluate whether all per-facet counts can be expressed as conditional annotations on a
   single annotated queryset:
   ```python
   qs.aggregate(
       count_category_A=Count('categories', filter=Q(categories__id=A), distinct=True),
       count_category_B=Count('categories', filter=Q(categories__id=B), distinct=True),
       ...
   )
   ```
3. If all facets can be aggregated in one query, replace the loop with a single
   `.aggregate()` call.
4. If some facets require separate queries, group them into ≤ 3 batches.
5. Add `assertNumQueries(≤5, ...)` test.
6. Benchmark: compare response time for empty and active-filter cases.

## Validation

```bash
# Query count check (Django shell)
python manage.py shell -c "
from django.test.utils import CaptureQueriesContext
from django.db import connection
from django.test import RequestFactory
# call facets view, print len(queries)
"

# assertNumQueries test
python manage.py test travels.tests.test_views.FacetsQueryCountTestCase -v 2

# Prod timing
curl -o /dev/null -sw "%{time_total}s\n" \
  'https://metravel.by/api/travels/facets/?where={}'
# Target: < 0.15 s (baseline 0.31 s)

curl -o /dev/null -sw "%{time_total}s\n" \
  'https://metravel.by/api/travels/facets/?where={"categories":[1,2]}'
# Should not regress vs. empty-filter timing
```

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-09: Created.

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
