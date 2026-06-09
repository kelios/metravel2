# TASK-20260609-065: Remove Pipfile, consolidate async dependencies to single manifest

Status: Backlog
Owner: Backend
Support: Developer (BE), Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Establish a single source of truth for Python dependencies by removing the obsolete empty `Pipfile` and deciding whether the async service's dependencies are managed from the root `pyproject.toml` or exclusively from `mtravel_async/pyproject.toml`, eliminating the current duplication of FastAPI/SQLAlchemy versions between the two lock files.

## Context

Three dependency manifests coexist:

1. Root `Pipfile` — legacy, `[packages]` section is empty; misleading to developers.
2. Root `pyproject.toml` + `uv.lock` — current primary manifest; already includes `fastapi`, `sqlalchemy`, `asyncpg`, `aiobotocore` (lines 29–36).
3. `mtravel_async/pyproject.toml` + `mtravel_async/uv.lock` — separate manifest for the async service; also pins FastAPI/SQLAlchemy.

Both lock files can independently pin incompatible versions of the same package (e.g. SQLAlchemy 2.0.x in root vs 1.4.x in async), causing runtime bugs that are invisible at install time if only one lock is used during deployment.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `Pipfile` and `Pipfile.lock` (if present) are deleted from the repository root.
- [ ] A clear decision is documented and implemented: either (a) async service uses root `pyproject.toml` as its source (single lock file for the entire repo), or (b) async service is genuinely separate and root `pyproject.toml` no longer lists fastapi/sqlalchemy/asyncpg/aiobotocore.
- [ ] No async dependency (fastapi, sqlalchemy, asyncpg, aiobotocore) is listed in both manifests simultaneously.
- [ ] `uv lock` (or equivalent) produces a single consistent lock for the chosen approach.
- [ ] CI uses the chosen manifest/lock for all installs.

## Gherkin Tests

```gherkin
Feature: Single dependency manifest for async packages

  Scenario: Pipfile is absent
    Given the repository root
    When the file listing is checked
    Then no Pipfile or Pipfile.lock is present

  Scenario: fastapi version is defined in exactly one manifest
    Given the consolidated dependency setup
    When all pyproject.toml files are searched for "fastapi"
    Then exactly one file contains a fastapi dependency declaration

  Scenario: Lock file is consistent after consolidation
    Given the chosen manifest approach
    When uv lock --check is run
    Then no out-of-date dependencies are reported
```

## Assignment

Primary owner: Backend developer
Support agents: Reviewer (lock file conflict check), Releaser (CI install command update)

## Likely Files Or Areas

- `Pipfile` (root) — to be deleted
- `Pipfile.lock` (root, if present) — to be deleted
- `pyproject.toml` (root) — lines 29–36 async deps (keep or remove depending on chosen approach)
- `uv.lock` (root) — regenerate after changes
- `mtravel_async/pyproject.toml` — async deps (keep or remove depending on chosen approach)
- `mtravel_async/uv.lock` — keep if async is standalone, remove if merged into root
- `Makefile` / CI config — update install commands

## Plan

1. Decide approach: monorepo single manifest OR async is a standalone deployable. Document the decision.
2. If single manifest: move all async deps to root `pyproject.toml`; delete `mtravel_async/pyproject.toml` and its lock; remove duplicate entries.
3. If standalone async: remove fastapi/sqlalchemy/asyncpg/aiobotocore from root `pyproject.toml`; keep `mtravel_async/` fully self-contained.
4. Delete `Pipfile` (and `Pipfile.lock` if present).
5. Regenerate the relevant lock file(s) with `uv lock`.
6. Update `Makefile` / CI to use the correct install command for each deployable.
7. Verify: `uv lock --check` passes; test suite installs and runs cleanly.

## Validation

```bash
# Confirm Pipfile is gone
ls Pipfile 2>&1 || echo "Pipfile not found — OK"

# Confirm fastapi declared in only one manifest
grep -r "fastapi" --include="pyproject.toml" .

# Lock consistency
uv lock --check

# Install and run tests
uv sync && pytest tests/ -x -q
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
