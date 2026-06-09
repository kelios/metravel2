# TASK-20260609-030: Add UniqueConstraint on QuestProgress (user, quest) and fix duplicate-create race

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Prevent duplicate `QuestProgress` rows for the same (user, quest) pair by adding a
database-level `UniqueConstraint` and switching the create view to `get_or_create` /
`update_or_create`, eliminating both application-level races and direct-API abuse.

## Context

`quests/views.py:190-212` handles `POST /api/quest-progress/`. The current logic uses
`get_or_create` at the application level but the model has no `UniqueConstraint` in
`QuestProgress.Meta`. Because the constraint does not exist at the database level:

1. A concurrent double-POST (race condition) or a direct API call bypassing the view
   can insert two rows with the same (user, quest) pair.
2. Duplicate rows corrupt quest completion logic and leaderboard aggregations.
3. Any future bulk-import or admin operation can silently create dupes.

The missing constraint also means `get_or_create` cannot rely on a unique index — under
concurrent load it can still produce two `INSERT` statements before either transaction commits.

**No breaking change for the frontend (`../metravel2`):** a repeat POST should return the
existing progress object (200 or the existing 201 payload), not a new duplicate. The
frontend quest flow does not depend on a new row being created on every call.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `QuestProgress` model has `UniqueConstraint(fields=['user', 'quest'], name='unique_user_quest_progress')` in `Meta`.
- [ ] A migration is generated and applies cleanly against a database that may already have
  duplicate rows (migration includes a deduplification step or fails fast with a clear message).
- [ ] `POST /api/quest-progress/` with a (user, quest) pair that already has a progress row
  returns the existing record (HTTP 200) or HTTP 400 — it does not create a second row.
- [ ] `POST /api/quest-progress/` for a new (user, quest) pair creates the row and returns
  HTTP 201.
- [ ] Concurrent double-POSTs (simulated with threads) produce exactly one row in the database.

## Gherkin Tests

```gherkin
Feature: QuestProgress uniqueness per user and quest

  Scenario: Duplicate POST returns existing record, not a new row
    Given user id=3 already has a QuestProgress for quest id=5
    When the same user POSTs to /api/quest-progress/ with quest=5
    Then the response status is 200 (or 400 if idempotent reject is preferred)
    And the database still contains exactly 1 QuestProgress row for (user=3, quest=5)

  Scenario: First POST creates the progress row
    Given user id=3 has no QuestProgress for quest id=7
    When the user POSTs to /api/quest-progress/ with quest=7
    Then the response status is 201
    And exactly 1 QuestProgress row exists for (user=3, quest=7)

  Scenario: Concurrent double-POST produces exactly one row
    Given user id=4 has no QuestProgress for quest id=2
    When two simultaneous POST requests are made for (user=4, quest=2)
    Then the database contains exactly 1 QuestProgress row for (user=4, quest=2)
    And at least one response is 201 or 200; neither is a 500

  Scenario: Migration applies cleanly
    Given the current database has no duplicate (user, quest) rows
    When the migration adding UniqueConstraint is run
    Then the migration completes without error
    And subsequent duplicate INSERT attempts raise IntegrityError
```

## Assignment

Primary owner: Backend developer (metravel-backend repo)
Support agents: Tester (`test-author` — add uniqueness and concurrency tests), Reviewer (verify migration handles pre-existing dupes safely)

## Likely Files Or Areas

- `../metravel-backend/quests/models.py` — add `UniqueConstraint` to `QuestProgress.Meta`
- `../metravel-backend/quests/migrations/` — new migration for the constraint
- `../metravel-backend/quests/views.py` — `POST /api/quest-progress/` handler (~lines 190-212), use `update_or_create` / handle `IntegrityError`
- `../metravel-backend/quests/tests/` — add uniqueness and concurrent-POST tests

## Plan

1. In `quests/models.py`, add to `QuestProgress.Meta`:
   ```python
   constraints = [
       models.UniqueConstraint(fields=['user', 'quest'], name='unique_user_quest_progress')
   ]
   ```
2. Generate migration: `python manage.py makemigrations quests`.
3. If the database may contain existing duplicates, add a `RunPython` step in the migration
   to deduplicate (keep the row with the latest `updated_at`, delete others) before the
   unique index is created.
4. In `quests/views.py` create handler, replace bare `create()` with `update_or_create`
   (or catch `IntegrityError` from a concurrent insert and return the existing row with
   HTTP 200).
5. Write tests: single POST → 201, duplicate POST → 200 (no second row), concurrent POSTs
   → exactly 1 row, migration dedup step.

## Validation

```bash
# In metravel-backend repo:

# 1. Generate and check migration
python manage.py makemigrations quests --check
python manage.py migrate quests
# Expected: migration applies with no errors

# 2. Verify constraint in DB (PostgreSQL)
python manage.py dbshell <<'EOF'
\d quests_questprogress
EOF
# Expected: unique index on (user_id, quest_id) visible

# 3. First POST — 201
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/api/quest-progress/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"quest": 1}'
# Expected: 201

# 4. Duplicate POST — 200 or 400 (not 500, not 201 with new id)
curl -s -X POST http://localhost:8000/api/quest-progress/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"quest": 1}' | python -m json.tool
# Expected: HTTP 200 with same record id as step 3, or 400 with explicit message

# 5. Row count
curl -s -X POST http://localhost:8000/api/quest-progress/ \
  -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" \
  -d '{"quest": 1}'
python manage.py shell -c "
from quests.models import QuestProgress
count = QuestProgress.objects.filter(quest_id=1).count()
print('rows:', count)
assert count == 1, f'Expected 1, got {count}'
"
# Expected: rows: 1

# 6. Run quest tests
python manage.py test quests.tests --verbosity=2
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
