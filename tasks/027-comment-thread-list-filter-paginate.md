# TASK-20260609-027: Restrict TravelCommentThreadViewSet list — require travel_id filter, hide sub-threads, add pagination

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Prevent the comment thread list endpoint from serving an unbounded, unfiltered dump of all
threads (including internal sub-threads) to anonymous clients; require a `travel_id`
filter and enforce pagination.

## Context

`travel_comments/views.py:50-53` defines `TravelCommentThreadViewSet` with:
- `queryset = TravelCommentThread.objects.all()` — no filter at all
- `permission_classes = [AllowAny]` — anonymous access
- Default DRF `list` action with no required filter and no pagination class

Consequences:
1. Any anonymous client can dump the entire `TravelCommentThread` table in one request.
2. Rows with `is_main=False` (internal sub-thread nodes not meant for direct display) leak
   to external consumers.
3. Response size grows unboundedly with the dataset.

The `main_by_travel` custom action already accepts a `travel_id` — this task aligns the
default `list` action with that pattern (or disables it in favour of `main_by_travel`).

**Frontend impact (`../metravel2`):** the frontend should be using `main_by_travel` or a
travel-scoped URL, not the bare `/api/comment-threads/` list. Verify no frontend path hits
the bare list before removing or gating it.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `GET /api/comment-threads/` without a `travel_id` parameter returns `HTTP 400`
  (or an empty paginated result), not a full table dump.
- [ ] `GET /api/comment-threads/?travel_id=<id>` returns only threads where `is_main=True`
  for that travel.
- [ ] Sub-threads (`is_main=False`) are never returned by the list action.
- [ ] The response is paginated (envelope with `count`, `next`, `results`).
- [ ] Anonymous access is preserved for the filtered endpoint (AllowAny is acceptable for
  reading public travel comments).

## Gherkin Tests

```gherkin
Feature: TravelCommentThreadViewSet list is scoped and paginated

  Scenario: List without travel_id is rejected or empty
    Given the database contains 500 TravelCommentThread records across many travels
    When an anonymous client sends GET /api/comment-threads/ with no query parameters
    Then the response status is 400 or the results array is empty
    And no thread records are returned in bulk

  Scenario: List filtered by travel_id returns only main threads for that travel
    Given travel id=7 has 10 main threads (is_main=True) and 5 sub-threads (is_main=False)
    When an anonymous client sends GET /api/comment-threads/?travel_id=7
    Then the response contains exactly 10 thread objects
    And all returned threads have "is_main": true

  Scenario: Sub-threads do not appear in list
    Given travel id=7 has sub-threads with is_main=False
    When a client sends GET /api/comment-threads/?travel_id=7
    Then none of the returned objects have "is_main": false

  Scenario: Response is paginated
    Given travel id=3 has 80 main threads
    When a client sends GET /api/comment-threads/?travel_id=3
    Then the response contains a "next" link and at most 50 results per page
```

## Assignment

Primary owner: Backend developer (metravel-backend repo)
Support agents: Tester (`test-author` — add filter/pagination tests), Reviewer (confirm no frontend path breaks)

## Likely Files Or Areas

- `../metravel-backend/travel_comments/views.py` — `TravelCommentThreadViewSet` (~lines 50-53), override `get_queryset`, add filter and pagination
- `../metravel-backend/travel_comments/filters.py` (create if absent) — `TravelCommentThreadFilter` with required `travel_id`
- `../metravel-backend/travel_comments/tests/` — add list-filter tests
- `../metravel2/api/` — verify frontend does not use bare `/api/comment-threads/` list

## Plan

1. Override `get_queryset` in `TravelCommentThreadViewSet` to filter `is_main=True`.
2. Add `filter_backends = [DjangoFilterBackend]` and require `travel_id` via `filterset_fields` or a custom `filterset_class`. Return 400 if `travel_id` is absent (raise `ValidationError` in `get_queryset` or use a required filter field).
3. Add `pagination_class` (PageNumberPagination, page_size=50) to the viewset.
4. Keep `permission_classes = [AllowAny]` — public read is acceptable after scoping.
5. Audit `main_by_travel` action to confirm it is not redundant after this change.
6. Write tests: no filter → 400, with filter → scoped results, is_main=False absent.

## Validation

```bash
# In metravel-backend repo:

# 1. Bare list — expect 400 or empty
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:8000/api/comment-threads/
# Expected: 400 (or 200 with empty results array)

# 2. Filtered list — only main threads
curl -s "http://localhost:8000/api/comment-threads/?travel_id=1" \
  | python -m json.tool | grep is_main
# Expected: all "is_main": true

# 3. Pagination envelope present
curl -s "http://localhost:8000/api/comment-threads/?travel_id=1" \
  | python -m json.tool | grep -E '"count"|"next"|"results"'
# Expected: paginated envelope

# 4. Sub-threads absent
curl -s "http://localhost:8000/api/comment-threads/?travel_id=1" \
  | python -m json.tool | python3 -c "
import json,sys
data=json.load(sys.stdin)
bad=[r for r in data.get('results',[]) if not r.get('is_main')]
print('sub-threads leaked:', bad)
"
# Expected: sub-threads leaked: []

# 5. Run tests
python manage.py test travel_comments.tests --verbosity=2
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
