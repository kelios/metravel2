# TASK-20260609-013: Secure the image upload endpoint against unauthenticated access

Status: Done (verified 2026-06-09)
Owner: Backend
Support: Frontend Developer, Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Restrict `api/upload` so that only an authenticated owner or manager of the target travel
can upload or overwrite its images, preventing anonymous defacement of any travel record.

## Context

Security review 2026-06-09. `maintenance/views.py:250-362` (`FilesView.file_upload_view`),
routed at `api/upload` (`maintenance/urls.py:30`). The view has no
`authentication_classes` or `permission_classes` declarations, making it fully public.
It accepts `id` + `collection` in the request and directly overwrites the main image,
address images, or gallery images of any travel identified by numeric `id`.
The helper `_is_travel_manager` exists elsewhere in the codebase but is not called here.

Risk: an anonymous HTTP client can overwrite the cover image of any travel on the platform
with a single POST, effectively defacing the entire catalogue without credentials.

**Breaking change warning for frontend:** the upload contract at `api/upload` will start
requiring an `Authorization: Token <token>` header and will return 401 for unauthenticated
requests. Check `api/imageUploadQueries.ts` (or equivalent) to confirm the token is always
attached. If the web avatar upload or gallery editor calls this endpoint, they must already
be passing the token — verify and align.

Source task:

- Source id:
- Source path: backend security review 2026-06-09

## Acceptance Criteria

- [ ] `FilesView.file_upload_view` (or the DRF view wrapping it) declares
      `authentication_classes = [TokenAuthentication]` and
      `permission_classes = [IsAuthenticated]`.
- [ ] Before processing the upload, the view calls `_is_travel_manager` (or equivalent)
      to verify the requesting user owns or manages the target travel; returns 403 if not.
- [ ] An anonymous POST to `api/upload` returns HTTP 401.
- [ ] An authenticated POST from a user who does not own the target travel returns HTTP 403.
- [ ] An authenticated POST from the travel owner or manager succeeds as before (2xx).
- [ ] Existing frontend upload flows (avatar, gallery, travel cover) are not broken after
      the change (tokens were already attached or are now attached).

## Gherkin Tests

```gherkin
Feature: Image upload endpoint requires authentication and ownership

  Scenario: Anonymous upload is rejected
    Given no authentication token is provided
    When the client sends POST /api/upload with a valid image and an existing travel id
    Then the response status is 401

  Scenario: Authenticated non-owner upload is rejected
    Given a valid token for user A
    And the travel with the given id belongs to user B
    When user A sends POST /api/upload targeting that travel id
    Then the response status is 403

  Scenario: Owner upload succeeds
    Given a valid token for the travel owner
    When the owner sends POST /api/upload with a valid image and their travel id
    Then the response status is 200 or 201 and the image is stored
```

## Assignment

Primary owner: Backend developer — add authentication + ownership check to `FilesView`.
Support agents: Frontend developer to verify token attachment in upload calls
(`api/imageUploadQueries.ts` or equivalent); Tester for the three scenarios above.

## Likely Files Or Areas

- `maintenance/views.py` lines 250-362 (FilesView / file_upload_view)
- `maintenance/urls.py` line 30 (api/upload route)
- Backend ownership helper: `_is_travel_manager` (locate in `travels/` or `maintenance/`)
- Frontend (this repo): image/gallery upload API calls — confirm `Authorization` header
  is always sent

## Plan

1. Locate `file_upload_view` in `maintenance/views.py:250-362`.
2. Add `authentication_classes = [TokenAuthentication]` and
   `permission_classes = [IsAuthenticated]` to the view.
3. After authentication, call `_is_travel_manager(request.user, travel_id)` (or inline
   the equivalent check); return 403 if the check fails.
4. Add unit tests for the three scenarios (anon, non-owner, owner).
5. Coordinate with frontend to confirm upload token attachment; update `api/` call if needed.
6. Deploy to staging, run upload smoke test for avatar and gallery flows.

## Validation

```bash
# Anonymous upload must be rejected
curl -s -o /dev/null -w "%{http_code}" -X POST https://metravel.by/api/upload \
  -F "id=1" -F "collection=main" -F "file=@/tmp/test.jpg"
# Expected: 401

# Non-owner upload must be rejected (replace TOKEN_OTHER)
curl -s -o /dev/null -w "%{http_code}" -X POST https://metravel.by/api/upload \
  -H "Authorization: Token TOKEN_OTHER" \
  -F "id=1" -F "collection=main" -F "file=@/tmp/test.jpg"
# Expected: 403

# Owner upload must succeed (replace TOKEN_OWNER)
curl -s -o /dev/null -w "%{http_code}" -X POST https://metravel.by/api/upload \
  -H "Authorization: Token TOKEN_OWNER" \
  -F "id=1" -F "collection=main" -F "file=@/tmp/test.jpg"
# Expected: 200 or 201
```

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-09: Created from backend security review finding [CRITICAL].

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
