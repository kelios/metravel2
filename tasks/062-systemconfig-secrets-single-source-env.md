# TASK-20260609-062: Make env the single source for secrets — remove secret fields from SystemConfig DB model

Status: Backlog
Owner: Backend
Support: Developer (BE), Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Eliminate the architectural duplication where SMTP and AWS credentials exist in both environment variables and the `SystemConfig` database model, and ensure the application reads all secrets exclusively from environment/settings.

## Context

`maintenance/models.py:58–71` — `SystemConfig` stores `email_host_password`, `aws_access_key_id`, `aws_secret_access_key` as DB fields. `maintenance/views.py:414–423` (`FeedbackView`) reads SMTP credentials from the DB record, not from `settings.EMAIL_HOST_PASSWORD`.

At the same time, `metravel/envs/common/settings.py:213,223` also defines SMTP and AWS config from environment variables.

This means two independent sources of truth for secrets: rotating a password in the environment does not update what `FeedbackView` uses unless the SystemConfig DB row is also manually updated. The plaintext storage aspect is addressed separately (security tasks); this task addresses the architectural duplication.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `FeedbackView` (and any other view/service) reads SMTP credentials exclusively from `django.conf.settings` (which in turn reads from env).
- [ ] `SystemConfig` model no longer has `email_host_password`, `aws_access_key_id`, `aws_secret_access_key` fields.
- [ ] A migration removes those columns from the DB table.
- [ ] `SystemConfig` retains only non-sensitive operational flags (e.g. feature toggles, display config).
- [ ] Rotating an env variable takes effect on the next request with no DB change required.
- [ ] Existing feedback email functionality works (SMTP config from env is correct and tested).

## Gherkin Tests

```gherkin
Feature: Secrets come only from environment variables

  Scenario: FeedbackView uses settings for SMTP, not DB
    Given settings.EMAIL_HOST_PASSWORD is set from environment
    And SystemConfig has no email_host_password field
    When a feedback form is submitted
    Then the email is sent using settings.EMAIL_HOST_PASSWORD

  Scenario: Rotating EMAIL_HOST_PASSWORD takes immediate effect
    Given the environment variable EMAIL_HOST_PASSWORD is updated
    When the next feedback request is processed (no server restart needed beyond normal reload)
    Then the new password is used for the SMTP connection

  Scenario: SystemConfig contains no secret fields after migration
    Given the migration has been applied
    When SystemConfig._meta.get_fields() is inspected
    Then no field named email_host_password, aws_access_key_id, or aws_secret_access_key exists
```

## Assignment

Primary owner: Backend developer
Support agents: Tester (feedback email smoke-test), Reviewer (migration safety + no plaintext in DB), Releaser (env vars must be set before deploy)

## Likely Files Or Areas

- `maintenance/models.py:58–71` — SystemConfig field definitions
- `maintenance/views.py:414–423` — FeedbackView credential read
- `maintenance/services/settings_service.py` — singleton that may cache SystemConfig
- New migration: `maintenance/migrations/XXXX_remove_systemconfig_secret_fields.py`
- `metravel/envs/common/settings.py:213,223` — canonical env-based SMTP/AWS settings

## Plan

1. Update `FeedbackView` to read SMTP credentials from `settings.EMAIL_HOST_*` instead of querying `SystemConfig`.
2. Audit `settings_service.py` for any other places that serve secret fields from `SystemConfig`.
3. Remove `email_host_password`, `aws_access_key_id`, `aws_secret_access_key` from `SystemConfig` model.
4. Write a migration to drop those columns; ensure no data is needed (secrets will live in env from now on).
5. Verify that env vars `EMAIL_HOST_PASSWORD`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` are documented in `.env.example` (not in code).
6. Test feedback email with the env-based credentials.

## Validation

```bash
# Confirm FeedbackView no longer reads from SystemConfig
grep -n "SystemConfig\|settings_service" maintenance/views.py | head -20

# Confirm migration removes columns
python manage.py sqlmigrate maintenance XXXX_remove_systemconfig_secret_fields

# SystemConfig fields after migration
python manage.py shell -c "
from maintenance.models import SystemConfig
print([f.name for f in SystemConfig._meta.get_fields()])
"

# Feedback smoke test (requires local SMTP or mock)
python manage.py shell -c "
from django.core.mail import send_mail
send_mail('test', 'body', 'noreply@metravel.by', ['test@example.com'])
print('OK')
"
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
