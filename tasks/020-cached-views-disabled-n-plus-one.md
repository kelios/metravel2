# TASK-20260609-020: Enable prod view cache and fix N+1 queries in user travel actions

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Restore view-level caching in production and add `prefetch_related` to user travel-action
querysets to eliminate the N+1 queries that cause high DB load and contribute to 502s under
traffic.

## Context

Security review 2026-06-09. Two related performance problems:

1. **View cache disabled in prod.** `metravel/envs/prod/settings.py:4` sets
   `CACHED_VIEWS = False`. `cache_utils.py:33-37` checks this flag and returns a no-op
   decorator when it is `False`. As a result, the `@use_cache` decorators on
   `travels/views.py:461` (list), `:852` (facets), `:1508` (map), `:1596`, `:1632`,
   `:1660` (filters/countries) are all ignored in production. The facets endpoint at `:854`
   executes approximately 10 aggregation queries on every request; `travels_for_map` is a
   heavy geo query. Redis is already deployed and configured — the cache infrastructure
   exists but is unused. Result: elevated DB CPU on every page load, 502/504 under moderate
   traffic.

2. **N+1 in user travel-action endpoints.** `users/views.py:668` (history), `:704`
   (favorite_travels), `:726` (recommended_travels) retrieve a `Travel` queryset via bare
   `Travel.objects` without `prefetch_related('countries', 'users')`. The serializer at
   `serializers.py:67,128,137` accesses `get_country_name` and `get_user_name` via `.all()`
   on the related manager, issuing one extra query per travel per relation — O(n) DB
   queries for a list of n travels.

Related to `tasks/010-prod-memory-limits-rebalance.md` — high DB load compounds the OOM
pressure on the 1-vCPU box.

No frontend API contract changes.

Source task:

- Source id:
- Source path: backend security review 2026-06-09

## Acceptance Criteria

- [ ] `CACHED_VIEWS = True` in `metravel/envs/prod/settings.py`.
- [ ] After the change, a second identical request to `/api/travels/facets/` (or equivalent
      cached endpoint) is served from Redis cache and does not hit the database (verifiable
      via Django debug toolbar / query logging on staging).
- [ ] `Travel` querysets in `users/views.py:668`, `:704`, `:726` include
      `.prefetch_related('countries', 'users')` (or the relevant M2M field names).
- [ ] The number of DB queries for a history/favorites list of 10 travels drops from ~O(n)
      to a fixed small count (2-3 queries regardless of list length).
- [ ] Existing response payloads for history, favorites, and recommended are unchanged.
- [ ] Redis memory usage stays within `maxmemory` config after cache warm-up.

## Gherkin Tests

```gherkin
Feature: View cache is active in production and N+1 queries are eliminated

  Scenario: Facets endpoint is served from cache on second request
    Given CACHED_VIEWS is True and Redis is running
    When the same facets request is made twice in quick succession
    Then the second response is served from cache (no DB queries on second hit)

  Scenario: User history list does not issue N+1 queries
    Given a user has 10 travel items in history
    When the client requests GET /api/users/<pk>/history/
    Then the total number of DB queries is not proportional to the number of travels
    And the response contains all 10 travels with correct country and user data
```

## Assignment

Primary owner: Backend developer — set CACHED_VIEWS=True; add prefetch_related.
Support agents: Tester to verify query count reduction and cache hit on staging; Reviewer
to confirm no stale-cache scenarios are introduced.

## Likely Files Or Areas

- `metravel/envs/prod/settings.py` line 4 (CACHED_VIEWS)
- `cache_utils.py` lines 33-37 (flag check)
- `users/views.py` lines 668, 704, 726 (history / favorites / recommended querysets)
- `travels/serializers.py` lines 67, 128, 137 (get_country_name / get_user_name)
- Related: `tasks/010-prod-memory-limits-rebalance.md`

## Plan

1. Set `CACHED_VIEWS = True` in `metravel/envs/prod/settings.py`.
2. Verify Redis `maxmemory` and `allkeys-lru` policy can handle the additional cache
   entries without evicting DRF tokens.
3. In `users/views.py`, update the querysets at lines 668, 704, 726 to include
   `.prefetch_related('countries', 'users')` (verify exact M2M field names from models).
4. Add a Django test using `assertNumQueries` to assert the history/favorites list is
   fetched in a bounded number of queries.
5. Deploy to staging; run `django-debug-toolbar` (or query logging) to confirm cache hits
   on facets and constant query count on user travel lists.

## Validation

```bash
# Measure facets query time before/after (should drop to near-zero on second hit)
time curl -s https://metravel.by/api/travels/facets/ > /dev/null
time curl -s https://metravel.by/api/travels/facets/ > /dev/null
# Expected: second call is significantly faster (< 10ms vs. 100-500ms first call)

# Verify Redis holds cache keys after warm-up
# redis-cli KEYS "views.decorators.cache*" | wc -l
# Expected: > 0

# Verify history response is still correct
curl -s -H "Authorization: Token TOKEN" \
  "https://metravel.by/api/users/PK/history/" | python3 -m json.tool | head -30
# Expected: correct travel list with country and user fields populated
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
