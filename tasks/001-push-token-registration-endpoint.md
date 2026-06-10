# TASK-20260610-073: Add POST /api/user/push-token/ endpoint for Expo push token registration

Status: Backlog
Owner: Backend
Support: Frontend
Created: 2026-06-10
Updated: 2026-06-10

## Goal

Implement a `POST /api/user/push-token/` endpoint that accepts an Expo push token and
platform identifier from an authenticated mobile client and persists it so the backend can
send push notifications to the device.

## Context

The frontend (`D:\metravel\metravel2`) already ships the full push notification flow
(AND-05). On first permission grant the hook calls `registerPushTokenApi`:

- **File:** `api/auth.ts:40,418-440`
  - URL constant: `PUSH_TOKEN = ${URLAPI}/user/push-token/` (line 40)
  - Method: `POST`
  - Headers: `Authorization: Token <token>`, `Content-Type: application/json`
  - Body: `{ push_token: string, platform: "ios" | "android" }`

The call happens inside `hooks/usePushNotifications.native.ts:58` (`void registerPushTokenApi(token)`).
It is fire-and-forget (`void`) and silently swallows errors, so the app does not crash — but
push delivery is entirely broken on prod because the server never stores the token.

**Backend diagnosis (origin/master, read-only):**

- `users/urls.py` — `user_router.register('user', UserViewSet, basename='user')`. No push-token
  action registered. (`git show origin/master:users/urls.py`)
- `users/views.py` — exhaustive grep for `push`, `push_token`, `device` returned zero matches.
  No `@action` for this path exists.
- `users/models.py` — grep for `push`, `device`, `expo`, `fcm` returned zero matches. No
  `DeviceToken` model or push-token field on `Profile`.
- `metravel/envs/common/urls.py` — `user_router` is the only user-namespace router; no
  standalone `push-token` path.

**Prod GET-probe (read-only):**

```
GET https://metravel.by/api/user/push-token/  →  404
```

A 404 (not 401/405) confirms the route does not exist at all; DRF would return 405 for a
known path with a disallowed method, and 401 for an auth-gated unknown method — pure 404 means
the URL pattern is absent from the router.

Source task: diagnosed 2026-06-10 by backend-expert agent.

## Acceptance Criteria

- [ ] New model `DeviceToken` (or equivalent field on `Profile`) stores at minimum:
      `user` (FK → User), `push_token` (unique CharField), `platform` (choices: ios/android),
      `created_at`, `updated_at`. PostGIS fields not involved — no PostGIS change.
- [ ] Django migration generated via `makemigrations` and not edited after creation.
- [ ] `UserViewSet` gains a new `@action(methods=['post'], detail=False, url_path='push-token',
      permission_classes=[IsAuthenticated], authentication_classes=[TokenAuthentication])`.
      Path resolves to `POST /api/user/push-token/`.
- [ ] Endpoint upserts the token for the authenticated user (if the same `push_token` value
      arrives again, update `platform`/`updated_at` rather than creating a duplicate row).
- [ ] Returns `201` on create, `200` on update; both with `{"status": "ok"}` or similar.
- [ ] Returns `400` for missing/blank `push_token` or unknown `platform`.
- [ ] Returns `401` when no auth token is supplied.
- [ ] Unit tests cover: happy-path create, upsert/update, missing field → 400, anon → 401.
- [ ] No new dependency needed; uses only existing DRF + Django ORM.

## Gherkin Tests

```gherkin
Feature: Expo push token registration

  Scenario: Authenticated user registers a push token
    Given the user is authenticated with a valid Token
    When POST /api/user/push-token/ with body {"push_token": "ExponentPushToken[xxx]", "platform": "ios"}
    Then the response status is 201
    And the response body contains {"status": "ok"}
    And a DeviceToken row exists for this user with push_token="ExponentPushToken[xxx]"

  Scenario: Same token sent twice (upsert)
    Given a DeviceToken row already exists with push_token="ExponentPushToken[xxx]"
    When POST /api/user/push-token/ with the same push_token and platform="android"
    Then the response status is 200
    And no duplicate DeviceToken row is created
    And the existing row's platform is updated to "android"

  Scenario: Missing push_token field
    Given the user is authenticated
    When POST /api/user/push-token/ with body {"platform": "ios"}
    Then the response status is 400

  Scenario: Unauthenticated request
    When POST /api/user/push-token/ with no Authorization header
    Then the response status is 401
```

## Assignment

Primary owner: Backend (Sergey/Codex)
Support agents: Frontend (verify the existing `registerPushTokenApi` call works after deploy)

## Likely Files Or Areas

- `users/models.py` — add `DeviceToken` model
- `users/migrations/` — new migration (auto-generated, do not edit)
- `users/views.py` — new `@action push_token` on `UserViewSet`
- `users/serializers.py` — new `PushTokenSerializer` (or inline validation in the action)
- `tests/users/` — new test file `test_push_token_api.py`

## Plan

1. Add `DeviceToken(user FK, push_token unique, platform choices, created_at, updated_at)`
   to `users/models.py`; register in `users/admin.py`.
2. Run `python manage.py makemigrations users`; do not edit the generated file.
3. Add `PushTokenSerializer` in `users/serializers.py` with field validation
   (`push_token` required non-blank, `platform` in `{'ios','android'}`).
4. Add `@action(methods=['post'], detail=False, url_path='push-token',
   permission_classes=[IsAuthenticated], authentication_classes=[TokenAuthentication])`
   to `UserViewSet` in `users/views.py`:
   - Deserialize + validate request body.
   - `DeviceToken.objects.update_or_create(push_token=..., defaults={user, platform, updated_at})`.
   - Return `201`/`200` accordingly.
5. Write unit tests in `tests/users/test_push_token_api.py` covering the four Gherkin scenarios.
6. Run `pytest tests/users/test_push_token_api.py` — all green.

## Validation

After deploy to prod, the frontend team verifies:

```
# Should return 401 (route exists, auth required):
curl -s -o /dev/null -w "%{http_code}" -X POST https://metravel.by/api/user/push-token/ \
  -H "Content-Type: application/json" -d '{"push_token":"test","platform":"ios"}'
# Expected: 401

# With a real token (owner runs this):
curl -s -w "%{http_code}" -X POST https://metravel.by/api/user/push-token/ \
  -H "Authorization: Token <owner_token>" \
  -H "Content-Type: application/json" \
  -d '{"push_token":"ExponentPushToken[test]","platform":"ios"}'
# Expected: 201 {"status": "ok"}
```

Also: install the app on a real device, grant notification permission, observe no silent
failure in the native logs — the `registerPushTokenApi` call should log no errors.

FE note: no frontend changes required. The existing `api/auth.ts:registerPushTokenApi` already
sends the correct payload; it will start succeeding once the backend endpoint is live.

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Migration file is present and not manually edited.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-10: Created. Diagnosed: endpoint absent from origin/master; prod GET /api/user/push-token/ → 404.

## Results

Changed files:

Validation evidence:

Reviewer findings:

Release notes:

Blockers:
