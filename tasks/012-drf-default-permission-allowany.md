# TASK-20260609-012: Set DRF default permission class to prevent open mutations

Status: In Progress
Owner: Backend
Support: Frontend Developer, Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Set a safe DRF default permission class so that any ViewSet without an explicit
`permission_classes` declaration does not silently become open to anonymous writes.

## Context

Security review 2026-06-09. `metravel/envs/common/settings.py:68-73` — `REST_FRAMEWORK`
block defines only `DEFAULT_AUTHENTICATION_CLASSES`; there is no `DEFAULT_PERMISSION_CLASSES`.
DRF's built-in default is `AllowAny`, meaning every ViewSet that omits `permission_classes`
is fully open to anonymous callers, including mutating endpoints (POST/PUT/PATCH/DELETE).

The fix is a single settings entry plus a targeted audit to confirm that purely public
read-only endpoints have explicit `AllowAny` and that all mutable endpoints have at least
`IsAuthenticated` or a stricter class.

No front-end contract changes are expected for read-only list/retrieve endpoints that stay
public. Mutable endpoints that were accidentally public will start returning 401/403 for
anonymous callers — this may surface in `api/*/Queries.ts` if any mutation was issued without
a token; check `api/travelMutationQueries.ts`, `api/userQueries.ts`, `api/commentQueries.ts`.

Source task:

- Source id:
- Source path: backend security review 2026-06-09

## Acceptance Criteria

- [ ] `REST_FRAMEWORK` in `metravel/envs/common/settings.py` contains
      `DEFAULT_PERMISSION_CLASSES = ['rest_framework.permissions.IsAuthenticatedOrReadOnly']`.
- [ ] A full-text audit of all ViewSets and APIViews confirms that every mutable endpoint
      (POST/PUT/PATCH/DELETE) requires at least `IsAuthenticated`.
- [ ] Public read-only endpoints (travel list, travel detail, article list, etc.) remain
      accessible without a token and return the same payload as before.
- [ ] Attempting POST/PUT/PATCH/DELETE on any mutable endpoint without a token returns
      HTTP 401 or 403.
- [ ] Django test suite passes with no regressions after the change.

## Gherkin Tests

```gherkin
Feature: DRF default permission class prevents anonymous mutations

  Scenario: Anonymous user cannot create a travel
    Given no authentication token is provided
    When the client sends POST /api/travels/
    Then the response status is 401 or 403

  Scenario: Anonymous user can still read the travel list
    Given no authentication token is provided
    When the client sends GET /api/travels/
    Then the response status is 200 and the travel list is returned

  Scenario: Authenticated user can create a travel
    Given a valid authentication token is provided
    When the client sends POST /api/travels/ with valid payload
    Then the response status is 201 and the travel is created
```

## Assignment

Primary owner: Backend developer — settings change + ViewSet audit.
Support agents: Frontend developer to verify that mutation calls in `api/*/Queries.ts`
always attach a token; Tester to run regression suite.

## Likely Files Or Areas

- `metravel/envs/common/settings.py` (REST_FRAMEWORK block, lines 68-73)
- All files matching `*/views.py` — audit ViewSets for missing permission_classes
- `*/urls.py` — cross-check routed views
- Frontend (this repo): `api/travelMutationQueries.ts`, `api/userQueries.ts`,
  `api/commentQueries.ts` — confirm tokens are always sent on mutations

## Plan

1. Add `DEFAULT_PERMISSION_CLASSES = ['rest_framework.permissions.IsAuthenticatedOrReadOnly']`
   to `REST_FRAMEWORK` in `metravel/envs/common/settings.py`.
2. Run `grep -r "permission_classes" --include="*.py"` across the backend to enumerate
   every explicit override.
3. For each ViewSet without an explicit override, verify it is safe under `IsAuthenticatedOrReadOnly`.
4. Add explicit `permission_classes = [AllowAny]` only where truly public write access is
   intentional (should be zero cases).
5. Run the Django test suite; fix any test that was relying on unauthenticated POST.
6. Deploy to staging, run smoke tests against all major mutation endpoints.

## Validation

```bash
# Anonymous POST must be rejected
curl -s -o /dev/null -w "%{http_code}" -X POST https://metravel.by/api/travels/ \
  -H "Content-Type: application/json" -d '{}'
# Expected: 401 or 403

# Anonymous GET must succeed
curl -s -o /dev/null -w "%{http_code}" https://metravel.by/api/travels/
# Expected: 200

# Authenticated POST must succeed (replace TOKEN)
curl -s -o /dev/null -w "%{http_code}" -X POST https://metravel.by/api/travels/ \
  -H "Authorization: Token TOKEN" -H "Content-Type: application/json" -d '{...}'
# Expected: 201 or 400 (validation), not 401/403
```

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-09: Created from backend security review finding [CRITICAL].
- 2026-06-09: Implemented in backend repo (code changes).

## Results

Changed files:

- `metravel/envs/common/settings.py` — added
  `DEFAULT_PERMISSION_CLASSES = ['rest_framework.permissions.IsAuthenticatedOrReadOnly']`
  to `REST_FRAMEWORK`.
- `users/views.py` — imported `AllowAny`; added explicit `permission_classes=[AllowAny]`
  to the public auth/account POST actions that have no token: `login`, `google_login`,
  `registration`, `reset_password_link`, `set_password_after_reset`, `confirm_registration`.
- `maintenance/views.py` — imported `AllowAny`; added `permission_classes = [AllowAny]`
  to `FeedbackView` (public contact form POST) and `ChatView` (public AI proxy POST) to
  preserve current anonymous frontend flows.

Audit (views and the permission they now resolve to):

- Public read-only, safe under default `IsAuthenticatedOrReadOnly` (no change needed):
  `ArticlesViewSet` (list/retrieve), `TravelViewSet` list/retrieve/popular/facets/random/
  of_month/resolve_slug/get_by_slug/travels_near/travels_for_map/user_rating GET actions,
  `instagram_oauth_callback` (GET, Instagram redirect — must stay anonymous), `routes` GET
  branch + `route_download` (GET, internal `_can_read_route_files` check kept),
  `TravelSearchViewSet`, `TravelFiltersView`, `CountriesForSearch`, `Countries`,
  `MapFilterView`, `SpectacularAPIView` (schema), `UserViewSet.get_profile` (GET),
  cached image function-views (plain Django, not DRF).
- Already explicit before this task (verified intact): `TravelCommentThreadViewSet`
  (`AllowAny`), `TravelCommentViewSet` (`get_permissions`: AllowAny read / IsAuthenticated
  write), `QuestViewSet`/`QuestCityViewSet`/`QuestStepViewSet`/`QuestFinaleViewSet`
  (`AdminWritePermissionMixin`: AllowAny read / IsAdminUser write), `QuestProgressViewSet`
  (IsAuthenticated), `UserPointViewSet` (IsAuthenticated), `MessageThreadViewSet` /
  `MessageViewSet` (IsAuthenticated), `GalleryImageView` (IsAuthenticated), and the
  per-action `IsAuthenticated` overrides across `TravelViewSet` and `UserViewSet`.
- Newly relying on the default to BLOCK anonymous writes (intended fix, no override added):
  `TravelViewSet` create/update/partial_update/destroy, `routes` POST branch. These now
  return 401/403 to anonymous callers instead of the previous open access.
- Explicit `AllowAny` added by this task (listed above): 6 `UserViewSet` actions +
  `FeedbackView` + `ChatView`. `FilesView` upload is locked by task 013 (IsAuthenticated).

Validation evidence:

- `python -m py_compile` of all changed files: OK.
- AST import check: `AllowAny` present in `users/views.py` and `maintenance/views.py`.
- Full `manage.py check` / pytest not runnable here (no `uv`/GDAL/PostGIS on this host;
  needs Docker stack). verify pending: owner to run `make test` (auth/users/travels/
  comments/upload) and `GET /api/schema/`.

Reviewer findings:

Release notes:

Blockers:

- Frontend coordination: mutation calls in `api/*` must always attach `Authorization: Token`.
  Verified `api/misc.ts` sends token on `upsert`/`uploadImage`/`reorderGallery`/`deleteImage`
  and sends NO token on `sendFeedback`/`sendAIMessage` (both now covered by `AllowAny`).
- Owner: run backend test suite + schema build before deploy to confirm no public GET broke.
