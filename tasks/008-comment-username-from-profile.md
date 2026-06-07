# TASK-20260607-008: Comment user_name should follow Profile, not auth_user

Status: Backlog
Owner: Backend
Support: Frontend Developer, Tester, Reviewer
Created: 2026-06-07
Updated: 2026-06-07

## Goal

Make `TravelComment.user_name` reflect the user's editable `Profile.first_name`/`Profile.last_name` so a renamed profile (e.g. "Редакция metravel") appears under that name in comments. Currently the field is rendered from `auth_user.first_name + auth_user.last_name`, which has no public update endpoint and stays frozen to whatever Google OAuth wrote at first sign-in.

## Context

Production probe on 2026-06-07 with editor token (user_id=120, profile id=86):

1. `PUT /api/user/120/profile/update/` with `{"first_name":"Редакция","last_name":"metravel"}` → `200`, profile is updated:
   - `GET /api/user/120/profile/` → `{"id":86,"first_name":"Редакция","last_name":"metravel","user":120, …}`.
2. `POST /api/travel-comments/ {travel_id:362,text:"…"}` → `201` with `"user_name":"Sergey Savran"` (the pre-rename value).
3. `GET /api/travel-comments/?travel_id=362` continues to return `"user_name":"Sergey Savran"` even minutes after the profile rename.

The OpenAPI schema confirms `TravelComment.user_name` is `readOnly` (`components.schemas.TravelComment`). There is no public endpoint in the schema that updates `auth_user.first_name`/`auth_user.last_name`; only `/user/{id}/profile/update/` exists (updates the related Profile model, not the Django auth user).

Impact: an editorial team account cannot rebrand itself for comments without a backend or DBA change. The metravel.by SEO task that adds an "editor" comment under each of 293 articles for the author `ignatieva_julia@tut.by` currently has to publish under the original auth_user name; a soft-prefix workaround ("От редакции metravel:" inside the comment text) is in place but the author byline still reads the old name.

Related files (frontend):

- `api/comments.ts` — comment list/create.
- `types/comments.ts` — TravelComment type includes `user_name?: string`.
- `api/user.ts` — `updateUserProfile` calls `/user/{id}/profile/update/`.

## Acceptance Criteria

- [ ] `TravelComment.user_name` is built from the related Profile (`Profile.first_name + ' ' + Profile.last_name`), falling back to `auth_user.first_name + ' ' + auth_user.last_name` only when the Profile names are empty.
- [ ] `POST /api/travel-comments/` returns the updated `user_name` immediately after a `PUT /user/{id}/profile/update/` write — no stale cache.
- [ ] `GET /api/travel-comments/?travel_id=...` reflects the same source of truth (also Profile-first).
- [ ] An optional `PATCH /user/{id}/profile/update/` (or a `/user/{id}/auth-name/`) endpoint for symmetric updates is documented in the OpenAPI schema if backend chooses to also expose `auth_user.first_name`/`last_name` writes; otherwise the Profile-first contract above is sufficient.
- [ ] Regression test: rename a profile, post a comment, re-read the comment list, assert `user_name` matches the new profile name.

## Gherkin Tests

```gherkin
Feature: Comment user_name follows Profile

  Scenario: Renaming a profile updates comment author byline
    Given an authenticated user with profile id=86 (user_id=120) whose Profile.first_name was "Sergey" and Profile.last_name was "Savran"
    When the user PUTs /api/user/120/profile/update/ with {"first_name":"Редакция","last_name":"metravel"}
    And the user POSTs /api/travel-comments/ with {"travel_id":362,"text":"…"}
    Then the POST response body contains "user_name":"Редакция metravel"
    And a subsequent GET /api/travel-comments/?travel_id=362 also returns "user_name":"Редакция metravel" for the same comment
```

## Assignment

Primary owner: Backend
Support agents: Frontend Developer (verify no regression in comment rendering), Tester

## Likely Files Or Areas

- Backend `TravelCommentSerializer` (`user_name` field source)
- Backend Profile vs auth_user lookup helper (currently splits by `auth_user`)
- Optional: an admin/internal endpoint for symmetric `auth_user.first_name` writes if Profile-first is rejected as the contract

## Plan

1. Switch `TravelCommentSerializer.user_name` to read from the related Profile (`obj.user.profile.first_name + ' ' + obj.user.profile.last_name`), with `auth_user` fallback when Profile names are empty.
2. Re-verify on e2e: rename profile, post comment, GET comment list — `user_name` matches.
3. Update OpenAPI description for `TravelComment.user_name` to document the source.
4. Frontend: no changes required; this is a server-side rename.

## Validation

- Probe sequence from this task's Context section (steps 1-3) must show step 2/3 returning the renamed value.
- Add a backend test asserting Profile-first behaviour with both rename and empty-Profile cases.

## Progress Log

- 2026-06-07: Created. Reproduced on prod with editor token; soft-prefix workaround applied on frontend mass-augment script (`scripts/seo-mass-augment.js`) to compensate while this is open.

## Results

Changed files:

Validation evidence:

Reviewer findings:

Blockers:
