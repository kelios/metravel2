# TASK-20260609-066: Comment serializer should return user_avatar

Status: Backlog
Owner: Backend
Support: Developer (FE), Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Add a `user_avatar` field to the travel-comment serializer so the comment list/detail returns the author's profile avatar URL. The frontend already renders an avatar with a letter-monogram fallback (`components/travel/CommentItem.tsx`), but the API never sends `user_avatar`, so every comment shows the letter placeholder (the "Р" monogram for the "Редакция metravel" editor account looks like a missing icon).

## Context

Backend read-only review on 2026-06-09 (`../metravel-backend`):

- Serializer: `travel_comments/serializers.py`, class `TravelCommentSerializer` (≈line 14). Current `Meta.fields`: `id`, `thread`, `sub_thread`, `user`, `user_name` (`SerializerMethodField` → `obj.user.profile.first_name + last_name`, fallback `obj.user.name`), `text`, `created_at`, `updated_at`, `likes_count` (`IntegerField(source='likes.count')`). **No `user_avatar`.**
- `TravelCommentTreeSerializer` (≈line 46) inherits `Meta.fields`, so nested `replies` get `user_avatar` automatically once added to the parent.
- Avatar source of truth is the `Profile` model (`users/models.py:72-76`): `avatar` (ImageField on S3) and `external_avatar` (URLField, used for Google/social sign-in). Relation `obj.user.profile` (related_name `profile`).
- Canonical avatar-URL builder: `ProfileSerializer._avatar_proxy_url` (`users/serializers.py:209-224`) plus the `external_avatar` fallback in `ProfileSerializer.to_representation` (`users/serializers.py:226-233`). Local S3 avatars are served via the proxy prefix `/avatar/<path>` and absolutized to `scheme://host` from the request (`SCHEMA_HOST` + `normalize_public_host`); empty proxy URL → fall back to `external_avatar`.

Frontend (this repo, already done — no further FE work needed once the field arrives):

- `types/comments.ts:19` already declares `user_avatar?: string`.
- `components/travel/CommentItem.tsx` renders `<Image>` from `comment.user_avatar` via `optimizeImageUrl(...)`, with `onError` + empty-value fallback to the letter monogram.
- e2e mocks (`e2e/travel-comments.spec.ts`) currently send `user_avatar: null` — update them to cover a non-null avatar once the backend ships.

## Acceptance Criteria

- [ ] `TravelCommentSerializer` exposes `user_avatar` (added to `Meta.fields` and `read_only_fields`).
- [ ] `get_user_avatar` reuses the `ProfileSerializer` avatar logic: proxy URL from `Profile.avatar` first, then `external_avatar`, else `None`; absolute URL built from the request context (same scheme/host rules as `_avatar_proxy_url`).
- [ ] Nested `replies` (via `TravelCommentTreeSerializer`) also carry `user_avatar`.
- [ ] `GET /api/travel-comments/?travel_id=...` and `POST /api/travel-comments/` both return `user_avatar` for the author.
- [ ] No N+1: the comment queryset `select_related('user__profile')` (avatar lives on profile) so building avatars does not add a query per comment.
- [ ] The ViewSet passes `request` into the serializer context (DRF default) so the URL is absolute, not relative `/avatar/...`.

## Gherkin Tests

```gherkin
Feature: Comment serializer returns author avatar

  Scenario: Author with an uploaded avatar
    Given a user whose Profile.avatar is set
    When GET /api/travel-comments/?travel_id=362 is requested
    Then each comment by that user has "user_avatar" as an absolute https URL under /avatar/

  Scenario: Author with only a social (external) avatar
    Given a user whose Profile.avatar is empty but Profile.external_avatar is set
    When the comment list is requested
    Then "user_avatar" equals the external_avatar URL

  Scenario: Author with no avatar
    Given a user whose Profile has neither avatar nor external_avatar
    When the comment list is requested
    Then "user_avatar" is null
```

## Assignment

Primary owner: Backend
Support agents: Developer (FE) — refresh e2e mocks + verify rendering; Tester.

## Likely Files Or Areas

- `travel_comments/serializers.py` — add `user_avatar` SerializerMethodField + `get_user_avatar`.
- `travel_comments/views.py` — confirm serializer context has `request`; add `select_related('user__profile')` to the comment queryset.
- `users/serializers.py` — source of the avatar-URL helper to reuse (consider extracting a shared helper rather than duplicating).

## Plan

1. Extract or reuse the `_avatar_proxy_url` + `external_avatar` fallback logic so `TravelCommentSerializer.get_user_avatar` produces the same URLs as `ProfileSerializer`.
2. Add `user_avatar` to `TravelCommentSerializer` fields; verify `TravelCommentTreeSerializer.replies` inherit it.
3. Add `select_related('user__profile')` to the comment queryset to avoid N+1.
4. Backend test: three cases (uploaded avatar / external only / none) per Gherkin.
5. Frontend follow-up (this repo): update `e2e/travel-comments.spec.ts` mocks to a non-null avatar and assert the image renders; no production FE code change required (already implemented).

## Validation

- `GET /api/travel-comments/?travel_id=...` returns `user_avatar` for an author with an avatar; null for one without.
- Confirm absolute URL (scheme+host) when a request context is present.
- Backend test covering all three avatar states.

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-09: Created. Frontend rendering already shipped in this repo (`components/travel/CommentItem.tsx` renders `comment.user_avatar` with letter-monogram fallback); blocked on backend adding the field. Related to BE-018/TASK-20260607-008 (comment `user_name` from Profile) and BE-016/TASK-20260605-007 (avatar URL generation).

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
