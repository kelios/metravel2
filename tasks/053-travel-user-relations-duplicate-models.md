# TASK-20260609-053: Consolidate duplicate travel-user relation models

Status: Backlog
Owner: Backend
Support: Developer (BE), Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Eliminate the dual source-of-truth for travel-user relations (favourites, saves, views) that exist in parallel across the `users` and `travels` apps, and establish one canonical model per semantic concept.

## Context

Two apps define overlapping travel-user links:

- `users/models.py:81` — `FavoriteTravel`
- `users/models.py:94` — `UserTravelStatus`
- `users/models.py:126` — `UserViewsHistory`
- `travels/models.py:151` — `TravelLike`
- `travels/models.py:192` — `TravelSave`
- `travels/models.py:268` — `TravelView`

`FavoriteTravel` (users) and `TravelSave` (travels) are semantically equivalent "saved/bookmarked" entries. Counter fields in `Travel` may be incremented by either path. The frontend may be calling both, leading to silent desync of counts and user-state queries.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] Each semantic concept (like, save/favourite, view) is backed by exactly one model and one DB table.
- [ ] The redundant model is removed (or clearly tombstoned with a migration).
- [ ] A data migration transfers all rows from the deprecated model to the canonical one before the table is dropped.
- [ ] Counter fields on `Travel` reflect only the canonical model.
- [ ] The frontend API contract is verified: the endpoint(s) consumed by `metravel2` return the same fields/semantics after the change.
- [ ] No frontend code in `metravel2` calls a now-removed endpoint or model-backed path.
- [ ] Existing tests pass; new tests assert the consolidated path is used.

## Gherkin Tests

```gherkin
Feature: Single source of truth for travel-user relations

  Scenario: Saving a travel increments counter exactly once
    Given a user is authenticated
    And a travel exists with save_count = 0
    When the user calls the canonical "save travel" endpoint
    Then the travel's save_count becomes 1
    And no secondary model records a duplicate save entry

  Scenario: Fetching saved travels returns a consistent list
    Given a user has previously saved 3 travels via the canonical endpoint
    When the user requests their saved travels list
    Then exactly 3 travels are returned
    And the list is not affected by rows in any deprecated model

  Scenario: Data migration preserves existing saves
    Given rows exist in both the deprecated and canonical model before migration
    When the data migration runs
    Then the canonical model contains the union of unique user-travel pairs
    And the deprecated table is empty (or dropped)
```

## Assignment

Primary owner: Backend developer
Support agents: Tester (regression on save/like/view counts), Reviewer (migration safety), Frontend Developer (verify metravel2 API contract unchanged)

## Likely Files Or Areas

- `users/models.py` (lines 81, 94, 126 — FavoriteTravel, UserTravelStatus, UserViewsHistory)
- `travels/models.py` (lines 151, 192, 268 — TravelLike, TravelSave, TravelView)
- `users/views.py` — endpoints that write to users-side models
- `travels/views.py` / `travels/services/` — endpoints that write to travels-side models
- `users/serializers.py`, `travels/serializers.py`
- Data migration file (new): `travels/migrations/XXXX_consolidate_travel_user_relations.py`
- Frontend contract reference: `api/` directory in `metravel2` repo

## Plan

1. Audit all read/write usages of `FavoriteTravel`, `UserTravelStatus`, `UserViewsHistory`, `TravelLike`, `TravelSave`, `TravelView` across views, serializers, and services.
2. Decide canonical location for each concept (recommended: `travels` app owns all travel-user links).
3. Write a data migration that copies rows from deprecated models to canonical ones, deduplicating on (user, travel) pairs.
4. Update all views/services to use only canonical models; remove writes to deprecated models.
5. Remove deprecated model classes and create a schema migration to drop the tables.
6. Update counter fields (`save_count`, `view_count`, etc.) to reference only canonical models.
7. Verify frontend API endpoints return identical response shapes.
8. Update or add tests covering save, like, view flows end-to-end.

## Validation

```bash
# Run full test suite after migration
cd metravel-backend && python manage.py test

# Verify migration applies cleanly
python manage.py migrate --run-syncdb

# Check no references to deprecated model names remain
grep -r "FavoriteTravel\|UserTravelStatus" --include="*.py" . | grep -v migrations | grep -v "^Binary"

# Spot-check API contract from metravel2 side
curl -s -H "Authorization: Token <token>" https://metravel.by/api/travels/?format=json | jq '.results[0] | {id, save_count, like_count}'
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
