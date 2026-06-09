# TASK-20260609-043: perPage has no upper bound — any client can dump the full table

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Add `max_page_size = 100` to the shared `Paginator` class so that DRF automatically
caps any `?perPage=` value, preventing clients or bots from extracting the full table
in a single request.

## Context

`metravel/common/view_paginator.py:7-9` defines:

```python
class Paginator(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'perPage'
    # max_page_size is NOT set
```

Because `max_page_size` is absent, DRF places no upper bound on `page_size_query_param`.
Any request with `?perPage=100000` returns every row in the queryset.

This Paginator is used by all paginated list endpoints: travels, search, history,
favorites, articles.

Prod measurements (metravel.by, 2026-06-09):

| Request | Size | Time |
|---|---|---|
| `GET /api/travels/?where={}&perPage=1000` | 3.82 MB | 6.6 s |
| `GET /api/travels/?where={}` (default perPage=20) | 341 KB | 0.8 s |

A single large request is 11× larger and 8× slower than the default. A crawler hitting
all paginated endpoints simultaneously would saturate the DB and gunicorn workers.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `GET /api/travels/?perPage=100000` returns at most `max_page_size` items (100).
- [ ] `GET /api/travels/?perPage=50` returns 50 items (respects value ≤ max).
- [ ] `GET /api/travels/` (no param) returns 20 items (default unchanged).
- [ ] Response body size for `?perPage=100000` is comparable to `?perPage=100`.
- [ ] The same cap applies to all endpoints that use the shared `Paginator` class (articles, history, favorites, search).

## Gherkin Tests

```gherkin
Feature: Paginator enforces maximum page size

  Scenario: Client requests more items than the allowed maximum
    Given the travels endpoint uses the shared Paginator with max_page_size=100
    When a request is made with ?perPage=100000
    Then the response contains at most 100 items
    And the response time is comparable to a normal page request

  Scenario: Client requests a value within the allowed range
    Given the travels endpoint uses the shared Paginator
    When a request is made with ?perPage=50
    Then the response contains exactly 50 items

  Scenario: Client requests without the perPage parameter
    Given the travels endpoint uses the shared Paginator
    When a request is made without any perPage parameter
    Then the response contains the default 20 items
```

## Assignment

Primary owner: Backend Developer
Support agents: Tester (assertNumQueries + size checks), Reviewer (DRF pagination contract review)

## Likely Files Or Areas

- `metravel/common/view_paginator.py` (add `max_page_size = 100`)
- All views that pass this Paginator: `travels/views.py`, `articles/views.py`, any history/favorites viewsets

## Plan

1. Open `metravel/common/view_paginator.py` and add `max_page_size = 100` to the `Paginator` class.
2. Verify no individual viewset overrides `pagination_class` with its own unbounded paginator.
3. Run existing pagination tests; add a test asserting `?perPage=100000` returns ≤ 100 items.
4. Optionally expose the cap value as a Django setting (`PAGINATOR_MAX_PAGE_SIZE`) for easy adjustment.

## Validation

```bash
# Before fix — confirm large response
curl -o /dev/null -sw "%{size_download} bytes  %{time_total}s\n" \
  "https://metravel.by/api/travels/?where={}&perPage=1000"
# Expected current: ~3.82 MB / 6.6 s

# After fix — same URL must return ≤ 100 items
curl -s "https://metravel.by/api/travels/?where={}&perPage=100000" \
  | python -c "import sys,json; d=json.load(sys.stdin); print('count:', len(d['data']))"
# Expected: count: 100

# Default page size unchanged
curl -s "https://metravel.by/api/travels/?where={}" \
  | python -c "import sys,json; d=json.load(sys.stdin); print('count:', len(d['data']))"
# Expected: count: 20

# Unit test
python manage.py test metravel.common.tests.test_paginator -v 2
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
