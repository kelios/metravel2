# TASK-20260609-026: Slim and paginate available_users endpoint; restrict sensitive profile fields

Status: Backlog
Owner: Backend
Support: Frontend Developer, Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Replace the unbounded full-profile dump in `available_users` with a slim serializer
(id, display name, avatar only), add pagination and name-based search, and prevent
enumeration of all users by any authenticated client.

## Context

`messaging/views.py:117-121` performs `Profile.objects.exclude(user_id=request.user.id)`
and passes the full queryset to `ProfileSerializer` configured with `fields='__all__'`
(`users/serializers.py:204-207`). No pagination class is applied.

Problems:
1. **Data leak**: every authenticated user receives all profile fields including social links,
   `email_notify_*` preference flags, and any internal fields present in `__all__`.
2. **Performance**: the response grows linearly with the user base; no cursor/page limit.
3. **User enumeration**: a single authenticated request returns the full user list, enabling
   scraping and targeted attacks.

**Frontend impact (`../metravel2`):** the messaging compose-search UI in the frontend reads
`id`, `name`/`username`, and `avatar` from this endpoint. Switching to a slim serializer is
safe provided those three fields remain. The frontend must NOT rely on extra fields from
`__all__` — if it does, adapt the frontend consumer accordingly (low risk, check
`components/` for `available_users` usage).

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `GET /api/available-users/` returns only `id`, display-name field, and avatar URL per item.
- [ ] Sensitive fields (`email_notify_*`, social links, internal flags) are absent from the response.
- [ ] The response is paginated; default page size ≤ 50.
- [ ] A `?search=` query parameter filters results by display name (case-insensitive substring or icontains).
- [ ] Without `?search=`, the endpoint does not return the entire user list in one page.
- [ ] Existing messaging functionality (start conversation, send message) is unaffected.

## Gherkin Tests

```gherkin
Feature: available_users endpoint returns slim, paginated profile data

  Scenario: Response contains only safe fields
    Given an authenticated user
    When the user sends GET /api/available-users/
    Then each result object contains exactly "id", "name" (or equivalent), and "avatar"
    And fields like "email_notify_comments", "instagram", "facebook" are absent

  Scenario: Response is paginated
    Given 200 user profiles exist in the database
    When an authenticated user sends GET /api/available-users/
    Then the response contains at most 50 results
    And a "next" pagination link is present

  Scenario: Search filters by name
    Given profiles named "Alice", "Bob", "Charlie" exist
    When an authenticated user sends GET /api/available-users/?search=ali
    Then only "Alice" is returned
    And "Bob" and "Charlie" are absent

  Scenario: Current user is excluded
    Given an authenticated user with id=5
    When the user sends GET /api/available-users/
    Then no result has "id": 5
```

## Assignment

Primary owner: Backend developer (metravel-backend repo)
Support agents: Frontend Developer (verify messaging compose UI still works with slim response), Tester (`test-author` — add endpoint tests), Reviewer (confirm no sensitive field leakage)

## Likely Files Or Areas

- `../metravel-backend/messaging/views.py` — `available_users` view (~lines 117-121), add pagination class and search filter
- `../metravel-backend/users/serializers.py` — add new `ProfileSlimSerializer` with explicit field list
- `../metravel-backend/messaging/urls.py` — no change expected
- `../metravel2/components/` — verify no frontend component reads extra profile fields from this endpoint

## Plan

1. Create `ProfileSlimSerializer` in `users/serializers.py` with `fields = ['id', '<name_field>', 'avatar']`.
2. In `messaging/views.py` `available_users`, replace `ProfileSerializer` with `ProfileSlimSerializer`.
3. Add `pagination_class` (e.g. `PageNumberPagination`, page_size=50) to the view or viewset.
4. Add `filter_backends = [SearchFilter]` with `search_fields = ['<name_field>']` for `?search=`.
5. Write tests: field presence/absence, pagination count, search filter, self-exclusion.
6. Check frontend `available_users` consumer in `../metravel2/components/` — confirm only id/name/avatar is consumed.

## Validation

```bash
# In metravel-backend repo:

# 1. Confirm slim fields only
curl -s http://localhost:8000/api/available-users/ \
  -H "Authorization: Token <token>" \
  | python -m json.tool | grep -E "email_notify|instagram|facebook"
# Expected: no output (sensitive fields absent)

# 2. Confirm pagination
curl -s "http://localhost:8000/api/available-users/" \
  -H "Authorization: Token <token>" \
  | python -m json.tool | grep -E '"count"|"next"|"results"'
# Expected: paginated envelope with "count", "next", "results"

# 3. Search filter
curl -s "http://localhost:8000/api/available-users/?search=ali" \
  -H "Authorization: Token <token>" \
  | python -m json.tool
# Expected: only profiles matching "ali" in name

# 4. Run messaging tests
python manage.py test messaging.tests --verbosity=2
# Expected: all green
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
