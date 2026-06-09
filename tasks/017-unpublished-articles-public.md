# TASK-20260609-017: Filter unpublished articles from public queryset

Status: Backlog
Owner: Backend
Support: Frontend Developer, Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Ensure that draft and unpublished articles are never exposed through the public API by
adding a publish-status filter to the article list and detail queryset.

## Context

Security review 2026-06-09. `articles/views.py:32` — `get_queryset` returns
`Article.objects.all()` with no publish/status filter. `articles/models.py:8,21` defines
a `publish` field (and possibly a `status` field). As a result, draft articles and
previously unpublished articles appear in the public list endpoint and are retrievable by
direct pk/slug — exposing content the author has not released.

**Potential breaking change for frontend:** if any frontend component currently lists or
displays articles by fetching raw `/api/articles/` without expecting the server to filter
by publish status, the count and ids returned will shrink after the fix. Verify
`api/articleQueries.ts` (or equivalent) — the change should be transparent if clients
only display what the server returns, but pagination offsets and total counts may shift.

Source task:

- Source id:
- Source path: backend security review 2026-06-09

## Acceptance Criteria

- [ ] `get_queryset` in the public `ArticleViewSet` (or equivalent) includes
      `.filter(publish=1)` (or the equivalent status-based filter).
- [ ] A draft article (publish=0 or status=draft) does not appear in `GET /api/articles/`.
- [ ] A direct `GET /api/articles/<pk>/` for a draft article returns HTTP 404 or 403.
- [ ] Published articles are still returned with the same payload as before.
- [ ] If an admin/staff endpoint for draft management exists, it is unaffected.

## Gherkin Tests

```gherkin
Feature: Unpublished articles are hidden from the public API

  Scenario: Draft article does not appear in the public list
    Given an article exists with publish=0 (draft)
    When the client requests GET /api/articles/
    Then the draft article is not present in the response

  Scenario: Direct access to a draft article is denied
    Given an article exists with publish=0 (draft)
    When the client requests GET /api/articles/<draft_pk>/
    Then the response status is 404 or 403

  Scenario: Published articles are still accessible
    Given an article exists with publish=1
    When the client requests GET /api/articles/
    Then the published article appears in the response
```

## Assignment

Primary owner: Backend developer — add publish filter to `ArticleViewSet.get_queryset`.
Support agents: Frontend developer to verify article list pagination/count assumptions in
`api/articleQueries.ts`; Tester to confirm draft exclusion and published-article presence.

## Likely Files Or Areas

- `articles/views.py` line 32 (`get_queryset`)
- `articles/models.py` lines 8, 21 (`publish` / `status` field definitions)
- Backend test fixtures: ensure at least one draft and one published article exist
- Frontend (this repo): `api/articleQueries.ts` — verify total-count assumptions

## Plan

1. Inspect `articles/models.py` to confirm the exact field name and published value
   (`publish=1`, `status='published'`, etc.).
2. Update `get_queryset` in `articles/views.py:32` to add the publish filter.
3. If there is a separate admin ViewSet for draft management, confirm it is unaffected
   (uses its own queryset or has staff-only permissions).
4. Add/update tests: draft not in list, draft 404 on detail, published article present.
5. Deploy to staging; verify article list and detail responses.

## Validation

```bash
# Create a draft article (publish=0) in the DB, note its pk as DRAFT_PK

# Draft must not appear in public list
curl -s "https://metravel.by/api/articles/" | python3 -m json.tool | grep '"id": DRAFT_PK'
# Expected: no output

# Direct access to draft must be 404
curl -s -o /dev/null -w "%{http_code}" "https://metravel.by/api/articles/DRAFT_PK/"
# Expected: 404

# Published article must still appear
curl -s -o /dev/null -w "%{http_code}" "https://metravel.by/api/articles/PUBLISHED_PK/"
# Expected: 200
```

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-09: Created from backend security review finding [HIGH].

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
