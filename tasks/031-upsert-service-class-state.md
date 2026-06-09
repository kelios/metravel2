# TASK-20260609-031: Upsert service stores request state in class attributes

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Eliminate the fragile class-level `_travel = None` / `_user = None` attributes in
`UpsertTravelService` so that per-request state cannot leak between requests if the
service instance is ever shared or reused.

## Context

`travels/services/upsert_travel_service.py:18-19` declares `_travel` and `_user` as
class-scope attributes and then mutates them as instance attributes inside
`process_request`. The current call-site (`travels/views.py:805`) instantiates the
service per-request, so there is no active leak today. However the pattern is brittle:
any refactoring that caches the service (DI container, middleware, Celery task reuse)
would silently cross-contaminate travel/user data between requests. The fix is minimal —
move initialisation to `__init__` — but it closes a latent correctness hazard before it
becomes a real incident.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `UpsertTravelService` no longer declares `_travel` or `_user` at class scope.
- [ ] Both attributes are initialised in `__init__` (e.g. `self._travel = None`, `self._user = None`).
- [ ] `process_request` and all helpers that read/write those attributes continue to work correctly.
- [ ] Existing upsert behaviour (create and update paths) is unchanged — no regression in integration tests.
- [ ] If a second instance is created concurrently, its `_travel`/`_user` values are independent of the first.

## Gherkin Tests

```gherkin
Feature: UpsertTravelService instance isolation

  Scenario: Class-level attributes do not exist after fix
    Given the UpsertTravelService class definition
    When the class body is inspected
    Then _travel and _user are not present as class-scope attributes

  Scenario: Two instances carry independent state
    Given two UpsertTravelService instances created for different requests
    When instance A sets _travel to travel_A and instance B sets _travel to travel_B
    Then instance A._travel equals travel_A
    And instance B._travel equals travel_B
    And neither instance reads the other's value

  Scenario: Upsert create path works after refactor
    Given an authenticated user and valid travel payload
    When POST /api/travels/ is called
    Then a new travel is created and 201 is returned
    And no AttributeError or cross-request contamination is logged

  Scenario: Upsert update path works after refactor
    Given an existing travel owned by the authenticated user
    When PUT /api/travels/{id}/ is called with updated fields
    Then the travel is updated and 200 is returned
```

## Assignment

Primary owner: Backend Developer
Support agents: Tester (regression suite for upsert endpoints), Reviewer (code review of service refactor)

## Likely Files Or Areas

- `travels/services/upsert_travel_service.py` (lines 18-19 and `__init__`, `process_request`)
- `travels/views.py` (line 805 — instantiation call-site, verify no shared instance)
- `travels/tests/test_upsert_travel_service.py` (unit tests for the service)

## Plan

1. Open `upsert_travel_service.py`, remove `_travel = None` and `_user = None` from class body.
2. Add `self._travel = None` and `self._user = None` inside `__init__`.
3. Verify all usages of `self._travel` / `self._user` inside the class still resolve correctly.
4. Check `travels/views.py:805` — confirm service is instantiated per-request (no singleton).
5. Run existing unit/integration tests for the upsert flow.
6. Add a unit test that creates two instances and asserts state independence.

## Validation

```bash
# Unit tests for upsert service
python manage.py test travels.tests.test_upsert_travel_service -v 2

# Full travels test suite
python manage.py test travels -v 1

# Confirm no class-level declaration remains
grep -n "^\s*_travel\s*=" travels/services/upsert_travel_service.py
grep -n "^\s*_user\s*=" travels/services/upsert_travel_service.py
# Both greps must return zero results (class-scope gone; only self._travel inside methods is fine)
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
