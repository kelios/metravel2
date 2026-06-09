# TASK-20260609-044: Missing indexes for travel_viewed / created_at / updated_at sort columns

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Add partial composite indexes on `travel_viewed`, `created_at`, and `updated_at` for
visible (`publish=True, moderation=True`) travels so that `popular`, `of_month`, and
date-based sort presets use an index scan instead of a sequential scan + in-memory sort.

## Context

`travels/models.py:337-347` defines several existing indexes (year, slug, partial `-id`
for published+moderated travels, trigram on name/description). However the sort columns
used at runtime have no covering indexes:

- `views.py:826,1262` — `popular` and `of_month` presets order by `-travel_viewed`
- `views.py:68-71` — `popular_desc`, `created_desc`, `updated_desc` presets

Without indexes PostgreSQL falls back to seq-scan + sort. Observed query times on prod
(2026-06-09):

| Sort preset | Query time |
|---|---|
| popular | 0.24 s |
| sort=popular_desc | 0.72 s |
| default (no sort) | ~0.08 s |

Popular sorting is called on every homepage load, so degradation compounds with table
growth.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `EXPLAIN (ANALYZE, BUFFERS)` for `ORDER BY -travel_viewed` on the published/moderated subset shows an Index Scan or Bitmap Index Scan, not Seq Scan + Sort.
- [ ] Same for `ORDER BY -created_at` and `ORDER BY -updated_at` on the same subset.
- [ ] A Django migration is added that creates the new indexes.
- [ ] Observed query time for `sort=popular_desc` on prod drops measurably vs. baseline 0.72 s.
- [ ] No regression on existing test suite.

## Gherkin Tests

```gherkin
Feature: Sort indexes on visible travels

  Scenario: Popular sort uses index scan
    Given the travels table has at least 10 000 published+moderated rows
    When a query selects travels ordered by -travel_viewed with publish=True AND moderation=True
    Then EXPLAIN output shows Index Scan on the new partial index
    And no Sort node appears in the EXPLAIN plan

  Scenario: Date sort uses index scan
    Given the travels table has at least 10 000 published+moderated rows
    When a query selects travels ordered by -created_at with publish=True AND moderation=True
    Then EXPLAIN output shows Index Scan on the new partial index

  Scenario: Homepage popular endpoint responds faster
    Given the partial index on travel_viewed exists
    When GET /api/travels/?sort=popular_desc is called
    Then the response time is below 0.3 s (down from ~0.72 s baseline)
```

## Assignment

Primary owner: Backend Developer
Support agents: Tester (EXPLAIN assertions, migration smoke test), Reviewer (index definition correctness)

## Likely Files Or Areas

- `travels/models.py` (Meta.indexes block, lines 337-347)
- New migration file under `travels/migrations/`
- `travels/views.py` (lines 68-71, 826, 1262 — verify sort field names match index)

## Plan

1. Identify exact field names used in each sort preset (`travel_viewed`, `created_at`, `updated_at`).
2. Add partial composite indexes to `Travel.Meta.indexes`:
   ```python
   models.Index(
       fields=['-travel_viewed', '-id'],
       condition=models.Q(publish=True, moderation=True),
       name='travel_popular_partial_idx',
   ),
   models.Index(
       fields=['-created_at', '-id'],
       condition=models.Q(publish=True, moderation=True),
       name='travel_created_partial_idx',
   ),
   models.Index(
       fields=['-updated_at', '-id'],
       condition=models.Q(publish=True, moderation=True),
       name='travel_updated_partial_idx',
   ),
   ```
3. Generate and review the migration (`makemigrations`).
4. Apply on staging, verify EXPLAIN plans.
5. Apply on prod, record new query times in Validation evidence.

## Validation

```bash
# Generate migration
python manage.py makemigrations travels --name add_sort_partial_indexes

# Apply on staging
python manage.py migrate travels

# EXPLAIN check (run in psql or Django shell)
python manage.py shell -c "
from django.db import connection
with connection.cursor() as c:
    c.execute(\"\"\"
        EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
        SELECT id FROM travels_travel
        WHERE publish = true AND moderation = true
        ORDER BY travel_viewed DESC, id DESC
        LIMIT 20
    \"\"\")
    print(c.fetchall())
"

# Prod response time after deploy
curl -o /dev/null -sw "%{time_total}s\n" \
  "https://metravel.by/api/travels/?sort=popular_desc"
# Target: < 0.30 s (baseline 0.72 s)
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
