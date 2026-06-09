# TASK-20260609-042: Dead defer() on m2m, heavy points serialization in list, delete_account race

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Remove dead `defer()` calls on ManyToMany fields, stop serializing all travel address
points in list responses, and optionally add `select_for_update` to `delete_account` —
reducing payload size and eliminating misleading code without changing the API contract
for downstream callers.

## Context

Three independent low-severity issues are batched here:

**(a) Dead defer() on ManyToMany fields.**
`travels/views.py:406-417` and `474-483` call
`defer('over_nights_stay','transports','complexity','categories')`.
All four fields are ManyToMany in `travels/models.py:309-318`. Django's `defer()` has no
effect on M2M fields — it only defers regular column reads. The code misleads reviewers
into thinking those fields are deferred, wastes maintenance attention, and may mask
missing prefetch_related calls that would actually help performance.

**(b) Points serialized in list cards.**
`travels/serializers.py:95-99` — `get_points` iterates all `travel_address` objects for
each travel in a list response. A list of 20 travels each with 10 waypoints sends 200
address objects unnecessarily. The map view that needs points should use a dedicated
lightweight serializer or a separate endpoint. The list card needs only the count (or
nothing).

**(c) Theoretical race in delete_account.**
`users/views.py:525-540` — `delete_account` removes the user without `select_for_update`.
A concurrent request adding the user as a co-author on a travel could produce a
dangling FK or a silent no-op depending on DB FK enforcement. Risk is very low but the
fix (add `select_for_update`) is trivial.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `defer('over_nights_stay','transports','complexity','categories')` calls are removed from `travels/views.py:406-417` and `474-483`.
- [ ] M2M fields that genuinely need prefetching have explicit `prefetch_related()` calls (or no change if already covered).
- [ ] Travel list responses no longer include the full `points` / `travel_address` array by default; a separate lightweight list serializer or a `fields=` mechanism is used.
- [ ] The travel detail endpoint continues to return full points data.
- [ ] `delete_account` wraps its user fetch in `select_for_update()` (or is documented as deliberately not doing so with rationale).
- [ ] All existing travel list and detail endpoint tests pass without payload regressions.

## Gherkin Tests

```gherkin
Feature: Remove dead defer and reduce list payload

  Scenario: defer() on M2M fields is absent from views
    Given the refactored travels/views.py
    When the source code is inspected for defer calls
    Then no defer() call references over_nights_stay, transports, complexity, or categories

  Scenario: Travel list response does not include points
    Given travels exist with multiple waypoints each
    When GET /api/travels/ is called (list endpoint)
    Then the response does not contain a "points" array for each travel card
    And response payload size is measurably smaller than before

  Scenario: Travel detail response still includes points
    Given a travel with 5 waypoints
    When GET /api/travels/{slug}/ is called (detail endpoint)
    Then the response contains the full "points" array with all 5 waypoints

  Scenario: delete_account is protected from concurrent co-author assignment
    Given user A is being deleted
    When a concurrent request attempts to add user A as co-author
    Then the delete completes without FK error or silent corruption
    And no dangling FK reference to user A remains
```

## Assignment

Primary owner: Backend Developer
Support agents: Tester (list payload size assertion, detail regression), Reviewer (ORM and serializer review)

## Likely Files Or Areas

- `travels/views.py` (lines 406-417, 474-483 — `defer()` to remove; check `prefetch_related`)
- `travels/serializers.py` (lines 95-99 — `get_points`; create or split lightweight list serializer)
- `users/views.py` (lines 525-540 — `delete_account`, add `select_for_update`)
- `travels/tests/test_views.py` (add list payload size / field presence assertions)

## Plan

1. **defer cleanup**: In `travels/views.py:406-417` and `474-483`, delete the `defer(...)` calls.
   Verify the queryset still has `prefetch_related` for M2M fields where needed; add if missing.
2. **Points in list**: Create `TravelListCardSerializer` (or add `exclude_points=True` flag)
   that omits the `get_points` method. Use this serializer in the list action.
   Keep the full `TravelSerializer` for the detail endpoint.
3. **delete_account race**: In `users/views.py:525-540`, fetch the user with
   `User.objects.select_for_update().get(pk=request.user.pk)` inside the existing
   `@transaction.atomic` block (add `atomic` if not present).
4. Write tests:
   - List response must not contain `points` key.
   - Detail response must contain `points` key.
   - `defer` calls absent (grep in test or static check).
5. Run `python manage.py test travels users -v 1`.

## Validation

```bash
# Confirm defer calls removed
grep -n "defer.*over_nights_stay\|defer.*transports\|defer.*complexity\|defer.*categories" \
  travels/views.py
# Expected: no output

# List endpoint — no points field
curl -s https://metravel.by/api/travels/ | python -m json.tool | grep '"points"'
# Expected: no output (points absent from list cards)

# Detail endpoint — points present
curl -s https://metravel.by/api/travels/1/ | python -m json.tool | grep '"points"'
# Expected: output (points present in detail)

# Run test suite
python manage.py test travels users -v 2
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
