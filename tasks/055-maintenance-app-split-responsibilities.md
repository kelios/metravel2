# TASK-20260609-055: Split maintenance app into cohesive domain apps

Status: Backlog
Owner: Backend
Support: Developer (BE), Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Decompose the `maintenance` app — which currently bundles image serving, upload, gallery, feedback, AI-chat, sitemap, metrics, and ops config — into cohesive apps with a single responsibility each, while preserving all URL contracts.

## Context

`maintenance/views.py` (581 lines) covers at least five distinct domains:

- Lines 39–248: image serving, resize, cache
- Lines 250–382: authenticated upload with permission checks
- Lines 428–527: gallery reorder and delete
- Lines 385–427: feedback email
- Lines 528+: AI-chat proxy

Additional unrelated responsibilities: `sitemap.py`, `metrics_collector.py`, `SystemConfig`, `ServerInfo`.

This low cohesion makes the app hard to test in isolation, hard to deploy independently, and creates an implicit dependency chain (`travels` → `maintenance`, see TASK-20260609-058). The image upload/gallery code is the most entangled.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] A new `media` app (or equivalent name) owns: image serving, image upload, gallery CRUD/reorder.
- [ ] A new `feedback` app (or a lightweight module) owns: feedback email endpoint.
- [ ] AI-chat is moved to a dedicated app or to a relevant domain app (`travels`, `assistant`).
- [ ] `maintenance` retains only ops-level concerns: `SystemConfig`, `ServerInfo`, `metrics_collector`, `sitemap`.
- [ ] All existing URL paths remain reachable (HTTP 200/301/302 for known endpoints); no 404 regressions.
- [ ] `travels` app no longer imports directly from `maintenance` for gallery/image models (see TASK-20260609-058).
- [ ] All moved views are covered by at least smoke-level tests in their new location.

## Gherkin Tests

```gherkin
Feature: maintenance app decomposition preserves URL contracts

  Scenario: Image serving endpoint still works after move to media app
    Given the media app is installed and URLs are registered
    When a GET request is made to the existing image-serving URL
    Then the response status is 200 and the image is returned

  Scenario: Upload endpoint reachable under its existing path
    Given an authenticated user with upload permission
    When a POST request is made to the existing upload URL
    Then the response status is 200 or 201 (not 404)

  Scenario: Feedback endpoint reachable after move
    Given a valid feedback payload
    When a POST request is made to the existing feedback URL
    Then the response status is 200 (not 404)

  Scenario: maintenance app no longer contains image/upload views
    Given the refactored codebase
    When maintenance/views.py is inspected
    Then it contains no image-serving, upload, or gallery logic
```

## Assignment

Primary owner: Backend developer
Support agents: Tester (URL regression suite), Reviewer (import graph / circular dep check), Releaser (migration + deploy ordering)

## Likely Files Or Areas

- `maintenance/views.py`
- `maintenance/urls.py`
- `maintenance/models.py` (SystemConfig, TravelGallery — the latter moves to media/travels)
- `maintenance/sitemap.py`
- `maintenance/metrics_collector.py`
- New app: `media/` (views, urls, models, serializers, tests)
- New app or module: `feedback/`
- `travels/models.py:319` (M2M to TravelGallery — adjust import after model move)
- `metravel/settings.py` INSTALLED_APPS
- Root `urls.py`

## Plan

1. Create `media` app; move image-serving, upload, and gallery views + models into it.
2. Register `media` URLs under the same paths as before (use `include` + path aliases).
3. Create `feedback` app or module; move `FeedbackView` into it.
4. Move AI-chat view to a suitable domain app.
5. Update `travels/models.py` gallery M2M to reference `media.TravelGallery` (or `travels.TravelGallery` if moved there per TASK-058).
6. Strip `maintenance` down to ops: `SystemConfig`, `ServerInfo`, `metrics_collector`, `sitemap`.
7. Add/update `INSTALLED_APPS` and root URL conf.
8. Write smoke tests for all moved endpoints.
9. Run full test suite; fix regressions.

## Validation

```bash
# Confirm no 404s on known endpoints after refactor
python manage.py show_urls | grep -E "upload|gallery|feedback|image"

# Smoke-test image serving
curl -I https://metravel.by/api/image/<known-id>/

# Smoke-test upload (authenticated)
curl -s -X POST -H "Authorization: Token <token>" https://metravel.by/api/upload/ -F "file=@test.jpg" | jq .status

# Full test suite
pytest tests/ -x -q

# Check no circular imports
python -c "import metravel.urls"
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
