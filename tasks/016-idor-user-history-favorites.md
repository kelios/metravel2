# TASK-20260609-016: Fix IDOR in user history and favorites actions

Status: Backlog
Owner: Backend
Support: Frontend Developer, Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Prevent any authenticated user from reading or deleting another user's travel history,
favorites, and recommendations by enforcing the existing self-or-superuser ownership
check on all affected actions.

## Context

Security review 2026-06-09. `users/views.py` contains five actions that operate on a user
identified by `pk` from the URL:

- `history` (line 665) — GET, filters `user__id=pk`
- `clear_history` (line 684) — DELETE
- `clear_favorite` (line 693) — DELETE
- `favorite_travels` (line 701) — GET
- `recommended_travels` (line 719) — GET

The helper `_ensure_self_or_superuser(request, pk)` already exists at line 388 and raises
`PermissionDenied` (403) if the calling user is neither the target user nor a superuser.
However, none of the five actions above call it, creating an Insecure Direct Object
Reference (IDOR): any logged-in user can read or wipe another user's personal data by
substituting a different `pk` in the URL.

**Breaking change warning for frontend:** after the fix, requests for another user's `pk`
will return HTTP 403 instead of the current (incorrect) 200/204. Frontend code should only
ever request the authenticated user's own `pk`. Verify `api/userQueries.ts` and
`api/favoritesQueries.ts` — both should be using the session user's own id, not an
arbitrary `pk`.

Source task:

- Source id:
- Source path: backend security review 2026-06-09

## Acceptance Criteria

- [ ] `_ensure_self_or_superuser(request, pk)` is called at the start of `history`,
      `clear_history`, `clear_favorite`, `favorite_travels`, and `recommended_travels`.
- [ ] An authenticated user requesting another user's history or favorites by pk receives
      HTTP 403.
- [ ] An authenticated user requesting their own history or favorites by pk receives the
      correct 200/204 as before.
- [ ] A superuser can access any user's history and favorites (existing admin use-case).
- [ ] Frontend calls in `api/userQueries.ts` and `api/favoritesQueries.ts` use only the
      authenticated user's own id and are not broken by the new 403 responses.

## Gherkin Tests

```gherkin
Feature: User history and favorites are protected against IDOR

  Scenario: User cannot read another user's history
    Given user A is authenticated
    And user B has travel history
    When user A requests GET /api/users/<user_B_pk>/history/
    Then the response status is 403

  Scenario: User can read their own history
    Given user A is authenticated
    When user A requests GET /api/users/<user_A_pk>/history/
    Then the response status is 200 and only user A's history is returned

  Scenario: User cannot delete another user's favorites
    Given user A is authenticated
    When user A sends DELETE /api/users/<user_B_pk>/clear_favorite/
    Then the response status is 403

  Scenario: Superuser can access any user's history
    Given a superuser is authenticated
    When the superuser requests GET /api/users/<any_pk>/history/
    Then the response status is 200
```

## Assignment

Primary owner: Backend developer — add `_ensure_self_or_superuser` call to the five actions.
Support agents: Frontend developer to audit `api/userQueries.ts` and `api/favoritesQueries.ts`
for accidental cross-user pk usage; Tester for the IDOR scenarios.

## Likely Files Or Areas

- `users/views.py` lines 665, 684, 693, 701, 719 (the five actions)
- `users/views.py` line 388 (`_ensure_self_or_superuser` — reference)
- Frontend (this repo): `api/userQueries.ts`, `api/favoritesQueries.ts`,
  `stores/favoritesStore.ts` — confirm own-user pk is always used

## Plan

1. Open `users/views.py` and locate the five action methods.
2. Add `self._ensure_self_or_superuser(request, pk)` (or equivalent call) as the first
   statement of each action, before any queryset filtering.
3. Write tests: (a) cross-user access returns 403, (b) own-user access returns 200/204,
   (c) superuser access returns 200.
4. Review frontend `api/userQueries.ts` and `api/favoritesQueries.ts` — confirm the pk
   passed is always the authenticated user's own id.
5. Deploy to staging and run the test scenarios.

## Validation

```bash
# Obtain tokens for two different users (TOKEN_A, TOKEN_B) and their pks (PK_A, PK_B)

# User A reading user B's history must be 403
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Token TOKEN_A" \
  https://metravel.by/api/users/PK_B/history/
# Expected: 403

# User A reading own history must be 200
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Token TOKEN_A" \
  https://metravel.by/api/users/PK_A/history/
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
