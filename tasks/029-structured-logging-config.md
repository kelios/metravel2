# TASK-20260609-029: Add structured LOGGING configuration with sensitive-data filter

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Introduce a `LOGGING` configuration to the Django backend so that log output has a
controlled format and level, sensitive data never appears in logs, and SMTP errors from
`send_mail` are captured rather than surfacing as unhandled stderr noise.

## Context

A grep for `LOGGING` and `logging.config` across `metravel/envs/**` and the settings
hierarchy returns zero results — there is no `LOGGING` dict anywhere in the project.

Consequences:
1. Django falls back to its default logging behaviour: with `DEBUG=True` (see TASK-20260609-014),
   full tracebacks (including local variable values) are printed to stderr and may contain
   tokens, passwords, or personal data.
2. `send_mail(fail_silently=False)` on SMTP error raises an unhandled exception that
   propagates to stderr without structured capture.
3. There is no way to adjust log verbosity per environment without code changes.
4. `django.security` logger (which records SuspiciousOperation events like invalid Host
   headers) is silenced by default, hiding attack signals.

Fix: add a `LOGGING` dict in `settings/common.py` with:
- `django`, `django.request`, `django.security` handlers writing to stdout/stderr in a
  consistent format.
- A `SensitiveDataFilter` (or Django's built-in `CallbackFilter`) that scrubs
  `Authorization`, `password`, `token` keys from `request.POST` / `extra` dicts.
- Log level controlled by an env var `DJANGO_LOG_LEVEL` (default `WARNING` in prod,
  `DEBUG` in dev).
- Environment overrides in `metravel/envs/dev.py` and `prod.py`.

**Frontend impact (`../metravel2`):** none — pure backend configuration change.

Source task:

- Source id:   TASK-20260609-014
- Source path: tasks/014-prod-settings-hardening.md

## Acceptance Criteria

- [ ] A `LOGGING` dict is present in `settings/common.py` (or an imported logging config module).
- [ ] `django.security` events (e.g. `SuspiciousOperation`) are captured and written to at
  least one handler.
- [ ] `django.request` 5xx errors are captured at `ERROR` level.
- [ ] Log format includes timestamp, level, logger name, and message.
- [ ] A `SensitiveDataFilter` (or equivalent) is applied that prevents `Authorization`,
  `password`, and `token` values from appearing in log records.
- [ ] Log level is configurable via environment variable `DJANGO_LOG_LEVEL` without code changes.
- [ ] Application still starts without errors after the config is applied (`python manage.py check`).

## Gherkin Tests

```gherkin
Feature: Structured logging configuration

  Scenario: SMTP error is captured, not unhandled stderr
    Given send_mail raises an SMTPException
    When the exception is raised during a comment notification
    Then the error is logged at ERROR level via the "django" logger
    And no unformatted traceback appears on raw stderr

  Scenario: Sensitive data does not appear in logs
    Given a request containing an "Authorization" header with a bearer token
    When Django logs a request error for that request
    Then the log record does not contain the token value

  Scenario: Log level is controlled by environment variable
    Given DJANGO_LOG_LEVEL=DEBUG is set in the environment
    When the application starts
    Then DEBUG-level messages from "django" are emitted

    Given DJANGO_LOG_LEVEL=WARNING is set
    Then DEBUG-level messages are suppressed

  Scenario: django.security events are logged
    Given a request arrives with a suspicious Host header
    When Django raises a SuspiciousOperation
    Then the event is recorded in the log output at WARNING or ERROR level
```

## Assignment

Primary owner: Backend developer (metravel-backend repo)
Support agents: Tester (`test-author` — test SensitiveDataFilter and log-level env var), Reviewer (audit for remaining unguarded secret logging)

## Likely Files Or Areas

- `../metravel-backend/metravel/settings/common.py` — add `LOGGING` dict
- `../metravel-backend/metravel/envs/dev.py` — override log level to DEBUG
- `../metravel-backend/metravel/envs/prod.py` — override log level to WARNING
- `../metravel-backend/metravel/logging_filters.py` (new) — `SensitiveDataFilter` implementation

## Plan

1. Create `metravel/logging_filters.py` with a `SensitiveDataFilter(logging.Filter)` that
   redacts `Authorization`, `password`, `token` keys in `record.__dict__` and `record.request.POST`.
2. Add a `LOGGING` dict to `settings/common.py`:
   - `version: 1`, `disable_existing_loggers: False`
   - `formatters.verbose`: `{asctime} {levelname} {name} {message}` style
   - `handlers.console`: `StreamHandler` to stdout with `verbose` formatter and `SensitiveDataFilter`
   - `loggers.django`: level from `env('DJANGO_LOG_LEVEL', 'WARNING')`, handler `console`
   - `loggers.django.request`: level `ERROR`, propagate True
   - `loggers.django.security`: level `WARNING`, propagate True
3. In `metravel/envs/dev.py` set `LOGGING['loggers']['django']['level'] = 'DEBUG'`.
4. In `metravel/envs/prod.py` confirm `WARNING` default or set explicitly.
5. Update `send_mail` wrapper (or background thread from TASK-20260609-025) to catch
   `SMTPException` and log via `logger.error(...)` instead of letting it propagate.
6. Run `python manage.py check` and smoke-test startup.

## Validation

```bash
# In metravel-backend repo:

# 1. Check starts cleanly
python manage.py check
# Expected: System check identified no issues.

# 2. Test log level env var
DJANGO_LOG_LEVEL=DEBUG python manage.py shell -c "
import logging
logger = logging.getLogger('django')
logger.debug('test-debug-visible')
print('handlers:', logger.handlers)
"
# Expected: debug message visible in output

# 3. Test SensitiveDataFilter (unit test)
python manage.py test metravel.tests.test_logging_filters --verbosity=2
# Expected: all green; token/password values not present in captured log records

# 4. Grep for unguarded token logging
grep -rn "Authorization\|password\|token" \
  --include="*.py" \
  metravel/ travel_comments/ messaging/ users/ \
  | grep -i "log\.\(debug\|info\|warning\|error\)"
# Expected: zero hits, or all hits pass through SensitiveDataFilter

# 5. Security logger test — send request with invalid Host
curl -s -H "Host: ;" http://localhost:8000/ > /dev/null
# Then check log output for SuspiciousOperation entry
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
