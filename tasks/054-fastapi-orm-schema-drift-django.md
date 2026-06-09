# TASK-20260609-054: Add contract tests to catch FastAPI/SQLAlchemy schema drift from Django

Status: Backlog
Owner: Backend
Support: Developer (BE), Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Prevent silent runtime breakage when Django migrations rename or alter tables that the FastAPI async service accesses via hardcoded `__tablename__` strings, by introducing automated contract tests that fail at CI time on schema mismatch.

## Context

The FastAPI async service declares SQLAlchemy models with hardcoded table names:

- `mtravel_async/infrastructure/db/models.py:8` — `__tablename__ = "maintenance_travelgallery"`
- `mtravel_async/infrastructure/db/models.py:23` — `__tablename__ = "travel_address"`
- `mtravel_async/infrastructure/db/models.py:30` — `__tablename__ = "travels"`
- `mtravel_async/infrastructure/db/models.py:37` — `__tablename__ = "users_profile"`
- `mtravel_async/infrastructure/image_sources.py:32` — `model_label = "maintenance.travelgallery"`

These strings must manually match Django's `db_table` (or auto-generated table names) and migration state. There is no shared source of truth. A Django migration that renames a model or sets `db_table` will break the async service only at runtime, not at build/CI time.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] A test suite (pytest or Django test) exists that introspects Django model metadata (`_meta.db_table`) and compares it against the `__tablename__` values declared in `mtravel_async/infrastructure/db/models.py`.
- [ ] The test fails immediately and with a clear message if any `__tablename__` does not match the current Django migration state.
- [ ] The test is part of the standard CI run (`make test` or equivalent).
- [ ] Column-level drift (at minimum: columns present in the SQLAlchemy model exist in the Django model) is also asserted.
- [ ] A `SHARED_SCHEMA_CONTRACT.md` (or inline docstring) documents the shared-schema boundary and update procedure.

## Gherkin Tests

```gherkin
Feature: FastAPI schema contract with Django migrations

  Scenario: Table name contract test passes on a consistent schema
    Given the Django migrations are up to date
    And the SQLAlchemy model declares __tablename__ matching Django's db_table
    When the contract test suite runs
    Then all assertions pass with no errors

  Scenario: Contract test catches a renamed Django table
    Given a Django migration renames "maintenance_travelgallery" to "media_travelgallery"
    And the SQLAlchemy model still declares __tablename__ = "maintenance_travelgallery"
    When the contract test suite runs
    Then the test fails with a message identifying the mismatched table name

  Scenario: Contract test catches a missing column
    Given the SQLAlchemy model declares a column that has been removed in a Django migration
    When the contract test suite runs
    Then the test fails identifying the missing column and model name
```

## Assignment

Primary owner: Backend developer
Support agents: Tester (CI integration), Reviewer (contract coverage completeness)

## Likely Files Or Areas

- `mtravel_async/infrastructure/db/models.py`
- `mtravel_async/infrastructure/image_sources.py`
- `mtravel_async/conf/settings.py`
- New file: `tests/test_async_schema_contract.py`
- New file: `SHARED_SCHEMA_CONTRACT.md` (or `docs/SHARED_SCHEMA_CONTRACT.md`)
- `Makefile` / CI config — to include contract test in standard run

## Plan

1. Enumerate all `__tablename__` and `model_label` values in `mtravel_async/infrastructure/`.
2. Write a pytest test that imports each Django model, reads `Model._meta.db_table`, and asserts equality with the corresponding async `__tablename__`.
3. Extend the test to check that columns declared in the SQLAlchemy `Table`/mapped class exist in `Model._meta.get_fields()`.
4. Add the test file to the standard test run path.
5. Write `SHARED_SCHEMA_CONTRACT.md` documenting: which tables are shared, who owns the schema, and what to update when adding/renaming fields.
6. Run the new tests against the current codebase to confirm they are green; fix any discovered drift as a separate commit.

## Validation

```bash
# Run contract tests specifically
cd metravel-backend && pytest tests/test_async_schema_contract.py -v

# Simulate a drift: temporarily rename __tablename__ in mtravel_async and confirm test fails
# (manual check — revert after)

# Confirm test is included in standard CI target
make test 2>&1 | grep "test_async_schema_contract"
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
