# TASK-20260609-057: Replace Travel bare BooleanFields with a status machine and model-level invariants

Status: Backlog
Owner: Backend
Support: Developer (BE), Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Replace the four independent `BooleanField` flags on `Travel` (`publish`, `moderation`, `sitemap`, `visa`) with a coherent status representation that enforces invariants at the model and database level, preventing invalid flag combinations such as `publish=True, moderation=False`.

## Context

`travels/models.py:299–304` defines:

```python
publish = BooleanField(...)
moderation = BooleanField(...)
sitemap = BooleanField(...)
visa = BooleanField(...)
```

No constraints prevent nonsensical combinations (e.g. published but not moderated). The rest of the codebase uses three different status patterns:

- `metravel/common/models.py:13` — `BaseFields.STATUSES = [(1,'active'),(2,'not_active')]` int-enum
- `quests`, `UserTravelStatus`, `InstagramPublicationLog` — proper `choices` on CharField/IntegerField
- Travel's bare BooleanFields — no choices, no constraints

This inconsistency makes it impossible to add new states without another BooleanField, and invalid states can silently persist in the DB.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `Travel` has a single status field (or a clearly documented pair for publish/moderation) with an explicit `choices` enum.
- [ ] Invalid combinations (e.g. published without passing moderation) are rejected by `Travel.clean()` and/or a `CheckConstraint` in the migration.
- [ ] A data migration converts existing BooleanField rows to the new status representation without data loss.
- [ ] The admin, serializers, and any views that read/write the old fields are updated to use the new status.
- [ ] All other apps (articles, quests, etc.) continue using their existing status approach; a `docs/BACKEND_CONVENTIONS.md` note clarifies the unified direction.
- [ ] Existing tests pass; new tests cover invalid state rejection.

## Gherkin Tests

```gherkin
Feature: Travel status machine prevents invalid combinations

  Scenario: Publishing a travel that has not been moderated is rejected
    Given a Travel instance with moderation=False (or equivalent status)
    When publish is set to True and full_clean() is called
    Then a ValidationError is raised mentioning the invalid combination

  Scenario: Valid status transition is accepted
    Given a Travel instance that has passed moderation
    When publish is set to True and full_clean() is called
    Then no ValidationError is raised and the travel is saved

  Scenario: Data migration preserves existing published travels
    Given travels exist with publish=True and moderation=True before migration
    When the migration runs
    Then those travels have the equivalent canonical "published" status after migration
    And no travel that was not published appears as published after migration

  Scenario: CheckConstraint blocks invalid DB row
    Given the migration has been applied
    When a raw SQL INSERT attempts to set publish=True with moderation=False
    Then the database rejects the insert with a constraint violation
```

## Assignment

Primary owner: Backend developer
Support agents: Tester (status transition tests, migration validation), Reviewer (constraint correctness), Releaser (migration deploy ordering)

## Likely Files Or Areas

- `travels/models.py` (lines 299–304 — status BooleanFields)
- `metravel/common/models.py:13` (BaseFields.STATUSES — reference pattern)
- New migration: `travels/migrations/XXXX_travel_status_machine.py`
- `travels/serializers.py` — status field representation
- `travels/admin.py` — status display/filter
- `travels/views.py` / `travels/services/` — logic that checks publish/moderation flags
- `docs/BACKEND_CONVENTIONS.md` — status convention note

## Plan

1. Audit all usages of `publish`, `moderation`, `sitemap`, `visa` fields in the codebase.
2. Design the new status model: decide between a single `status` CharField with choices or a constrained pair for publish/moderation; add `CheckConstraint`.
3. Implement `Travel.clean()` to validate transitions.
4. Write the migration: add new field, data migration converting flags → status, add `CheckConstraint`, then remove old fields (can be split into multiple migrations for safety).
5. Update serializers, admin, and views to use the new status.
6. Write tests: invalid state rejects, valid state saves, data migration preserves state.
7. Document status convention in `docs/BACKEND_CONVENTIONS.md`.

## Validation

```bash
# Data migration runs cleanly
python manage.py migrate travels --run-syncdb

# Invalid state rejected at model level
python manage.py shell -c "
from travels.models import Travel
t = Travel(publish=True, moderation=False)
t.full_clean()
"
# Expect ValidationError

# Constraint in DB (PostgreSQL)
python manage.py shell -c "
from django.db import connection
with connection.cursor() as c:
    c.execute(\"SELECT conname FROM pg_constraint WHERE conrelid='travels_travel'::regclass AND contype='c'\")
    print(c.fetchall())
"

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
