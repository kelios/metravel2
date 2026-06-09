# TASK-20260609-061: Fix settings layering — remove duplicate DATABASES/CACHES and silent overrides

Status: Backlog
Owner: Backend
Support: Developer (BE), Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Establish a single, deterministic settings composition path that eliminates duplicate `DATABASES` and `CACHES` definitions and removes the unpredictable post-import override in `metravel/settings.py`.

## Context

The current settings load order has two problems:

1. **Unpredictable CACHES for local**: `metravel/settings.py` does `from .envs import *` (which loads `local/settings.py` setting `CACHES` inline), then conditionally `from .envs.common.cache_settings import *` (which sets `CACHES` again if `REDIS_AVAILABLE`). The final `CACHES` for local depends on `REDIS_AVAILABLE` evaluated after the first override — difficult to reason about without running the code.

2. **Duplicate DATABASES blocks**: `metravel/envs/common/settings.py:137` and `metravel/envs/prod/settings.py` contain identical `DATABASES` configuration. A change to production DB settings requires editing both files.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `DATABASES` is defined in exactly one place (e.g. `common/settings.py`); environment-specific files only override if genuinely different.
- [ ] `CACHES` is defined in exactly one place per environment; the post-import conditional in `metravel/settings.py` is removed or made deterministic.
- [ ] The final settings values for each environment (local, test, prod) are verifiable with `python manage.py shell -c "from django.conf import settings; print(settings.DATABASES)"` and produce the expected result.
- [ ] `make test`, local dev server, and prod startup all use correct settings without manual inspection.
- [ ] A brief comment in `metravel/settings.py` documents the load order.

## Gherkin Tests

```gherkin
Feature: Django settings are deterministic per environment

  Scenario: Local environment uses exactly one CACHES definition
    Given DJANGO_SETTINGS_MODULE points to local settings
    When the settings module is imported
    Then CACHES contains exactly one backend definition (not overridden twice)

  Scenario: Production DATABASES is defined in one place
    Given the production settings are applied
    When settings.DATABASES is inspected
    Then its value matches the single canonical DATABASES block
    And no second DATABASES block exists in another settings file

  Scenario: Removing duplicate does not change prod behavior
    Given the duplicate DATABASES block in prod/settings.py is removed
    When the prod settings module is imported
    Then settings.DATABASES has the same value as before
```

## Assignment

Primary owner: Backend developer
Support agents: Reviewer (settings audit), Tester (smoke-test each env startup)

## Likely Files Or Areas

- `metravel/settings.py` — conditional post-import of cache_settings
- `metravel/envs/common/settings.py:137` — DATABASES definition
- `metravel/envs/prod/settings.py` — duplicate DATABASES block
- `metravel/envs/local/settings.py` — inline CACHES definition
- `metravel/envs/common/cache_settings.py` — second CACHES definition

## Plan

1. Map the full import/override chain for each environment (local, test, prod) to understand the current final values.
2. Move `DATABASES` to `common/settings.py` as the single definition; remove the duplicate from `prod/settings.py` (prod can override only the `NAME`/`HOST` if using env vars).
3. Consolidate `CACHES`: define it in `common/settings.py` (or `cache_settings.py`) with a single conditional on `REDIS_AVAILABLE`; remove the inline CACHES from `local/settings.py`.
4. Remove the post-import conditional from `metravel/settings.py` (fold it into the envs import chain).
5. Add a load-order comment to `metravel/settings.py`.
6. Verify each environment:
   - `DJANGO_ENV=local python manage.py check`
   - `DJANGO_ENV=test python manage.py check`
   - `DJANGO_ENV=prod python manage.py check`

## Validation

```bash
# Check final DATABASES for prod
DJANGO_SETTINGS_MODULE=metravel.envs.prod.settings python manage.py shell -c \
  "from django.conf import settings; import json; print(json.dumps({k: '...' for k in settings.DATABASES['default']}, indent=2))"

# Check final CACHES for local
DJANGO_SETTINGS_MODULE=metravel.envs.local.settings python manage.py shell -c \
  "from django.conf import settings; print(settings.CACHES)"

# Confirm no second DATABASES definition
grep -rn "^DATABASES" metravel/envs/ --include="*.py"

# Django system check
python manage.py check --deploy 2>&1 | grep -i database
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
