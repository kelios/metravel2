# TASK-20260609-025: Add max_length to comment/message text and move send_mail out of request cycle

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Prevent megabyte-sized comment and message bodies from reaching the database or hanging
workers, and eliminate synchronous `send_mail` calls from the request-response cycle so
that slow SMTP cannot cause 502s.

## Context

Several text fields have no length constraint:

- `travel_comments/serializers.py:56,81,85` — comment body fields (CharField/TextField, no max_length)
- `messaging/serializers.py:31` — message body field
- `messaging/models.py:31` and `travel_comments/models.py` — underlying model fields

Any authenticated (or, where AllowAny, anonymous) client can POST a multi-megabyte body.
Django reads the entire request body into memory before validation, so oversized payloads
exhaust RAM per worker before any field validation runs.

Synchronous email dispatch:
- `travel_comments/views.py:225,368` — `send_mail(...)` called synchronously after comment create/reply
- `messaging/views.py:309` — `send_mail(...)` called synchronously after message create

If SMTP is slow or down with `fail_silently=False`, the request hangs until SMTP timeout
(typically 30 s), causing Gunicorn worker exhaustion and 502 responses on the load balancer.

**Frontend impact (`../metravel2`):** adding a max_length validation returns `HTTP 400` with
a `non_field_errors` / field error body — the frontend comment/message submit flow must
already handle 400 errors. No contract break as long as the error shape follows DRF defaults.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] Posting a comment body longer than 10 000 characters returns `HTTP 400` with a
  descriptive field error; the record is not persisted.
- [ ] Posting a message body longer than 10 000 characters returns `HTTP 400`; the record
  is not persisted.
- [ ] A comment/message within the length limit is created successfully (`HTTP 201`).
- [ ] `send_mail` for comment notifications is no longer called synchronously in the
  request cycle (moved to background thread, Celery task, or `fail_silently=True` with
  async dispatch).
- [ ] `send_mail` for message notifications is no longer called synchronously in the
  request cycle.
- [ ] Worker response time for comment/message creation does not spike on slow SMTP.

## Gherkin Tests

```gherkin
Feature: Comment and message body length validation

  Scenario: Oversized comment body is rejected
    Given an authenticated user
    When the user POSTs a comment with a body of 15 000 characters to /api/travel-comments/
    Then the response status is 400
    And the response body contains a field error for the text field
    And no comment record is created in the database

  Scenario: Normal comment is accepted
    Given an authenticated user
    When the user POSTs a comment with a body of 500 characters
    Then the response status is 201
    And the comment is saved and returned in the response

  Scenario: Oversized message body is rejected
    Given an authenticated user
    When the user POSTs a message with a body of 15 000 characters to /api/messages/
    Then the response status is 400
    And no message record is created

  Scenario: send_mail does not block comment creation response
    Given SMTP server is slow (simulated 10 s delay)
    When an authenticated user POSTs a valid comment
    Then the response is returned in under 2 seconds
    And an email notification is eventually sent (background)
```

## Assignment

Primary owner: Backend developer (metravel-backend repo)
Support agents: Tester (`test-author` — add length-validation tests and SMTP mock tests), Reviewer (verify async dispatch does not lose emails silently)

## Likely Files Or Areas

- `../metravel-backend/travel_comments/serializers.py` — add `max_length` to body fields (~lines 56, 81, 85)
- `../metravel-backend/travel_comments/models.py` — add/confirm `max_length` on model CharField/TextField + migration
- `../metravel-backend/travel_comments/views.py` — move `send_mail` calls (~lines 225, 368) to background
- `../metravel-backend/messaging/serializers.py` — add `max_length` (~line 31)
- `../metravel-backend/messaging/models.py` — add/confirm `max_length` (~line 31) + migration
- `../metravel-backend/messaging/views.py` — move `send_mail` call (~line 309) to background
- `../metravel-backend/metravel/settings/` — optionally configure Celery or `threading.Thread` utility

## Plan

1. Add `max_length=10000` to the comment text field in the model (`travel_comments/models.py`) and generate a migration.
2. Add `max_length=10000` to the message text field in the model (`messaging/models.py`) and generate a migration.
3. Add explicit `max_length=10000` to the corresponding serializer CharField declarations (serializer validation runs before DB write — belt-and-suspenders).
4. Replace synchronous `send_mail` calls with a minimal `threading.Thread(target=send_mail, ...).start()` wrapper or a dedicated Celery task if Celery is already configured.
5. Set `fail_silently=True` in the background call (or handle exceptions in the thread) so mail errors do not surface to the request.
6. Write tests: oversized body → 400, normal body → 201, mock SMTP slowness to assert response time is unaffected.

## Validation

```bash
# In metravel-backend repo:

# 1. Reject oversized comment body
curl -s -X POST http://localhost:8000/api/travel-comments/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d "{\"travel\": 1, \"text\": \"$(python3 -c 'print("x"*15000)')\"}" \
  | python -m json.tool
# Expected: HTTP 400, field error on "text"

# 2. Accept normal comment
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/api/travel-comments/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"travel": 1, "text": "Hello!"}'
# Expected: 201

# 3. Reject oversized message
curl -s -X POST http://localhost:8000/api/messages/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d "{\"recipient\": 2, \"text\": \"$(python3 -c 'print("x"*15000)')\"}" \
  | python -m json.tool
# Expected: HTTP 400

# 4. Run migrations cleanly
python manage.py migrate --run-syncdb
# Expected: no errors, new max_length applied

# 5. Run unit tests
python manage.py test travel_comments.tests messaging.tests --verbosity=2
# Expected: all green
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
