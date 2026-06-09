# TASK-20260609-040: user_rating action exposes any user's personal rating without auth (IDOR)

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Restrict the `travel/{id}/rating/users/{user_id}/` endpoint so that a personal rating
is not accessible to unauthenticated callers or to users other than the rating owner,
eliminating the IDOR pattern.

## Context

`travels/views.py:978-988` exposes a public action `rating` that returns the rating
record for any `user_id` passed in the URL without requiring authentication or ownership
check. Any anonymous caller can enumerate `user_id` values and read another user's
personal travel rating. The sensitivity is relatively low (a numeric score), but it
establishes an IDOR pattern that may be escalated if the endpoint is extended.

The two appropriate fixes are:
1. **Auth + self-only**: require `IsAuthenticated` and assert `request.user.id == user_id`
   (or `IsSelf` permission), returning 403 otherwise.
2. **Aggregate only**: remove the user-specific path entirely and only expose aggregate
   rating stats (mean, count) which carry no personal information.

Source task:

- Source id:   TASK-016
- Source path: tasks/016-idor-user-history-favorites.md

## Acceptance Criteria

- [ ] `GET /api/travels/{id}/rating/users/{user_id}/` returns 401 for unauthenticated requests.
- [ ] An authenticated user requesting another user's rating receives 403 (or the endpoint is removed in favour of aggregate-only).
- [ ] An authenticated user can still retrieve their own rating for a travel.
- [ ] Aggregate rating stats (mean, count) remain publicly accessible if the product requires it.
- [ ] No other rating-related endpoint leaks individual user rating values without auth.

## Gherkin Tests

```gherkin
Feature: Personal travel rating access control

  Scenario: Anonymous user cannot read another user's rating
    Given travel with id 42 exists
    And user 7 has rated travel 42
    When an unauthenticated GET /api/travels/42/rating/users/7/ is made
    Then the response status is 401

  Scenario: Authenticated user cannot read a different user's rating
    Given user A (id=1) and user B (id=2) both exist
    And user B has rated travel 42
    When user A calls GET /api/travels/42/rating/users/2/
    Then the response status is 403

  Scenario: Authenticated user can read their own rating
    Given user A (id=1) has rated travel 42 with score 4
    When user A calls GET /api/travels/42/rating/users/1/
    Then the response status is 200
    And the response body contains score 4

  Scenario: Aggregate rating is still public
    Given travel 42 has been rated by multiple users
    When an unauthenticated GET /api/travels/42/ is made
    Then the response contains average_rating and rating_count
    And no individual user rating is disclosed
```

## Assignment

Primary owner: Backend Developer
Support agents: Tester (auth/IDOR test cases), Reviewer (security review)

## Likely Files Or Areas

- `travels/views.py` (lines 978-988 — `user_rating` action, permission_classes)
- `travels/serializers.py` (rating serializer — verify no additional disclosure)
- `travels/tests/test_views.py` (add auth and ownership test cases)

## Plan

1. Add `permission_classes = [IsAuthenticated]` to the `user_rating` action (or the enclosing ViewSet with per-action override).
2. Inside the action, assert `request.user.id == int(user_id)` and return 403 if not equal.
3. Alternatively, redirect aggregate-only callers to the travel detail endpoint (which has aggregate stats).
4. Write tests: anonymous → 401, authenticated other user → 403, authenticated owner → 200.
5. Run `python manage.py test travels` and confirm green.

## Validation

```bash
# Anonymous access — must return 401
curl -s -o /dev/null -w "%{http_code}" \
  https://metravel.by/api/travels/1/rating/users/2/
# Expected: 401

# Authenticated as user 1, accessing user 2's rating — must return 403
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Token $USER1_TOKEN" \
  https://metravel.by/api/travels/1/rating/users/2/
# Expected: 403

# Authenticated user accessing own rating — must return 200
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Token $USER1_TOKEN" \
  https://metravel.by/api/travels/1/rating/users/1/
# Expected: 200

# Unit tests
python manage.py test travels.tests.test_views -k rating -v 2
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
