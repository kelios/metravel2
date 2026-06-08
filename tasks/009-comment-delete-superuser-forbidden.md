# TASK-20260608-009: Superuser cannot DELETE another user's comment (403)

Status: Backlog
Owner: Backend
Support: Frontend Developer, Tester, Reviewer
Created: 2026-06-08
Updated: 2026-06-08

## Goal

Allow a superuser (`is_superuser=true`) to delete any `TravelComment`, including comments authored by other users. Currently the backend authenticates the superuser but the comment `DELETE` permission rejects the request with `403 Forbidden`, so site moderation is impossible from the UI.

## Context

Production repro on 2026-06-08, owner account "Julia" (the site owner, reported as a superuser by the backend's own profile/login response — the frontend only renders the "Удалить (Админ)" label when `is_superuser=true`, see `components/travel/CommentItem.tsx:39`):

1. The travel `krakov-karer-zakshuvek` comment list renders a comment authored by another user (`Sergey Savran`).
2. The frontend shows the admin delete control "Удалить (Админ)" because the logged-in user's profile has `is_superuser=true`.
3. Clicking delete fires `DELETE https://metravel.by/api/travel-comments/3/` with header `Authorization: Token <owner token>`.
4. Response: **`403 Forbidden`**, `Content-Type: application/json`. Response `Allow` header lists `GET, PUT, PATCH, DELETE, HEAD, OPTIONS` — i.e. `DELETE` is a permitted method on the route, but this authenticated user is not authorized.

This is an internal backend contradiction: the same backend reports the user as a superuser (profile/login `is_superuser=true`) yet the `TravelComment` viewset's object-level permission only allows the comment's own author, with no superuser/staff override.

The frontend is correct and needs no change:
- It sends the `Authorization: Token` header on `DELETE` (`api/client.ts:299-300`, `588-590`).
- It derives the admin delete affordance from the backend-provided `is_superuser` (`stores/authStore.ts:227`, `components/travel/CommentItem.tsx:36,39`).
- It surfaces the failure as a toast on 403 (`hooks/comments/commentMutations.ts:82-88`).

Related files (frontend, for reference only — no change required):

- `api/comments.ts` — `deleteComment` → `DELETE /travel-comments/{id}/`.
- `components/travel/CommentItem.tsx` — `canDelete = (isAuthor || isSuperuser)`.
- `e2e/travel-comments.spec.ts` — "Admin users → should be able to delete any comment" asserts a `204` for an admin DELETE, but runs against a Playwright route mock, so it does not catch the real-backend 403.

## Acceptance Criteria

- [ ] `DELETE /api/travel-comments/{id}/` by a user with `is_superuser=true` returns `204` for a comment authored by another user.
- [ ] `DELETE /api/travel-comments/{id}/` by the comment's own author continues to return `204`.
- [ ] `DELETE /api/travel-comments/{id}/` by a non-author, non-superuser still returns `403`.
- [ ] The permission check is consistent with the `is_superuser` flag the backend already returns in the profile/login response.
- [ ] Backend regression test covers superuser-deletes-other, author-deletes-own, and stranger-forbidden cases.

## Gherkin Tests

```gherkin
Feature: Superuser can delete any comment

  Scenario: Superuser deletes another user's comment
    Given an authenticated user whose profile has is_superuser=true
    And a comment id=3 authored by a different user
    When the user sends DELETE /api/travel-comments/3/ with their Token
    Then the response status is 204
    And GET /api/travel-comments/?travel_id=... no longer returns comment id=3

  Scenario: Regular user cannot delete another user's comment
    Given an authenticated user whose profile has is_superuser=false
    And a comment authored by a different user
    When the user sends DELETE for that comment
    Then the response status is 403
```

## Assignment

Primary owner: Backend
Support agents: Frontend Developer (confirm no FE change needed), Tester (add real-backend e2e probe)

## Likely Files Or Areas

- Backend `TravelComment` viewset / `get_permissions` / object-level permission class (e.g. `IsAuthorOrReadOnly`) — add `or request.user.is_superuser` to the delete branch.

## Plan

1. Update the comment delete permission to allow `request.user.is_superuser` (and/or `is_staff`) in addition to the author.
2. Add backend tests for the three cases in Acceptance Criteria.
3. Tester: replace/augment the mocked e2e assertion with a real-backend probe (owner token) once available, so the 403 regression is caught against the live API.
4. Frontend: no change required.

## Validation

- Re-run the repro from Context: superuser `DELETE /api/travel-comments/{id}/` of another user's comment must return `204`.
- Confirm non-author non-superuser still gets `403`.

## Progress Log

- 2026-06-08: Created. Reproduced on prod (metravel.by) — owner/superuser DELETE of comment id=3 returns 403 with `Allow: …DELETE…`. Root cause is backend object-level permission missing a superuser override; frontend verified correct (sends Token, derives admin affordance from backend `is_superuser`, toasts on failure).

## Results

Changed files:

Validation evidence:

Reviewer findings:

Blockers:
