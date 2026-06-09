# TASK-20260609-014: Harden production Django settings (DEBUG, ALLOWED_HOSTS, SECRET_KEY)

Status: Done (verified 2026-06-09)
Owner: Backend
Support: Frontend Developer, Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Eliminate the three critical prod-settings misconfigurations — `DEBUG=True`,
`ALLOWED_HOSTS=['*']`, and a hardcoded insecure `SECRET_KEY` — so that production does not
leak tracebacks with secrets, is not vulnerable to Host-header injection, and cannot have
its signatures forged.

## Context

Security review 2026-06-09. Three findings in one hardening bundle:

1. `metravel/envs/prod/settings.py:3` — `DEBUG = True`. Any unhandled 500 returns a full
   Django debug page including local variables, settings values, and potentially tokens.
2. `metravel/envs/prod/settings.py:18` — `ALLOWED_HOSTS = ['*']`. Allows Host-header
   injection; an attacker can craft password-reset and OAuth state links pointing to an
   arbitrary host.
3. `metravel/envs/common/settings.py:23` — `SECRET_KEY = 'django-insecure-...'` hardcoded;
   production inherits this value. The key is used to sign password-reset tokens
   (`django.contrib.auth` default) and the Instagram OAuth state parameter
   (`instagram_graph_service.py:56`). A known key allows forging both.

These three settings form a single coherent security hardening package. Rotating the
`SECRET_KEY` invalidates all existing sessions, password-reset links, and OAuth state
parameters — coordinate with operations to minimise user impact (e.g., off-peak deploy).

No frontend API contract changes are expected. Existing `Authorization: Token` headers are
unaffected by `SECRET_KEY` rotation (DRF token model stores token in DB, not derived from
the key).

Source task:

- Source id:
- Source path: backend security review 2026-06-09

## Acceptance Criteria

- [ ] `metravel/envs/prod/settings.py` sets `DEBUG = False`.
- [ ] `ALLOWED_HOSTS` in prod settings contains only the explicit allowed hostnames
      (`metravel.by`, `www.metravel.by`, `api.metravel.by`) — no wildcards.
- [ ] `SECRET_KEY` is read from the environment variable `SECRET_KEY`
      (`SECRET_KEY = os.getenv('SECRET_KEY')`) and the application fails to start
      (raises `ImproperlyConfigured`) if the variable is absent.
- [ ] The hardcoded `django-insecure-…` value is removed from `common/settings.py`.
- [ ] A new random `SECRET_KEY` value is set in the prod environment (`.env` or secrets
      manager) and the old value is treated as compromised.
- [ ] `DEBUG = False` in prod: a request to a non-existent URL returns a plain 404, not a
      Django debug traceback.
- [ ] A Host-header request with an arbitrary host value returns 400 Bad Request.

## Gherkin Tests

```gherkin
Feature: Production Django settings are hardened

  Scenario: Debug page is not served in production
    Given DEBUG is False in the prod environment
    When the client requests a URL that does not exist
    Then the response is a plain 404 with no Django traceback or settings dump

  Scenario: Arbitrary Host header is rejected
    Given ALLOWED_HOSTS contains only the canonical hostnames
    When the client sends a request with Host: evil.example.com
    Then the response status is 400 Bad Request

  Scenario: Application refuses to start without SECRET_KEY env variable
    Given the SECRET_KEY environment variable is not set
    When the Django process starts
    Then it raises ImproperlyConfigured and exits without serving requests
```

## Assignment

Primary owner: Backend developer + operator (SECRET_KEY env var must be set before deploy).
Support agents: Tester to verify 404 page and Host-header rejection; Reviewer to confirm
no other hardcoded secret references remain in settings files.

## Likely Files Or Areas

- `metravel/envs/prod/settings.py` (DEBUG, ALLOWED_HOSTS)
- `metravel/envs/common/settings.py` (SECRET_KEY)
- Prod deployment env file / secrets manager entry (new SECRET_KEY value)
- `instagram_graph_service.py` line 56 (uses SECRET_KEY-derived signing — test after rotation)
- `deploy/prod/` — entrypoint or compose env_file that supplies env vars to the container

## Plan

1. In `metravel/envs/prod/settings.py`: set `DEBUG = False` and
   `ALLOWED_HOSTS = ['metravel.by', 'www.metravel.by', 'api.metravel.by']`.
2. In `metravel/envs/common/settings.py`: replace the hardcoded `SECRET_KEY` assignment
   with `SECRET_KEY = os.getenv('SECRET_KEY')` and add an `ImproperlyConfigured` guard.
3. Generate a new cryptographically random `SECRET_KEY` (e.g., `python -c
   "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`).
4. Set the new value in the prod environment file / secrets manager.
5. Schedule an off-peak deploy; notify users that active sessions will require re-login.
6. After deploy, verify 404 plain page, Host-header 400, and application startup.

## Validation

```bash
# 404 must not be a debug page
curl -s https://metravel.by/api/this-does-not-exist-xyz/
# Expected: plain JSON 404, no HTML traceback

# Bad Host header must be rejected
curl -s -o /dev/null -w "%{http_code}" -H "Host: evil.example.com" https://metravel.by/api/travels/
# Expected: 400

# App must fail without SECRET_KEY (test in staging with env var unset)
# Expected: process exits with ImproperlyConfigured error, not 500
```

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-09: Created from backend security review finding [CRITICAL].

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
