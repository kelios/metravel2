# TASK-20260609-019: Wrap travel upsert in transaction.atomic and fix unsafe index access

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Prevent partially-written travel records caused by mid-upsert failures by wrapping the
entire upsert flow in `transaction.atomic()`, and eliminate the `IndexError` / 500 risk
from bare `[0]` list-index access on QuerySets.

## Context

Security review 2026-06-09. `travels/services/upsert_travel_service.py:224-239`
(`process_request`) performs a multi-step write sequence: creates a `Travel`, calls
`users.add()`, sets M2M relations, saves coordinates, and calls `save()` — all outside any
transaction. A failure at any intermediate step leaves the database in an inconsistent
state: a `Travel` row exists but has no owner, no coordinates, or incomplete M2M data.
The incomplete record can then be exposed through public list endpoints.

Additionally, `upsert_travel_service.py:129` and `:145` use `Travel.objects.filter(id=...)[0]`
to retrieve a travel by pk. If the record is deleted between the filter and the access
(race condition), or if the queryset is unexpectedly empty, this raises `IndexError` which
Django converts to an unhandled 500. The correct pattern is `.first()` (returns `None`,
allows a clean 404) or `get_object_or_404`.

The call site is `travels/views.py:799-814`.

No frontend API contract changes — the endpoint shape and status codes on success are
unchanged. On error, the frontend currently receives 500; after the fix it will receive
a proper 4xx or the transaction will roll back cleanly.

Source task:

- Source id:
- Source path: backend security review 2026-06-09

## Acceptance Criteria

- [ ] `process_request` in `upsert_travel_service.py` (and its call path in `views.py`)
      is wrapped in `transaction.atomic()` so that any exception rolls back all changes.
- [ ] No partial `Travel` records are left in the database after a simulated mid-upsert
      failure (e.g., forced exception after `Travel.objects.create()`).
- [ ] `Travel.objects.filter(id=...)[0]` at lines 129 and 145 is replaced with
      `.first()` (followed by a None check and 404) or `get_object_or_404`.
- [ ] A request that triggers the old `IndexError` path now returns HTTP 404, not 500.
- [ ] The happy-path upsert (create and update) continues to return the correct 201/200
      response with the full travel payload.

## Gherkin Tests

```gherkin
Feature: Travel upsert is atomic and safe against race conditions

  Scenario: Mid-upsert failure leaves no partial record
    Given a travel upsert request is in progress
    When an exception is raised after the Travel row is created but before M2M is saved
    Then the transaction is rolled back and no Travel row exists in the database

  Scenario: Missing travel pk returns 404 not 500
    Given a travel id that does not exist in the database
    When the upsert service fetches that id with filter(...)[0]
    Then it returns HTTP 404 instead of raising IndexError / 500

  Scenario: Successful upsert still returns correct response
    Given valid travel creation payload and an authenticated owner
    When the client sends POST /api/travels/
    Then the response status is 201 and the travel record is complete in the database
```

## Assignment

Primary owner: Backend developer — wrap upsert in transaction.atomic(); replace [0] with
.first() + 404 guard.
Support agents: Tester to simulate mid-upsert failure and missing-pk scenario; Reviewer to
check for other unsafe QuerySet[0] patterns in the file.

## Likely Files Or Areas

- `travels/services/upsert_travel_service.py` lines 129, 145, 224-239
- `travels/views.py` lines 799-814 (call site)
- Backend test suite: `travels/tests/` — add atomic rollback and missing-pk tests

## Plan

1. Import `transaction` from `django.db` in `upsert_travel_service.py` (if not already).
2. Wrap the body of `process_request` (lines 224-239 and their sub-calls) in
   `with transaction.atomic():`.
3. Replace `Travel.objects.filter(id=...)[0]` at lines 129 and 145 with
   `Travel.objects.filter(id=...).first()` and raise `Http404` / use `get_object_or_404`
   if the result is `None`.
4. Write a test that patches a downstream save to raise an exception and asserts no
   Travel row was committed.
5. Write a test that calls the endpoint with a non-existent travel id and asserts 404.
6. Run the full test suite; deploy to staging and execute the happy-path create + update.

## Validation

```bash
# Happy-path create (replace TOKEN and payload)
curl -s -o /dev/null -w "%{http_code}" -X POST https://metravel.by/api/travels/ \
  -H "Authorization: Token TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test travel","...":""}'
# Expected: 201

# Non-existent pk — must be 404 not 500
curl -s -o /dev/null -w "%{http_code}" -X PUT \
  https://metravel.by/api/travels/999999999/ \
  -H "Authorization: Token TOKEN" \
  -H "Content-Type: application/json" -d '{}'
# Expected: 404

# Atomicity: check DB after forced mid-upsert failure in staging
# (inject a deliberate exception, confirm Travel count does not increase)
```

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-09: Created from backend security review finding [HIGH].

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
