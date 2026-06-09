# TASK-20260609-058: Remove inverted dependency travels→maintenance for TravelGallery

Status: Backlog
Owner: Backend
Support: Developer (BE), Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Move `TravelGallery` (and related travel media models) out of the `maintenance` app and into `travels` (or the new `media` app from TASK-055), eliminating the inverted dependency where the domain core imports from a utility app.

## Context

`travels/models.py:319`:

```python
gallery = ManyToManyField('maintenance.TravelGallery')
```

The domain core (`travels`) depends on a utility/ops app (`maintenance`). This is an inverted dependency: gallery images are semantically part of a travel, yet their model lives in `maintenance`. As a result:

- `maintenance` cannot be refactored or removed without touching `travels`.
- The dependency graph has a logical cycle: core → util.
- Any effort to split `maintenance` (TASK-055) must first resolve this.

This task is a prerequisite or sibling of TASK-055.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `TravelGallery` (and `TravelDescriptionImages` if applicable) resides in `travels` or `media` app — not in `maintenance`.
- [ ] `travels/models.py` no longer contains any `'maintenance.*'` string reference.
- [ ] A Django migration renames the DB table (or uses `db_table` alias) so that data is preserved without manual SQL.
- [ ] The async FastAPI service reference `mtravel_async/infrastructure/image_sources.py:32` (`model_label="maintenance.travelgallery"`) is updated to match the new app label.
- [ ] All image upload, gallery reorder, and gallery delete endpoints continue to work.
- [ ] Tests covering gallery operations pass.

## Gherkin Tests

```gherkin
Feature: TravelGallery lives in the travels/media domain

  Scenario: travels app has no import from maintenance for gallery
    Given the refactored codebase
    When travels/models.py is inspected
    Then no ManyToManyField or ForeignKey references 'maintenance.*'

  Scenario: Gallery endpoint works after model move
    Given a travel with gallery images
    When a GET request fetches the travel detail
    Then the response includes the gallery images from the new model location

  Scenario: Async service uses updated model label
    Given mtravel_async/infrastructure/image_sources.py is updated
    When the async image service resolves a gallery image source
    Then it uses the new app label without raising a Django app registry error

  Scenario: Migration preserves gallery rows
    Given existing gallery rows in the database before migration
    When the migration runs
    Then all gallery rows are accessible under the new model location
```

## Assignment

Primary owner: Backend developer
Support agents: Tester (gallery endpoints regression), Reviewer (migration table rename safety), Releaser (coordinate with TASK-055 deploy)

## Likely Files Or Areas

- `maintenance/models.py` — `TravelGallery` model definition (source)
- `travels/models.py:319` — M2M field referencing `'maintenance.TravelGallery'`
- `travels/` or `media/` — destination for `TravelGallery` model
- New migration: `travels/migrations/XXXX_move_travelgallery.py` (or in `media/`)
- `mtravel_async/infrastructure/db/models.py:8` — `__tablename__ = "maintenance_travelgallery"`
- `mtravel_async/infrastructure/image_sources.py:32` — `model_label = "maintenance.travelgallery"`
- `maintenance/views.py` (upload/gallery views — updated import path)

## Plan

1. Create `TravelGallery` in destination app (travels or media), optionally using `db_table = "maintenance_travelgallery"` as a temporary alias.
2. Write a migration that moves the model registration; update M2M reference in `travels/models.py`.
3. Update `mtravel_async` references to the new app label/table name.
4. Update all views and serializers that import `TravelGallery` from `maintenance`.
5. Remove `TravelGallery` from `maintenance/models.py`.
6. Once the alias `db_table` is no longer needed, add a final migration to rename the table to the new canonical name.
7. Run tests; verify gallery endpoints.

## Validation

```bash
# Confirm no maintenance references for gallery in travels
grep -n "maintenance" travels/models.py

# Confirm async service uses updated label
grep -n "maintenance.travelgallery\|maintenance_travelgallery" mtravel_async/

# Migration runs cleanly
python manage.py migrate --check

# Gallery endpoint smoke test
curl -s -H "Authorization: Token <token>" https://metravel.by/api/travels/<id>/ | jq '.gallery | length'

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
