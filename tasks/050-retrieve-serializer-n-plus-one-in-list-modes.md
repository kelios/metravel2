# TASK-20260609-050: RetrieveTravelSerializer used in list endpoints causes N+1 queries for authenticated users

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Prevent per-item `UserTravelStatus` and `users.count()` queries in the `random` and
`of_month` endpoints by either prefetching statuses or switching to a lighter serializer
for list responses, eliminating the N+1 pattern under authenticated sessions.

## Context

`travels/serializers.py`:

- Lines 219-232: `get_user_status` calls `UserTravelStatus.objects.filter(...).first()` for each serialized travel item.
- Lines 256-257: `total_likes` calls `data.users.count()` for each item.

Both methods are safe in `retrieve` (single object). However `travels/views.py:428-429`
uses `RetrieveTravelSerializer(many=True)` for the `random` and `of_month` list actions.
With N items in the response and an authenticated user this produces:

- N queries for `user_status` (`UserTravelStatus` lookups)
- N queries for `total_likes` (`users.count()`)
- Total: 2N extra queries per list response on top of the base queryset

For `random` (e.g. 10 items) this adds 20 extra queries per request for every
authenticated visitor.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `GET /api/travels/random/` for an authenticated user issues at most 3 total SQL queries (base + 1 prefetch for statuses + 1 for likes), verified via `assertNumQueries`.
- [ ] `GET /api/travels/of_month/` has the same query-count constraint.
- [ ] `user_status` and `total_likes` values in the response are correct (match single-item retrieve behavior).
- [ ] Unauthenticated requests are unaffected.
- [ ] No regression in existing serializer tests.

## Gherkin Tests

```gherkin
Feature: No N+1 queries in random/of_month list endpoints

  Scenario: Authenticated random endpoint does not query per item
    Given an authenticated user
    And the random endpoint returns 10 travels
    When GET /api/travels/random/ is called
    Then at most 3 SQL queries are executed in total
    And each travel item contains a correct user_status field
    And each travel item contains a correct total_likes value

  Scenario: Unauthenticated random endpoint is unaffected
    Given no authenticated user
    When GET /api/travels/random/ is called
    Then the response contains travel items without user_status
    And the query count matches the pre-fix baseline

  Scenario: of_month list has bounded query count
    Given an authenticated user
    When GET /api/travels/of_month/ is called
    Then at most 3 SQL queries are executed
```

## Assignment

Primary owner: Backend Developer
Support agents: Tester (assertNumQueries with authenticated client), Reviewer (prefetch correctness, serializer contract)

## Likely Files Or Areas

- `travels/serializers.py` (lines 219-232 `get_user_status`, lines 256-257 `total_likes`)
- `travels/views.py` (lines 428-429 — random/of_month using `RetrieveTravelSerializer(many=True)`)
- `travels/tests/test_serializers.py` or `test_views.py` (add `assertNumQueries` test)

## Plan

1. In the `random` and `of_month` viewset actions, add `prefetch_related`:
   ```python
   queryset = queryset.prefetch_related(
       Prefetch('usertravelstatus_set',
                queryset=UserTravelStatus.objects.filter(user=request.user),
                to_attr='prefetched_statuses'),
   )
   ```
2. Update `get_user_status` to check `prefetched_statuses` when populated, falling
   back to a DB query only in retrieve mode.
3. For `total_likes`, annotate the queryset with `Count('traveluserdata__users')` and
   read from the annotation in the serializer instead of calling `.count()`.
4. Alternative (simpler): create a `TravelListSerializer` that omits `user_status` /
   replaces `total_likes` with an annotation, and use it for `many=True` actions.
5. Add `assertNumQueries` test with an authenticated `APIClient`.

## Validation

```bash
# assertNumQueries test
python manage.py test travels.tests.test_views.RandomOfMonthQueryCountTestCase -v 2

# Manual check with auth token
curl -s -H "Authorization: Token $TOKEN" \
  https://metravel.by/api/travels/random/ \
  | python -c "import sys,json; d=json.load(sys.stdin); print(len(d), 'items')"

# Django shell query count
python manage.py shell -c "
from django.test.utils import CaptureQueriesContext
from django.db import connection
from django.test import RequestFactory
# simulate authenticated random request, print len(queries)
"
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
