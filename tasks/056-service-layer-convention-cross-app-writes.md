# TASK-20260609-056: Establish service-layer convention and eliminate cross-app writes in views

Status: Backlog
Owner: Backend
Support: Developer (BE), Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Define and enforce a consistent service-layer convention for business logic, and move all cross-app model mutations (e.g. `users/views.py` writing to `travels` models) into service classes owned by the target app.

## Context

The service layer is heterogeneous across apps:

- `travels/services/` — proper service classes
- `users/services/history_service.py` — standalone service function
- `maintenance/services/settings_service.py` — singleton pattern
- `articles`, `travel_comments`, `messaging`, `quests`, `user_points` — logic lives directly in views

Fat views: `users/views.py` (988 lines), `maintenance/views.py` (581 lines), `travel_comments/views.py` (406 lines), `messaging/views.py` (324 lines).

Cross-app problem: `users/views.py:27` imports and writes to `travels.Travel`, `travels.TravelCountry`, `travels.TravelCategory`. Domain encapsulation is violated — `users` should not mutate `travels` data directly; such mutations should go through a service in the `travels` app.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] A documented service-layer convention exists (`docs/BACKEND_CONVENTIONS.md` or equivalent) specifying: where business logic lives, what a "thin view" means, service class vs function preference.
- [ ] `users/views.py` contains no direct writes to `travels` models; those mutations are delegated to a `travels` service.
- [ ] At least the largest fat views (`users/views.py`, `travel_comments/views.py`) have their business logic extracted to service classes/functions.
- [ ] Existing behavior (API responses, side effects) is unchanged — verified by tests passing.
- [ ] No new cross-app model mutations are introduced in views.

## Gherkin Tests

```gherkin
Feature: Cross-app writes go through target-app services

  Scenario: users view delegates travel mutation to travels service
    Given a user action triggers a write to a travels model
    When the users view handler processes the request
    Then the write is performed by calling a function in travels/services/
    And users/views.py contains no direct ORM call to a travels model

  Scenario: Service convention is documented
    Given a developer looks up where to put new business logic
    When they open BACKEND_CONVENTIONS.md
    Then they find a clear rule distinguishing views from services with an example

  Scenario: Behavior unchanged after extraction
    Given an existing API endpoint backed by a fat view
    When the business logic is moved to a service
    Then the endpoint returns the same response shape and status codes
    And all related tests pass
```

## Assignment

Primary owner: Backend developer
Support agents: Tester (regression on extracted logic), Reviewer (convention doc + import graph), Releaser

## Likely Files Or Areas

- `users/views.py` (988 lines, cross-app imports at line 27)
- `travel_comments/views.py` (406 lines)
- `messaging/views.py` (324 lines)
- `travels/services/` — add new service methods here for cross-app mutations
- `users/services/` — refactor history_service to match convention
- New file: `docs/BACKEND_CONVENTIONS.md`
- `articles/views.py`, `quests/views.py`, `user_points/views.py` (for future extraction)

## Plan

1. Draft `docs/BACKEND_CONVENTIONS.md`: thin views call services; services own domain logic; cross-app mutations routed through target-app service; no ORM calls in views beyond simple queries.
2. Identify all `travels.*` imports in `users/views.py`; create corresponding methods in `travels/services/`.
3. Replace direct travel model writes in `users/views.py` with calls to the new service methods.
4. Extract business logic from `travel_comments/views.py` into `travel_comments/services.py`.
5. Extract business logic from `messaging/views.py` into `messaging/services.py`.
6. Run full test suite; fix regressions.
7. Add lint/import guard or code review note to prevent future cross-app view writes.

## Validation

```bash
# No travels model imports in users/views.py after refactor
grep -n "from travels\|import travels" users/views.py

# Line count of fat views should decrease
wc -l users/views.py travel_comments/views.py messaging/views.py

# Full test suite
pytest tests/ -x -q

# Spot-check an affected endpoint
curl -s -H "Authorization: Token <token>" https://metravel.by/api/users/<id>/ | jq .
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
