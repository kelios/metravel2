# TASK-20260609-052: BaseFields.status has no db_index despite frequent status=1 filter

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Add `db_index=True` (or a partial index) on the `status` field in `BaseFields` so that
queryset filters on `status=1` used by reference-data endpoints and facets can use an
index scan rather than a sequential scan when these tables grow.

## Context

`metravel/common/models.py:12-22` defines:

```python
class BaseFields(models.Model):
    status = models.SmallIntegerField(default=1)
    ...
    class Meta:
        abstract = True
```

No `db_index` is set. The models that inherit `BaseFields` and are filtered by
`status=1` at runtime include:

- `Category`, `Companion`, `Complexity`, `Transport`, `OverNightStay` — used in facets
  (`travels/views.py`) options queries
- `QuestCity` — `quests/views.py:70,115,221`
- `Quest` — `quests/views.py` various list queries

All these tables are currently small (< 100 rows), so PostgreSQL would choose a seq-scan
regardless — hence **LOW** severity. The purpose of this task is to establish the index
before the tables grow (especially `Quest`/`QuestCity` as the quests feature expands) and
to make the filtering contract explicit.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `status` field on all `BaseFields` subclasses has `db_index=True` or a dedicated partial index `WHERE status = 1`.
- [ ] A Django migration is generated and applies cleanly.
- [ ] `EXPLAIN` for `SELECT ... WHERE status = 1` on `QuestCity` and `Category` shows Index Scan (may show Seq Scan on tiny tables — acceptable; the index must exist).
- [ ] No existing test is broken by the migration.

## Gherkin Tests

```gherkin
Feature: Index on BaseFields.status for efficient filtering

  Scenario: Index exists on status column for BaseFields subclass
    Given the migration for status index has been applied
    When the database schema is inspected for the Category table
    Then an index on the status column is present

  Scenario: status=1 filter can use the index on growing tables
    Given the QuestCity table contains 10 000 rows
    When a query filters QuestCity.objects.filter(status=1)
    Then EXPLAIN shows Index Scan on the status index
    And the query does not perform a sequential table scan

  Scenario: Migration applies cleanly on a fresh database
    Given a clean test database
    When python manage.py migrate is run
    Then the migration for status index completes without errors
    And all BaseFields subclass tables have the status index
```

## Assignment

Primary owner: Backend Developer
Support agents: Tester (migration smoke test, EXPLAIN check on seeded table), Reviewer (migration correctness)

## Likely Files Or Areas

- `metravel/common/models.py` (lines 12-22 — `BaseFields.status` field definition)
- New migration file under `metravel/common/migrations/` (or each app's migrations if field is concrete per-app)
- `quests/views.py` (lines 70, 115, 221 — status=1 filter call sites)
- `travels/views.py` (facets options queries filtering on status=1)

## Plan

1. Add `db_index=True` to the `status` field in `BaseFields`:
   ```python
   status = models.SmallIntegerField(default=1, db_index=True)
   ```
2. Run `python manage.py makemigrations` to generate index migrations for all
   concrete subclasses (Django will create one migration per app that has a `BaseFields`
   subclass).
3. Review generated migrations to ensure only `status` index is added, no unintended
   schema changes.
4. Optionally: use a `Meta.indexes` partial index on each model instead for tighter
   control (only if the team prefers partial indexes for boolean-like columns).
5. Apply migrations on staging and verify `\d+ category` in psql shows the new index.

## Validation

```bash
# Generate migrations
python manage.py makemigrations --check
python manage.py makemigrations

# Apply
python manage.py migrate

# Verify index presence (psql)
psql $DATABASE_URL -c "\d+ quests_questcity" | grep status
psql $DATABASE_URL -c "\d+ travels_category" | grep status

# EXPLAIN on a seeded table (seed 10k rows for a meaningful plan)
python manage.py shell -c "
from django.db import connection
with connection.cursor() as c:
    c.execute('EXPLAIN SELECT * FROM quests_questcity WHERE status = 1')
    for row in c.fetchall(): print(row[0])
"

# Run existing migration tests
python manage.py test --pattern='test_migrations*' -v 2
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
