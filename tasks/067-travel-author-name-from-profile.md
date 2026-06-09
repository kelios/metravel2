# TASK-20260609-067: Travel serializer should use Profile first/last name for userName

Status: Backlog
Owner: Backend
Support: Developer (FE), Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Make the travel `userName` field show the author's real name (`Profile.first_name + last_name`) when it exists, falling back to `User.name` only when the profile name is empty. Right now the travel sidebar author (e.g. on `metravel.by/travels/lysaya-gora-342m`) shows the bare `User.name` (e.g. "Julia") even when the author filled in their first/last name in the profile.

## Context

Backend read-only review on 2026-06-09 (`../metravel-backend`):

- Serializer: `travels/serializers.py`, class `TravelSerializer`, method `get_user_name` (≈line 136):
  ```python
  def get_user_name(self, data):
      return ', '.join([item.name for item in data.users.all()])
  ```
  It returns `User.name` for each linked user, ignoring the profile entirely.
- `RetrieveTravelSerializer` (≈line 185) inherits this `get_user_name` and re-declares `userName` (≈line 192), so a single fix covers both list and detail responses.
- Author real name lives on the `Profile` model (`users/models.py:58-65`): `first_name`, `last_name` (both nullable/blank). Relation `user.profile` (OneToOne, related_name `profile`).
- The **comment** serializer already does exactly this and is the reference implementation — `travel_comments/serializers.py:48` `get_user_name`: prefers `profile.first_name + last_name`, falls back to `obj.user.name`, using `getattr(obj.user, 'profile', None)` (safe because Django's reverse-OneToOne `RelatedObjectDoesNotExist` subclasses `AttributeError`).
- N+1 warning: the travel querysets prefetch `'users'` but **not** `'users__profile'` (`travels/views.py:438-448` list/by-slug mixin and `travels/views.py:1248-1252` `TravelViewSet`). Accessing `user.profile` per user without the prefetch adds a query per author — add `'users__profile'` to both `prefetch_related(...)` calls.

Frontend (this repo, **no change needed**):

- `components/travel/compactSideBar/parts/AuthorBlock.tsx` renders `displayName = userName || 'Пользователь'`.
- `userName` is read from `travel.userName` in `components/travel/CompactSideBarTravel.tsx:139`, normalized from the API `user_name`/`userName` field in `api/travelsNormalize.ts:203-205`. The FE already renders whatever `userName` the API sends — it just needs the API to send the profile name.

## Acceptance Criteria

- [ ] `TravelSerializer.get_user_name` returns `Profile.first_name + last_name` (trimmed, single space) when at least one is non-empty.
- [ ] Falls back to `User.name` when the profile is missing or both name parts are empty.
- [ ] `RetrieveTravelSerializer` (travel detail / by-slug) returns the same value (inherited).
- [ ] Multi-author travels keep the `', '.join(...)` behavior, each author resolved independently.
- [ ] No N+1: `'users__profile'` added to the `prefetch_related(...)` in both `travels/views.py` querysets.
- [ ] Reference parity with `travel_comments/serializers.py` `get_user_name` (consider extracting a shared helper rather than duplicating the logic).

## Gherkin Tests

```gherkin
Feature: Travel serializer returns author display name

  Scenario: Author with a filled profile name
    Given a travel whose author Profile.first_name="Юлия" and last_name="Игнатьева"
    When GET /api/travels/by-slug/<slug> is requested
    Then "userName" equals "Юлия Игнатьева"

  Scenario: Author with an empty profile name
    Given a travel whose author Profile.first_name="" and last_name=""
    When the travel is requested
    Then "userName" equals the author's User.name

  Scenario: Author without a profile
    Given a travel whose author has no Profile row
    When the travel is requested
    Then "userName" equals the author's User.name
```

## Assignment

Primary owner: Backend
Support agents: Tester — backend test for the three name states; Developer (FE) — verify the rendered sidebar after the field lands (no production FE change).

## Likely Files Or Areas

- `travels/serializers.py` — `get_user_name` (and a shared `_user_display_name` helper).
- `travels/views.py` — add `'users__profile'` to the two `prefetch_related(...)` calls (≈lines 438-448 and 1248-1252).
- `tests/travels/test_by_slug_api.py` — add three `userName` cases (profile name / empty profile / no profile).
- `travel_comments/serializers.py` — reference implementation to mirror / share a helper with.

## Plan

1. Add a `_user_display_name(user)` helper that prefers `profile.first_name + last_name`, falls back to `user.name` (mirror `travel_comments/serializers.py:48`).
2. Use it in `TravelSerializer.get_user_name` over `data.users.all()`.
3. Add `'users__profile'` to both `prefetch_related(...)` querysets in `travels/views.py`.
4. Backend test in `tests/travels/test_by_slug_api.py`: profile name → "Юлия Игнатьева"; empty profile → `User.name`; no profile → `User.name`.
5. FE follow-up (this repo): none required — just confirm the sidebar shows the real name after deploy.

## Validation

- `GET /api/travels/by-slug/<slug>` returns `userName` = profile name when set, else `User.name`.
- Backend test covering all three name states passes.
- No extra SQL query per author (assert query count or inspect with `prefetch_related('users__profile')`).

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-09: Created. Root cause confirmed: `TravelSerializer.get_user_name` returns `User.name` and ignores `Profile.first_name/last_name`. Frontend already renders whatever `userName` the API sends (`AuthorBlock`/`CompactSideBarTravel`), so this is backend-only. Mirror the already-shipped comment-author logic (`travel_comments/serializers.py:48`, TASK-20260607-008 / BE-018).

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
