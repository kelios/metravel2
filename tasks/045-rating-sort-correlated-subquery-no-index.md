# TASK-20260609-045: Rating sort uses correlated Avg subquery with no index on TravelRating

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Eliminate the correlated `Avg` subquery issued per row when sorting travels by rating, by
adding an index on `(travel_id, rating)` in `TravelRating` and/or caching the average
rating as a denormalized field, so that `sort=rating_desc` performs an indexed aggregation
rather than a per-row subquery.

## Context

`travels/views.py:163-174` (`_annotate_rating_for_sort`) annotates each Travel row with:

```python
avg_rating=Avg(
    'travelrating__rating',
    filter=Q(travelrating__travel_id=OuterRef('pk'))  # correlated
)
```

This produces one `AVG(...)` subquery per row in the outer queryset. `TravelRating` has
only a unique constraint on `(user, travel)`; there is no index on `(travel_id, rating)`
that would allow the DB to compute the average via an index scan.

Prod measurement (2026-06-09):

| Endpoint | Time |
|---|---|
| `GET /api/travels/?sort=rating_desc` | 1.0 s |
| `GET /api/travels/` (default) | 0.8 s |

20 % overhead today; grows O(n) with the number of ratings rows.

Two viable fixes:
1. **Index only** — `Index(fields=['travel', 'rating'])` on `TravelRating`. PostgreSQL can
   then satisfy the aggregate with an index-only scan. Simpler, no schema change to Travel.
2. **Denormalized field** — add `avg_rating` + `rating_count` to Travel, update on
   TravelRating save/delete. Eliminates the join entirely; preferred if rating sort is
   called frequently.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `EXPLAIN (ANALYZE)` for `sort=rating_desc` does not show a correlated subquery evaluated per row (no `SubPlan` or `InitPlan` looping over outer rows).
- [ ] `GET /api/travels/?sort=rating_desc` response time is ≤ 0.5 s on prod (down from 1.0 s baseline).
- [ ] If denormalization is chosen: `avg_rating` on Travel is updated atomically when a TravelRating is created, updated, or deleted.
- [ ] Existing rating-related tests pass; a new `assertNumQueries` test is added for the sort path.

## Gherkin Tests

```gherkin
Feature: Efficient rating-based sort

  Scenario: Rating sort does not issue a subquery per row
    Given 500 published travels each with at least one TravelRating
    When a query annotates travels with avg_rating for ordering
    Then the EXPLAIN plan contains no per-row SubPlan for rating aggregation
    And the annotation is computed in a single aggregation pass

  Scenario: Rating sort endpoint responds within target time
    Given the TravelRating index or denormalized field is in place
    When GET /api/travels/?sort=rating_desc is called
    Then the response arrives in under 0.5 s

  Scenario: Denormalized avg_rating stays consistent
    Given a Travel has 3 ratings averaging 4.0
    When a fourth rating of 2.0 is added
    Then Travel.avg_rating equals 3.5 without a manual recalculation
```

## Assignment

Primary owner: Backend Developer
Support agents: Tester (assertNumQueries, EXPLAIN assertion), Reviewer (ORM annotation + migration review)

## Likely Files Or Areas

- `travels/views.py` (lines 163-174 — `_annotate_rating_for_sort`)
- `travels/models.py` (TravelRating model — add index; optionally Travel — add avg_rating field)
- New migration under `travels/migrations/`
- `travels/tests/` (add query-count test for rating sort)

## Plan

1. Decide approach: index-only vs. denormalized field (recommend index-only as lower-risk first step).
2. **Index-only path:**
   a. Add `models.Index(fields=['travel', 'rating'], name='travelrating_travel_rating_idx')` to `TravelRating.Meta`.
   b. Generate and apply migration.
   c. Verify EXPLAIN no longer shows SubPlan loop.
3. **Denormalized path (if chosen):**
   a. Add `avg_rating = models.FloatField(null=True)` and `rating_count = models.PositiveIntegerField(default=0)` to `Travel`.
   b. Override `TravelRating.save()` / `delete()` or use `post_save`/`post_delete` signal to recompute.
   c. Backfill with a data migration.
   d. Replace `_annotate_rating_for_sort` with direct `order_by('-avg_rating')`.
4. Add `assertNumQueries` test.
5. Record prod query time after deploy.

## Validation

```bash
# EXPLAIN before fix (look for SubPlan in output)
python manage.py shell -c "
from django.db import connection
with connection.cursor() as c:
    c.execute(\"\"\"
        EXPLAIN (ANALYZE, FORMAT TEXT)
        SELECT t.id, AVG(r.rating) AS avg_rating
        FROM travels_travel t
        LEFT JOIN travels_travelrating r ON r.travel_id = t.id
        WHERE t.publish = true AND t.moderation = true
        GROUP BY t.id
        ORDER BY avg_rating DESC NULLS LAST
        LIMIT 20
    \"\"\")
    for row in c.fetchall(): print(row[0])
"

# Unit test
python manage.py test travels.tests.test_views.RatingSortQueryCountTestCase -v 2

# Prod timing after fix
curl -o /dev/null -sw "%{time_total}s\n" \
  "https://metravel.by/api/travels/?sort=rating_desc"
# Target: ≤ 0.50 s (baseline 1.0 s)
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
