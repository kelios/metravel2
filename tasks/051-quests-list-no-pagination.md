# TASK-20260609-051: Quest / QuestStep / QuestCity list endpoints have no pagination

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Add pagination (or a bounded default limit) to the `QuestViewSet`, `QuestStepViewSet`,
and `QuestCityViewSet` list actions so that no unbounded queryset can be returned in a
single response, protecting against future data growth and accidental full-table reads.

## Context

`quests/views.py:132-144` defines `QuestStepViewSet` (and similarly `QuestViewSet`,
`QuestCityViewSet`) as plain `ModelViewSet` subclasses with no `pagination_class` set.

Django REST Framework's global `PAGE_SIZE` is not configured in
`settings.py:73-81` (the `REST_FRAMEWORK` dict), so the global paginator does not kick
in either. The result: `GET /api/quests/steps/` returns every `QuestStep` row across all
quests in a single response.

Currently quest data is sparse, so the risk is low — hence **LOW** severity. But the
contract is already unbounded, meaning any future data growth, import, or migration can
silently turn these endpoints into large unfiltered dumps without any code change.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `GET /api/quests/` list response is paginated (or capped at a reasonable limit such as 100).
- [ ] `GET /api/quests/steps/` list response is paginated or scoped to a parent quest (e.g. `?quest=<id>`).
- [ ] `GET /api/quests/cities/` list response is paginated or scoped to a city/quest.
- [ ] Clients can navigate pages via standard DRF pagination fields (`count`, `next`, `previous`, `results`).
- [ ] Existing quest-related tests pass; a test asserting `count` field is present in list responses is added.

## Gherkin Tests

```gherkin
Feature: Quest list endpoints are paginated

  Scenario: Quest list returns paginated response
    Given 50 quests exist in the database
    When GET /api/quests/ is called without parameters
    Then the response contains a pagination envelope with count, next, previous, results
    And results contains at most page_size items

  Scenario: QuestStep list scoped to parent quest
    Given quest #1 has 30 steps
    When GET /api/quests/steps/?quest=1 is called
    Then the response is paginated
    And only steps belonging to quest #1 are returned

  Scenario: QuestCity list is bounded
    Given 200 quest cities exist
    When GET /api/quests/cities/ is called
    Then the response is paginated and does not return all 200 cities in one page
```

## Assignment

Primary owner: Backend Developer
Support agents: Tester (pagination envelope assertion, scoped filter test), Reviewer (API contract change review)

## Likely Files Or Areas

- `quests/views.py` (lines 132-144 — QuestStepViewSet; QuestViewSet; QuestCityViewSet)
- `metravel/common/view_paginator.py` (shared Paginator to reuse)
- `metravel/settings/` — `REST_FRAMEWORK` dict (optionally set global `PAGE_SIZE`)
- `quests/tests/` (add pagination tests)

## Plan

1. Import the shared `Paginator` from `metravel.common.view_paginator`.
2. Add `pagination_class = Paginator` to `QuestViewSet`, `QuestStepViewSet`, and
   `QuestCityViewSet`.
3. Optionally add a `quest` filter to `QuestStepViewSet` so clients can scope results
   without needing large pages.
4. Update or add tests asserting the response envelope contains `count`/`next`/`previous`.
5. Review any frontend/mobile consumer of these endpoints to ensure it handles the
   paginated response structure (coordinate with FE if needed).

## Validation

```bash
# Quests list — expect pagination envelope
curl -s https://metravel.by/api/quests/ \
  | python -c "import sys,json; d=json.load(sys.stdin); print(list(d.keys()))"
# Expected: ['count', 'next', 'previous', 'results']

# QuestSteps — expect pagination
curl -s https://metravel.by/api/quests/steps/ \
  | python -c "import sys,json; d=json.load(sys.stdin); print(list(d.keys()))"

# Unit test
python manage.py test quests.tests.test_views.QuestPaginationTestCase -v 2
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
