# TASK-20260609-059: Unify async image pipeline — extract shared constants/logic, remove Django import from FastAPI

Status: Backlog
Owner: Backend
Support: Developer (BE), Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Eliminate the duplicate image-processing constants and logic between the Django stack and the FastAPI async service, and remove the direct Django import from the async service so it can be deployed independently.

## Context

Two problems coexist:

1. **Django import in FastAPI service** — `mtravel_async/application/services/image_transform.py:8`:
   ```python
   from metravel.common.image_support import ensure_heif_support
   ```
   The "separate" async service cannot be installed or run without the Django project's source on `PYTHONPATH`. This contradicts the separation-of-service claim and creates a hidden deployment coupling.

2. **Duplicated image constants** — `DEFAULT_IMAGE_QUALITY=85`, `ALLOWED_IMAGE_WIDTHS`, `ALLOWED_IMAGE_FITS`, cache-control headers, watermark/resize/WebP logic exist independently in both `maintenance/views.py:59–67` and `mtravel_async/`. Two copies will drift over time (different quality values, different allowed widths accepted by each stack).

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `mtravel_async` contains no `from metravel.*` or `import metravel` import.
- [ ] Image constants (`DEFAULT_IMAGE_QUALITY`, `ALLOWED_IMAGE_WIDTHS`, `ALLOWED_IMAGE_FITS`, cache-control headers) exist in exactly one place and are consumed by both stacks.
- [ ] The chosen approach is documented: either (a) a shared internal package (`metravel_shared/image_constants.py`) used by both, or (b) explicit acknowledgment that async is a Django sub-module (not a separate service) with a single copy of constants in `metravel/common/`.
- [ ] Existing image transform behavior is unchanged — same output for same input.
- [ ] The async service can be started without importing Django ORM modules (if option a is chosen).

## Gherkin Tests

```gherkin
Feature: Image pipeline constants have a single source of truth

  Scenario: Both stacks use the same quality constant
    Given DEFAULT_IMAGE_QUALITY is defined in one place
    When Django image processing encodes a WebP
    And the async service encodes the same source image
    Then both produce output with the same quality setting

  Scenario: Async service starts without Django ORM
    Given the async service's dependencies are installed
    When the async service is imported (without Django settings configured)
    Then no ImportError related to Django ORM or settings is raised

  Scenario: Adding a new allowed width applies to both stacks
    Given ALLOWED_IMAGE_WIDTHS is defined in the shared location
    When a new width value is added
    Then both the Django image view and the async service accept that width
    And neither stack has a hardcoded copy of the old list
```

## Assignment

Primary owner: Backend developer
Support agents: Tester (image output regression), Reviewer (import graph audit), Releaser

## Likely Files Or Areas

- `mtravel_async/application/services/image_transform.py:8` — Django import to remove
- `mtravel_async/conf/settings.py` — async image constants
- `maintenance/views.py:59–67` — Django-side constants
- `metravel/common/image_support.py` — `ensure_heif_support` function (to be extracted)
- New file (option a): `metravel_shared/image_constants.py` and `metravel_shared/image_support.py`
- `mtravel_async/pyproject.toml` — ensure shared package is listed as dependency

## Plan

1. Extract `ensure_heif_support` and all image constants into a zero-ORM module (e.g. `metravel_shared/image_support.py`).
2. Update `mtravel_async/application/services/image_transform.py` to import from the shared module instead of `metravel.common`.
3. Update `maintenance/views.py` to import constants from the same shared module (remove local hardcoded copies).
4. Verify `mtravel_async` can be imported in a clean Python environment without Django settings.
5. Run image transform tests against both stacks to confirm identical output.
6. Document the shared-module architecture in a brief comment or `SHARED_SCHEMA_CONTRACT.md`.

## Validation

```bash
# Confirm no Django import in async service
grep -rn "from metravel\|import metravel" mtravel_async/

# Confirm constants defined once
grep -rn "DEFAULT_IMAGE_QUALITY\|ALLOWED_IMAGE_WIDTHS" --include="*.py" . | grep -v migrations | grep -v ".pyc"

# Test async service import isolation
python -c "import sys; sys.path.insert(0,'mtravel_async'); from application.services.image_transform import ImageTransformService"

# Full test suite
pytest tests/ -x -q
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
