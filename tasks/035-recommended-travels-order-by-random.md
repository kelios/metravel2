# TASK-20260609-035: recommended_travels uses ORDER BY random() full-table sort

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Replace `queryset.order_by('?')[:6]` in `recommended_travels` with the efficient
random-id sampling pattern already used in `TravelViewSet.random`, eliminating a
full-table sort on every request.

## Context

`users/views.py:733` calls `queryset.order_by('?')[:6]`. In PostgreSQL `ORDER BY
random()` materialises the full qualifying result set, assigns a random float to every
row, sorts the entire set, then discards all but 6 rows. On a table of thousands of
travels this is a sequential scan + sort on every recommendation request.

`TravelViewSet.random` (`travels/views.py:1186-1219`) already solves this by fetching
random PKs in Python (`random.sample(id_list, k=6)`) then doing a single
`filter(pk__in=...)` lookup. The same approach should be applied to
`recommended_travels`.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `recommended_travels` no longer calls `.order_by('?')`.
- [ ] The endpoint returns up to 6 travel records selected at random.
- [ ] The implementation uses random PK sampling (or equivalent) rather than database-side `ORDER BY random()`.
- [ ] `EXPLAIN ANALYZE` on the new query shows no full sequential scan for the random selection step.
- [ ] Response shape and field set remain unchanged.

## Gherkin Tests

```gherkin
Feature: Efficient random travel recommendations

  Scenario: Recommended travels are returned without full-table sort
    Given a database with 500 published travels
    When GET /api/users/{id}/recommended-travels/ is called
    Then the response status is 200
    And up to 6 travels are returned
    And the SQL log does not contain "ORDER BY random()"

  Scenario: Results differ across calls (randomness preserved)
    Given a database with at least 10 published travels
    When GET /api/users/{id}/recommended-travels/ is called twice
    Then the two response bodies are not always identical

  Scenario: Fewer than 6 travels available
    Given only 3 published travels exist in the database
    When GET /api/users/{id}/recommended-travels/ is called
    Then the response contains those 3 travels
    And no error is raised
```

## Assignment

Primary owner: Backend Developer
Support agents: Tester (performance assertion, response shape), Reviewer (ORM review)

## Likely Files Or Areas

- `users/views.py` (line 733 — `order_by('?')` call)
- `travels/views.py` (lines 1186-1219 — reference implementation of random PK sampling)
- `users/tests/test_views.py` (add SQL assertion or mock test for the new approach)

## Plan

1. In `users/views.py:733` replace `queryset.order_by('?')[:6]` with:
   - Fetch all qualifying PKs: `ids = list(queryset.values_list('pk', flat=True))`.
   - Sample up to 6: `sample = random.sample(ids, min(6, len(ids)))`.
   - Fetch records: `queryset.filter(pk__in=sample)`.
2. Mirror the exact pattern from `TravelViewSet.random` for consistency.
3. Add a unit test that patches the queryset and asserts `.order_by('?')` is never called.
4. Run `python manage.py test users` and confirm green.

## Validation

```bash
# Verify ORDER BY random() is gone from users/views.py
grep -n "order_by.*\?" users/views.py
# Should return no results (or only unrelated occurrences)

# Run the test suite
python manage.py test users -v 2

# Manual check: call endpoint, confirm 6 results
curl -s https://metravel.by/api/users/1/recommended-travels/ \
  -H "Authorization: Token $TOKEN" | python -m json.tool | grep '"id"' | wc -l
# Expected: <= 6

# EXPLAIN ANALYZE (psql) — confirm no Seq Scan for random step
# EXPLAIN ANALYZE SELECT * FROM travels_travel WHERE id IN (1,2,3,4,5,6);
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
