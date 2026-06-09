# TASK-20260609-039: build_engagement_payload runs multiple expensive distinct queries

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Replace the three separate `distinct()` queries with Python set-intersection in
`build_engagement_payload` with a single aggregated queryset so that the payload is
computed in one database round-trip and scales acceptably for authors with large travel
catalogues.

## Context

`travels/views.py:262-331` computes the engagement payload (favorites, wishlist, planned
counts for a user/travel set) using three separate queries each with
`.exclude(user__traveluser__travel_id=F(...))` and Python-side set operations. On an
author with hundreds of travels this means three sequential DB queries, each potentially
scanning a large intersection, followed by Python aggregation of those result sets. The
result is not cached.

The reference pattern for this kind of aggregation in the codebase is Django's
`annotate()` / `Count()` with conditional expressions — a single query that returns all
three counts per travel. Adding a short-lived cache (Django cache framework or Redis)
would further protect against repeated identical calls for the same author page.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `build_engagement_payload` issues at most one SQL query per invocation (verified via `django.test.utils.CaptureQueriesContext` or `assertNumQueries`).
- [ ] The payload values (favorites, wishlist, planned counts) match the previous three-query implementation for the same data set.
- [ ] Response time for an author with 200 travels is measurably lower than before the change (benchmark documented in Validation evidence).
- [ ] The result is optionally cached for a short TTL (e.g. 60 s) to protect against repeated identical requests.
- [ ] Existing engagement payload tests pass without modification to expected values.

## Gherkin Tests

```gherkin
Feature: Efficient engagement payload computation

  Scenario: Payload computed in a single DB query
    Given an author with 200 published travels
    When the engagement payload is requested for that author
    Then exactly one SQL query is executed
    And the payload contains correct favorites, wishlist and planned counts

  Scenario: Payload values match legacy implementation
    Given a known dataset with 5 travels and specific favorites/wishlist/planned entries
    When build_engagement_payload is called
    Then the returned counts match the expected values
    And no Python-side set manipulation is required

  Scenario: Cached payload is returned on second call
    Given the payload was computed and cached 30 seconds ago
    When the payload is requested again for the same author
    Then no SQL query is executed (cache hit)
    And the returned payload is identical to the first call
```

## Assignment

Primary owner: Backend Developer
Support agents: Tester (assertNumQueries test, benchmark), Reviewer (ORM annotation review)

## Likely Files Or Areas

- `travels/views.py` (lines 262-331 — `build_engagement_payload`)
- `travels/models.py` (Travel, TravelUser, favorites/wishlist/planned relations)
- `metravel/cache/cache_utils.py` (cache integration if buffering is added)
- `travels/tests/test_views.py` (add `assertNumQueries` assertion)

## Plan

1. Analyse the three existing queries to understand the exact join/filter logic.
2. Rewrite as a single annotated queryset:
   ```python
   from django.db.models import Count, Q
   queryset.annotate(
       fav_count=Count('favorited_by', filter=Q(...), distinct=True),
       wish_count=Count('wishlisted_by', filter=Q(...), distinct=True),
       planned_count=Count('planned_by', filter=Q(...), distinct=True),
   )
   ```
3. Adjust payload assembly to read from annotation fields.
4. Optionally wrap the result in a short-TTL cache keyed by `(author_id, request_user_id)`.
5. Add `assertNumQueries(1, ...)` test.
6. Benchmark: compare response time for author with 200 travels before/after.

## Validation

```bash
# Run assertion test
python manage.py test travels.tests.test_views.EngagementPayloadQueryCountTestCase -v 2

# Django shell quick benchmark
python manage.py shell -c "
import time
from django.test.utils import CaptureQueriesContext
from django.db import connection
# ... call build_engagement_payload, time it, print len(queries)
"

# Load test endpoint (adjust token/user-id)
ab -n 100 -c 10 -H 'Authorization: Token $TOKEN' \
  https://metravel.by/api/travels/?author=1
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
