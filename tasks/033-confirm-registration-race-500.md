# TASK-20260609-033: confirm_registration and reset_password_link return 500 on race condition

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Replace bare `.get()` calls in the registration confirmation and password-reset link views
with proper 404/400 handling so that a missing or duplicate token/email results in a 4xx
response instead of an unhandled 500.

## Context

`users/views.py:647` executes `User.objects.get(account_activation_token=...)` and
`:596` executes `User.objects.get(email=email)` without catching `DoesNotExist` or
`MultipleObjectsReturned`. Between the time a serializer validates the input and the time
the view calls `.get()`, the record can be deleted (e.g. admin cleanup, concurrent
re-registration) or duplicated (rare data-integrity gap). Either exception propagates
uncaught, producing a 500 response visible to the client and an error spike in Sentry.

The fix is straightforward: use `get_object_or_404`, or `.filter().first()` with an
explicit `if not user: return Response(400)` branch.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] Calling the confirm-registration endpoint with a non-existent token returns 404 (or 400), not 500.
- [ ] Calling the password-reset-link endpoint with a non-existent email returns 404 (or 400), not 500.
- [ ] No `DoesNotExist` or `MultipleObjectsReturned` exception reaches the Django error handler for these endpoints.
- [ ] Happy-path flows (valid token / valid email) continue to work correctly.
- [ ] Sentry/logs show no unhandled ORM exceptions from these two views during load testing with invalid inputs.

## Gherkin Tests

```gherkin
Feature: Safe user lookup in auth flows

  Scenario: Confirm registration with unknown token
    Given no user exists with the provided activation token
    When POST /api/users/confirm-registration/ is called with that token
    Then the response status is 400 or 404
    And the response body contains an error message
    And no 500 error is logged

  Scenario: Confirm registration with valid token
    Given a user exists with account_activation_token = "abc123"
    When POST /api/users/confirm-registration/ is called with token "abc123"
    Then the response status is 200
    And the user account is activated

  Scenario: Request password reset link for unknown email
    Given no user is registered with "ghost@example.com"
    When POST /api/users/reset-password-link/ is called with that email
    Then the response status is 400 or 404
    And no 500 error is logged

  Scenario: Request password reset link for valid email
    Given a user is registered with "user@example.com"
    When POST /api/users/reset-password-link/ is called with that email
    Then the response status is 200
    And a reset email is sent
```

## Assignment

Primary owner: Backend Developer
Support agents: Tester (auth flow test cases), Reviewer (code review)

## Likely Files Or Areas

- `users/views.py` (lines 596 and 647 — `.get()` calls to replace)
- `users/serializers.py` (token/email validation — verify it does not already guard the lookup)
- `users/tests/test_auth_views.py` (add tests for the missing-record paths)

## Plan

1. In `users/views.py:647` replace `User.objects.get(account_activation_token=token)` with
   `get_object_or_404(User, account_activation_token=token)` (returns 404) or
   `.filter(...).first()` with explicit 400 response.
2. In `users/views.py:596` apply the same pattern for `User.objects.get(email=email)`.
3. If `MultipleObjectsReturned` is theoretically possible (duplicate emails without
   unique constraint), add a `.filter().first()` guard and log a warning.
4. Write or extend tests: send invalid token, send unknown email → assert 4xx, not 500.
5. Run `python manage.py test users` and confirm green.

## Validation

```bash
# Confirm registration with bogus token — must return 4xx
curl -s -o /dev/null -w "%{http_code}" -X POST https://metravel.by/api/users/confirm-registration/ \
  -H "Content-Type: application/json" \
  -d '{"token": "00000000-0000-0000-0000-000000000000"}'
# Expected: 400 or 404, not 500

# Password reset with unknown email — must return 4xx
curl -s -o /dev/null -w "%{http_code}" -X POST https://metravel.by/api/users/reset-password-link/ \
  -H "Content-Type: application/json" \
  -d '{"email": "nobody@nowhere.invalid"}'
# Expected: 400 or 404, not 500

# Unit tests
python manage.py test users -v 2
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
