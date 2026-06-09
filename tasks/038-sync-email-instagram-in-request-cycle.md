# TASK-20260609-038: Synchronous email and Instagram publish block Gunicorn workers

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Move all email sending and Instagram Graph API publishing out of the synchronous
Gunicorn request cycle into a background task so that slow SMTP and slow/polling Graph
API calls no longer occupy or kill a worker.

## Context

Gunicorn is configured with `--timeout 60` sync workers (`deploy/prod/app/entrypoint.sh`).
The following blocking operations run inline in the request cycle:

- **Email**: registration confirmation, password reset, feedback — plain `send_mail`
  in `users/views.py` with synchronous SMTP.
- **Instagram publish**: `travels/views.py:1064` calls `_wait_until_ready` which polls
  the Instagram Graph API (`instagram_graph_service.py:299`) until the media container
  is ready. This polling loop can run for seconds to minutes.

If SMTP is slow or the Graph API is delayed, the worker is blocked for the full duration.
At `--timeout 60` the worker is killed after 60 s, returning a 502/504 to the client and
restarting the worker (cold start overhead). Under concurrent usage this can exhaust
the worker pool entirely.

The recommended fix is to enqueue these operations in a task queue (Celery + Redis/RQ)
or, for email, use Django's `EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'`
in dev and a queued backend in prod. Related to task 021 (async image service) and task
025 (comment mail length), but this task specifically targets auth/feedback email and
Instagram publish.

Source task:

- Source id:   TASK-021, TASK-025
- Source path: tasks/021-async-image-service-disabled-502.md, tasks/025-comment-message-max-length-async-mail.md

## Acceptance Criteria

- [ ] `POST /api/users/register/`, `POST /api/users/reset-password-link/`, and feedback endpoints return a response without waiting for SMTP to complete.
- [ ] Instagram publish action returns a response without waiting for Graph API polling to complete.
- [ ] Background task infrastructure (Celery/RQ or equivalent) is configured and running in production.
- [ ] On SMTP failure, the error is recorded in the task queue / logs, not as a 500 to the client.
- [ ] On Graph API timeout, the publish status is tracked asynchronously; the client gets immediate 202/200.
- [ ] Gunicorn worker timeout does not fire due to email or Instagram blocking under normal load.

## Gherkin Tests

```gherkin
Feature: Non-blocking email and Instagram publish

  Scenario: Registration email is sent asynchronously
    Given a new user submits registration
    When POST /api/users/register/ is called
    Then the response status is 201 within 2 seconds
    And a background task is enqueued to send the confirmation email
    And the worker is not blocked waiting for SMTP

  Scenario: SMTP timeout does not cause 502
    Given the SMTP server is unreachable
    When POST /api/users/register/ is called
    Then the response status is 201 (registration succeeds)
    And the SMTP error is recorded in the task queue failure log
    And no 502 is returned to the client

  Scenario: Instagram publish returns without polling
    Given valid Instagram credentials and a travel ready for publish
    When the Instagram publish action is triggered
    Then the API responds within 3 seconds
    And a background task polls the Graph API until media is ready
    And the publish status is updated asynchronously

  Scenario: Background task failure is observable
    Given a background task fails permanently
    When the task queue dead-letter queue is inspected
    Then the failed task is recorded with error details and timestamp
```

## Assignment

Primary owner: Backend Developer
Support agents: Tester (async task integration tests), Reviewer (architecture and queue config review), Releaser (worker process deployment)

## Likely Files Or Areas

- `users/views.py` (registration / password-reset / feedback — `send_mail` calls)
- `travels/views.py` (line 1064 — Instagram publish action, `_wait_until_ready`)
- `instagram_graph_service.py` (line 299 — polling loop)
- `metravel/celery.py` (create if not existing — Celery app config)
- `deploy/prod/app/entrypoint.sh` (add Celery worker start command or separate service)
- `docker-compose-prod.app.yaml` (add celery worker service)
- `metravel/envs/production.py` (CELERY_BROKER_URL, EMAIL_BACKEND)

## Plan

1. Set up Celery (or RQ) with Redis as broker in `metravel/celery.py` and `settings`.
2. Extract `send_mail` calls in `users/views.py` into Celery tasks (`tasks/email_tasks.py`).
3. Replace inline `send_mail` with `.delay()` / `.apply_async()` calls.
4. Extract Instagram publish polling into a Celery task; return 202 Accepted immediately from the view.
5. Add a Celery worker service to `docker-compose-prod.app.yaml`.
6. Update `entrypoint.sh` or add a separate entrypoint for the worker.
7. Write integration tests using `CELERY_TASK_ALWAYS_EAGER = True` in test settings.

## Validation

```bash
# Registration must respond quickly even with slow SMTP
time curl -s -o /dev/null -w "%{http_code}" -X POST https://metravel.by/api/users/register/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'
# Expected: 201 in < 2s

# Celery worker status (after deploy)
celery -A metravel inspect active
celery -A metravel inspect stats

# Run async task tests
python manage.py test metravel.tests.test_async_tasks -v 2
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
