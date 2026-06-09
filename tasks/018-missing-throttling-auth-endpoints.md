# TASK-20260609-018: Add DRF throttling and fix nginx rate-limit regex for auth endpoints

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Protect authentication and registration endpoints from brute-force and credential-stuffing
attacks by introducing DRF throttle classes and aligning the nginx rate-limit regex with
the actual URL paths in use.

## Context

Security review 2026-06-09. Two related gaps:

1. **No DRF throttling.** A search for `throttle` / `DEFAULT_THROTTLE` across the settings
   and views files returns zero results. Every endpoint, including authentication actions,
   accepts unlimited requests per second from any IP.

2. **nginx regex mismatch.** `deploy/prod/nginx/nginx.conf:471` limits the pattern
   `^/api/user/(login|registration|reset-password|sendpassword)/` to a stricter rate.
   Actual URL paths registered in `users/urls.py` (via `users/views.py`) include:
   `login`, `registration`, `reset-password-link`, `set-password-after-reset`,
   `google-login`, `confirm-registration`. Of these, only `login` and `registration` match
   the nginx pattern. `reset-password-link`, `set-password-after-reset`, `google-login`,
   and `confirm-registration` fall through to the general 30 r/s limit.
   `confirm_registration` (line 643) and `set_password_after_reset` are particularly
   sensitive: brute-forcing confirmation codes or reset tokens without a tight rate limit
   is feasible.

Recommended approach: add `DEFAULT_THROTTLE_CLASSES` + `DEFAULT_THROTTLE_RATES` in
`common/settings.py` (e.g. `AnonRateThrottle` 100/day, `UserRateThrottle` 1000/day) and
`ScopedRateThrottle` with a stricter scope on auth-specific actions (e.g. 5/min for login,
10/min for confirm-registration). Update the nginx regex to cover all actual auth paths.

No frontend contract changes expected.

Source task:

- Source id:
- Source path: backend security review 2026-06-09

## Acceptance Criteria

- [ ] `REST_FRAMEWORK` in settings contains `DEFAULT_THROTTLE_CLASSES` and
      `DEFAULT_THROTTLE_RATES` with reasonable anon/user limits.
- [ ] Auth-sensitive actions (`login`, `confirm_registration`, `reset-password-link`,
      `set-password-after-reset`, `google-login`) have a stricter `ScopedRateThrottle`
      rate (e.g. 5-10 requests/minute per IP).
- [ ] Exceeding the throttle limit returns HTTP 429 with a `Retry-After` header.
- [ ] The nginx `location` block (or `limit_req_zone` rule) in
      `deploy/prod/nginx/nginx.conf` matches all actual auth URL paths including
      `reset-password-link`, `set-password-after-reset`, `google-login`, and
      `confirm-registration`.
- [ ] Normal authenticated API usage (travel list, detail, etc.) is not throttled under
      typical load.

## Gherkin Tests

```gherkin
Feature: Auth endpoints are protected by rate limiting

  Scenario: Brute-force on login is throttled
    Given no authentication token is provided
    When more than the allowed number of POST requests are sent to /api/user/login/ within a minute
    Then subsequent requests receive HTTP 429 Too Many Requests

  Scenario: Confirm-registration endpoint is throttled
    Given an anonymous caller
    When they send rapid POST requests to /api/user/confirm-registration/
    Then requests beyond the throttle limit receive HTTP 429

  Scenario: Normal travel list browsing is not throttled
    Given a user browsing the site
    When they request GET /api/travels/ multiple times within a minute
    Then all responses return 200 and none return 429
```

## Assignment

Primary owner: Backend developer — DRF throttle settings + nginx regex update.
Support agents: Tester to verify 429 on auth endpoints and no false throttling on browse
endpoints; Reviewer to confirm all actual auth paths are covered.

## Likely Files Or Areas

- `metravel/envs/common/settings.py` (add DEFAULT_THROTTLE_CLASSES / RATES)
- `users/views.py` lines 643 (confirm_registration), login, registration, reset-password
  actions — add `throttle_scope`
- `deploy/prod/nginx/nginx.conf` line 471 (limit_req / location block regex)
- `users/urls.py` — enumerate all auth URL path names

## Plan

1. Add `DEFAULT_THROTTLE_CLASSES` (`AnonRateThrottle`, `UserRateThrottle`) and
   `DEFAULT_THROTTLE_RATES` to `common/settings.py`.
2. Define a `'auth'` throttle scope with a strict rate (e.g. `'auth': '5/min'`).
3. Apply `throttle_scope = 'auth'` to auth-sensitive actions in `users/views.py`.
4. List all actual URL paths from `users/urls.py` and update the nginx `limit_req_zone`
   regex in `nginx.conf:471` to cover all of them.
5. Write tests that hit the throttle limit and assert 429.
6. Deploy to staging; manually test brute-force and normal browsing scenarios.

## Validation

```bash
# Trigger throttle on login (adjust N to the configured limit +1)
for i in $(seq 1 10); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://metravel.by/api/user/login/ \
    -H "Content-Type: application/json" -d '{"email":"x@x.com","password":"wrong"}';
done
# Expected: first N responses 400 (bad credentials), then 429

# Confirm nginx catches reset-password-link
curl -s -o /dev/null -w "%{http_code}" -X POST \
  https://metravel.by/api/user/reset-password-link/ \
  -H "Content-Type: application/json" -d '{"email":"x@x.com"}'
# Expected: 400 or 200 (not bypass to 30r/s; verify via nginx access log rate bucket)
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
