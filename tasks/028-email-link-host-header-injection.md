# TASK-20260609-028: Fix Host-header injection in notification email links

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Replace `request.META['HTTP_HOST']`-based link construction in notification emails with a
fixed canonical URL from `settings.SITE_URL`, eliminating the Host-header phishing vector
that allows an attacker to inject an arbitrary domain into email links.

## Context

Two view functions build clickable URLs for HTML notification emails by reading the
incoming HTTP `Host` header:

- `travel_comments/views.py:403-406` — comment notification email
- `messaging/views.py:320-324` — message notification email

Pattern (approximate):
```python
host = request.META.get('HTTP_HOST', 'metravel.by')
link = f"https://{host}/travels/{travel_id}/"
```

In production `ALLOWED_HOSTS = ['*']` (see TASK-20260609-014) means Django does not reject
spoofed Host headers. An attacker can send a crafted request with `Host: evil.example.com`,
triggering a legitimate notification email to a victim with a link pointing to the
attacker-controlled domain (open redirect / phishing).

Fix is to source the domain from `settings.SITE_URL` (a constant like `"https://metravel.by"`)
and never use `HTTP_HOST` for link generation.

**Related task:** TASK-20260609-014 (tighten ALLOWED_HOSTS) — that task reduces the
exploitation window but does not fix the root cause here. Both fixes are independent and
should be applied together.

**Frontend impact (`../metravel2`):** none — this change is purely server-side email
content generation.

Source task:

- Source id:   TASK-20260609-014
- Source path: tasks/014-prod-settings-hardening.md

## Acceptance Criteria

- [ ] `settings.SITE_URL` (or equivalent canonical URL constant) is defined in the backend
  settings and used as the base for all email link generation.
- [ ] `request.META['HTTP_HOST']` (and `request.get_host()`) are not used to construct
  email links anywhere in `travel_comments/views.py` or `messaging/views.py`.
- [ ] Sending a request with a spoofed `Host: evil.example.com` header does not cause an
  email to be generated containing `evil.example.com` in any link.
- [ ] A legitimately triggered notification email contains a link starting with
  `settings.SITE_URL` (e.g. `https://metravel.by/...`).
- [ ] No other view or utility function builds email links from `HTTP_HOST` (grep confirms).

## Gherkin Tests

```gherkin
Feature: Notification emails use canonical domain, not Host header

  Scenario: Comment notification email does not reflect spoofed Host
    Given a valid authenticated POST to /api/travel-comments/ with header "Host: evil.example.com"
    When the comment triggers a notification email
    Then the email HTML body does not contain "evil.example.com"
    And all links in the email start with the configured SITE_URL

  Scenario: Message notification email does not reflect spoofed Host
    Given a valid authenticated POST to /api/messages/ with header "Host: evil.example.com"
    When the message triggers a notification email
    Then the email HTML body does not contain "evil.example.com"
    And all links in the email start with the configured SITE_URL

  Scenario: Legitimate notification email has correct canonical link
    Given SITE_URL = "https://metravel.by"
    When a comment notification email is generated for travel id=42
    Then the email contains a link starting with "https://metravel.by"
```

## Assignment

Primary owner: Backend developer (metravel-backend repo)
Support agents: Tester (`test-author` — mock email backend and assert link domain), Reviewer (grep for remaining HTTP_HOST usages)

## Likely Files Or Areas

- `../metravel-backend/travel_comments/views.py` — link construction (~lines 403-406)
- `../metravel-backend/messaging/views.py` — link construction (~lines 320-324)
- `../metravel-backend/metravel/settings/common.py` (or equivalent) — add `SITE_URL = "https://metravel.by"`
- `../metravel-backend/metravel/envs/` — override `SITE_URL` per environment if needed

## Plan

1. Add `SITE_URL = env('SITE_URL', default='https://metravel.by')` to `settings/common.py`.
2. In `travel_comments/views.py` (~line 403), replace `request.META['HTTP_HOST']`/`request.get_host()` with `settings.SITE_URL`.
3. In `messaging/views.py` (~line 320), apply the same replacement.
4. Grep the entire backend codebase for remaining `HTTP_HOST` and `get_host()` usages in email-link contexts; fix any found.
5. Add unit tests using Django's `mail.outbox` to assert link domain equals `SITE_URL` regardless of the `Host` header in the triggering request.

## Validation

```bash
# In metravel-backend repo:

# 1. Grep for remaining HTTP_HOST in email-generating code
grep -rn "HTTP_HOST\|get_host()" \
  travel_comments/views.py messaging/views.py
# Expected: no matches after fix

# 2. Automated test — mock mail, spoof Host
python manage.py test travel_comments.tests.test_email_links messaging.tests.test_email_links --verbosity=2
# Expected: all green, no evil.example.com in mail.outbox

# 3. Manual: trigger comment notification with spoofed Host
curl -s -X POST http://localhost:8000/api/travel-comments/ \
  -H "Host: evil.example.com" \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"travel": 1, "text": "Host injection test"}'
# Then inspect email backend log / mail.outbox in shell:
# python manage.py shell -c "from django.core import mail; print(mail.outbox[-1].body)"
# Expected: URL contains metravel.by, NOT evil.example.com

# 4. Settings check
python manage.py shell -c "from django.conf import settings; print(settings.SITE_URL)"
# Expected: https://metravel.by
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
