# TASK-20260609-041: travels/views.py god-file and duplicated host/URL-building logic

Status: Backlog
Owner: Backend
Support: Reviewer, Tester, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Split the ~1700-line `travels/views.py` into focused modules per concern, and consolidate
the duplicated `scheme://host` and travel-image URL building logic into a single shared
helper, reducing maintenance surface and cognitive load without changing any observable
behaviour.

## Context

`travels/views.py` currently contains: sorting/filtering mixins, facet computation,
Instagram OAuth + publish actions, GIS/geo queries, rating actions, route-file handling,
and raw SQL. This makes the file hard to review, test in isolation, or onboard new
developers to.

Separately, the logic for constructing the public host URL and travel-image URLs is
duplicated in at least five places:
- `travels/serializers.py:25` — `HostMixin.get_host`
- `travels/serializers.py:30` — `normalize_public_host`
- `users/serializers.py:74` — another `normalize_public_host`
- Additional inline uses in views

A single `metravel/utils/url_helpers.py` helper (or extension of the existing
`metravel/cache/cache_utils.py`) would eliminate the duplication and make the logic easy
to test and change (e.g. when the CDN prefix changes).

This is a tech-debt refactor. Behaviour must not change.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `travels/views.py` is split into at least two separate files by concern (e.g. `travels/views/`, `travels/instagram_views.py`, `travels/geo_views.py`, or similar).
- [ ] No single views file exceeds ~500 lines (or the team-agreed limit).
- [ ] A single `normalize_public_host` / `build_image_url` helper exists in one canonical location.
- [ ] `HostMixin`, `normalize_public_host` in `travels/serializers.py` and `users/serializers.py` all delegate to the single helper.
- [ ] All existing API endpoints return the same responses as before (full regression via test suite).
- [ ] URL-routing (`urls.py`) is updated if view classes are moved; no 404 regressions.

## Gherkin Tests

```gherkin
Feature: Travels views refactored and URL logic centralised

  Scenario: All existing endpoints remain reachable after refactor
    Given the refactored views are deployed
    When each previously-working travel endpoint is called
    Then it returns the same status and response shape as before the refactor

  Scenario: Travel image URL uses the single canonical helper
    Given a travel with an uploaded image
    When the travel detail or list endpoint is called
    Then the image URL in the response is identical to the one produced by the shared helper

  Scenario: Host URL is consistent across serializers
    Given a request from https://metravel.by
    When any serializer builds an absolute URL using normalize_public_host
    Then all serializers return the same base URL value

  Scenario: No file exceeds the complexity limit
    Given the refactored codebase
    When the file-complexity guard is run
    Then no travels view file triggers the complexity threshold
```

## Assignment

Primary owner: Backend Developer
Support agents: Reviewer (architecture review of split), Tester (full regression suite), Releaser (deployment smoke test)

## Likely Files Or Areas

- `travels/views.py` (~1700 lines — split target)
- `travels/serializers.py` (lines 25-30 — `HostMixin`, `normalize_public_host`)
- `users/serializers.py` (line 74 — duplicate `normalize_public_host`)
- `travels/urls.py` (update imports after split)
- `metravel/utils/url_helpers.py` (new canonical helper — create)

## Plan

1. Create `travels/views/` package; move Instagram actions to `travels/views/instagram.py`,
   GIS/geo actions to `travels/views/geo.py`, rating actions to `travels/views/ratings.py`,
   core CRUD to `travels/views/core.py`; re-export from `travels/views/__init__.py`.
2. Create `metravel/utils/url_helpers.py` with `normalize_public_host(request)` and
   `build_travel_image_url(path, request)`.
3. Update `travels/serializers.py` — `HostMixin.get_host` and `normalize_public_host`
   delegate to the new helper.
4. Update `users/serializers.py:74` to import from `metravel/utils/url_helpers.py`.
5. Run `python manage.py test` and confirm full green suite.
6. Verify URL routing: `python manage.py show_urls | grep travel`.

## Validation

```bash
# Complexity guard (frontend repo equivalent — run backend equivalent)
wc -l travels/views/*.py
# No file should exceed 500 lines

# Full test suite
python manage.py test travels users -v 1

# URL routing sanity check
python manage.py show_urls | grep -E "^/api/travels"

# Smoke test all major endpoints
curl -s -o /dev/null -w "%{http_code}" https://metravel.by/api/travels/
curl -s -o /dev/null -w "%{http_code}" https://metravel.by/api/travels/1/
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Token $TOKEN" \
  https://metravel.by/api/travels/1/rating/
# All expected: 200
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
