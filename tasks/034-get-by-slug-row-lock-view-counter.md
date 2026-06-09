# TASK-20260609-034: get_by_slug takes row-lock and writes to DB on every GET request

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Replace the `select_for_update()` + `travel.save()` pattern used to increment the
`travel_viewed` counter with an atomic `F`-expression update so that every GET request no
longer acquires a row-level lock or triggers a blocking `save()`.

## Context

`travels/views.py:1348-1375` increments `travel_viewed` by fetching the row with
`select_for_update()` and then calling `travel.save()`. Under moderate bot traffic or
concurrent readers of a popular travel entry this causes row-lock contention: each GET
queues behind the previous one waiting for the lock. A `save()` on the full model
instance also writes every field, dirtying the row and generating unnecessary WAL in
PostgreSQL.

A Redis-buffered `save_view` helper is already stubbed in
`metravel/cache/cache_utils.py:38` but not yet wired in. The minimal correct fix is an
atomic `Travel.objects.filter(pk=pk).update(travel_viewed=F('travel_viewed') + 1)`.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `get_by_slug` does not call `select_for_update()` to increment the view counter.
- [ ] The view counter is incremented with `update(travel_viewed=F('travel_viewed') + 1)` (atomic, no lock).
- [ ] `travel.save()` is not called for the sole purpose of incrementing the counter.
- [ ] Under concurrent load (e.g. 50 simultaneous GETs of the same slug) no deadlock or lock-wait timeout occurs.
- [ ] `travel_viewed` count reflects the correct number of views after N concurrent requests.
- [ ] If `save_view` in `cache_utils.py` is wired up instead, it must be covered by its own test.

## Gherkin Tests

```gherkin
Feature: Travel view counter increment without row-lock

  Scenario: Concurrent GETs do not produce lock contention
    Given a travel entry with slug "my-travel" and travel_viewed = 0
    When 50 simultaneous GET /api/travels/my-travel/ requests are made
    Then all 50 requests return 200
    And no database deadlock or timeout error is raised
    And travel_viewed equals 50 (or close, within buffering tolerance)

  Scenario: Single GET increments counter atomically
    Given a travel entry with travel_viewed = 10
    When GET /api/travels/{slug}/ is called once
    Then travel_viewed becomes 11
    And no select_for_update SQL is executed during the request

  Scenario: GET does not execute a full model save
    Given a travel entry
    When GET /api/travels/{slug}/ is called
    Then the SQL log contains UPDATE with only travel_viewed column
    And does not contain UPDATE with all travel columns
```

## Assignment

Primary owner: Backend Developer
Support agents: Tester (concurrency test), Reviewer (ORM / DB review)

## Likely Files Or Areas

- `travels/views.py` (lines 1348-1375 — `get_by_slug` action)
- `metravel/cache/cache_utils.py` (line 38 — `save_view` stub, optional wiring)
- `travels/models.py` (Travel model — `travel_viewed` field)
- `travels/tests/test_views.py` (add concurrency / atomic increment test)

## Plan

1. In `travels/views.py:1348-1375` remove `select_for_update()` from the queryset used for view-count increment.
2. Replace `travel.save()` with `Travel.objects.filter(pk=travel.pk).update(travel_viewed=F('travel_viewed') + 1)`.
3. Add `from django.db.models import F` import if not present.
4. Optionally: wire `cache_utils.save_view` if Redis buffering is preferred; document the choice.
5. Write a test that calls the endpoint N times and asserts `travel_viewed == N`.
6. Run `python manage.py test travels` to confirm no regression.

## Validation

```bash
# Check no select_for_update in the slug view — grep after change
grep -n "select_for_update" travels/views.py
# Should not appear in get_by_slug context

# Functional test: call endpoint and verify counter increments
python manage.py test travels.tests.test_views.TravelViewCountTestCase -v 2

# Concurrency stress (adjust token/slug)
seq 1 20 | xargs -P 20 -I{} curl -s -o /dev/null -w "%{http_code}\n" \
  https://metravel.by/api/travels/some-slug/
# All should return 200
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
