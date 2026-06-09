# TASK-20260609-064: Remove empty stub tests.py and consolidate to single test strategy

Status: Backlog
Owner: Backend
Support: Developer (BE), Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Delete all empty per-app `tests.py` boilerplate files and establish a single documented test strategy so contributors always know where to place tests and which runner to use.

## Context

Two test locations exist in the backend repo:

- `tests/<app>/` — real tests, run by `pytest`
- `<app>/tests.py` — per-app Django boilerplate, empty in all affected apps: `articles`, `info`, `maintenance`, `messaging`, `quests`, `travels`, `users`

The empty files say `# Create your tests here` with no content. `manage.py test` discovers them (Django's default runner); `pytest` discovers `tests/`. The two runners see different test sets, which can hide failures depending on which command is run.

There is no documented rule directing contributors to one location.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] All empty `<app>/tests.py` stub files are deleted (or contain at least one real test).
- [ ] `pytest` is the sole documented test runner (`make test` or equivalent calls `pytest`).
- [ ] `manage.py test` either runs the same `tests/` directory or is explicitly noted as not the canonical runner.
- [ ] A `docs/BACKEND_CONVENTIONS.md` section (or `tests/README.md`) states: "All tests go in `tests/<app>/`; run with `pytest`."
- [ ] `pytest.ini` / `setup.cfg` / `pyproject.toml` `testpaths` includes only `tests/`.

## Gherkin Tests

```gherkin
Feature: Single test strategy and location

  Scenario: No empty stub test files remain
    Given the refactored repository
    When all Python files matching **/tests.py are listed
    Then none of them contain only the boilerplate comment and no test functions

  Scenario: pytest discovers tests only from tests/ directory
    Given pytest is configured with testpaths = ["tests"]
    When pytest --collect-only is run
    Then no test items are collected from app-level tests.py files

  Scenario: Contributor adds a new test to the correct location
    Given BACKEND_CONVENTIONS.md documents test placement
    When a contributor writes a test for the messaging app
    Then they place it in tests/messaging/ not in messaging/tests.py
```

## Assignment

Primary owner: Backend developer
Support agents: Tester (confirm pytest collection after cleanup), Reviewer (conventions doc)

## Likely Files Or Areas

- `articles/tests.py`, `info/tests.py`, `maintenance/tests.py`, `messaging/tests.py`, `quests/tests.py`, `travels/tests.py`, `users/tests.py` — to be deleted
- `pyproject.toml` or `setup.cfg` — `testpaths` config
- `Makefile` — `make test` target
- `docs/BACKEND_CONVENTIONS.md` or `tests/README.md` — new documentation
- `pytest.ini` (if exists)

## Plan

1. Verify each `<app>/tests.py` is truly empty (no real tests).
2. Delete all confirmed-empty stub files.
3. Update `pyproject.toml` (or `setup.cfg`) to set `testpaths = ["tests"]` explicitly.
4. Update `Makefile` `test` target to use `pytest tests/` unambiguously.
5. Add a `tests/README.md` or section in `docs/BACKEND_CONVENTIONS.md` documenting the test strategy.
6. Run `pytest --collect-only` to confirm no stub files appear in the collection.

## Validation

```bash
# Confirm no empty stub tests remain
find . -name "tests.py" -path "*/[a-z]*/*" | xargs grep -l "Create your tests here" 2>/dev/null

# Confirm pytest collects from tests/ only
pytest --collect-only -q 2>&1 | grep "tests.py" | grep -v "^tests/"

# Full test suite passes
pytest tests/ -x -q

# manage.py check still passes (no import errors from removed files)
python manage.py check
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
