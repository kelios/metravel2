# TASK-20260609-024: N+1 queries on comment likes count in list endpoint

Status: Backlog
Owner: Backend
Support: Tester, Reviewer, Releaser
Created: 2026-06-09
Updated: 2026-06-09

## Goal

Eliminate N+1 SQL pattern on `likes_count` in the comment list endpoint by replacing the
per-row `likes.count()` call with a single annotated queryset, so the endpoint scales to
large thread trees without multiplying database round-trips.

## Context

`travel_comments/serializers.py:15` declares `likes_count = serializers.IntegerField(source='likes.count')`.
Django calls `.count()` as a separate `SELECT COUNT(*)` for every comment instance that
passes through the serializer. The queryset in `travel_comments/views.py:150` has no
`.annotate()` for likes, so ORM cannot batch the count.

When a client requests `?expand=sub_threads` or `depth=full`, the helper
`_expand_comments_flat` (`views.py:269-312`) recursively fetches sub-thread querysets and
serializes them with the same serializer — each recursive call multiplies the COUNT queries.
A thread with 100 comments across two levels can produce 100+ extra round-trips.

The endpoint is `permission_classes=[AllowAny]` (`views.py:155`), making it an unauthenticated
DoS vector: an attacker can repeatedly request a deep thread and saturate DB connections.

**No breaking change for the frontend (`../metravel2`):** the JSON key `likes_count` stays
the same and its value is identical — only the SQL execution path changes.

Source task:

- Source id:
- Source path:

## Acceptance Criteria

- [ ] `GET /api/travel-comments/?travel=<id>` (N comments) issues a constant number of SQL
  queries regardless of N (verified with `assertNumQueries` or `django-debug-toolbar`).
- [ ] `GET /api/travel-comments/?travel=<id>&expand=sub_threads` does not produce per-comment
  COUNT queries for replies.
- [ ] Response JSON field `likes_count` is present and numerically correct for all comments
  including those with zero likes.
- [ ] Existing unit/integration tests for the comment serializer remain green.
- [ ] The annotation is also applied inside `_expand_comments_flat` for reply querysets.

## Gherkin Tests

```gherkin
Feature: Comment likes count without N+1 queries

  Scenario: Flat list does not issue per-comment COUNT queries
    Given a travel with 50 comments each having between 0 and 10 likes
    When a client sends GET /api/travel-comments/?travel=<id>
    Then the total SQL query count is below 10 (constant, not growing with comment count)
    And each comment object in the response contains a correct integer "likes_count"

  Scenario: Expanded thread does not issue per-comment COUNT queries
    Given a travel with 20 top-level comments each having 5 replies, each with likes
    When a client sends GET /api/travel-comments/?travel=<id>&expand=sub_threads
    Then the total SQL query count does not grow linearly with comment or reply count
    And all reply objects contain a correct integer "likes_count"

  Scenario: Unannotated serializer source is replaced
    Given the serializer field was "source='likes.count'"
    When the backend is deployed with the fix
    Then the field declaration uses "read_only=True" with no "source" pointing to a relation manager
    And the queryset annotates "likes_count=Count('likes', distinct=True)"
```

## Assignment

Primary owner: Backend developer (metravel-backend repo)
Support agents: Tester (`test-author` — write `assertNumQueries` regression test), Reviewer (verify annotation correctness on sub-thread path)

## Likely Files Or Areas

- `../metravel-backend/travel_comments/serializers.py` — replace `source='likes.count'` field
- `../metravel-backend/travel_comments/views.py` — `get_queryset` (~line 150), `_expand_comments_flat` (~lines 269-312)
- `../metravel-backend/travel_comments/tests/` — add `assertNumQueries` regression test

## Plan

1. In `travel_comments/views.py` `get_queryset`, add `.annotate(likes_count=Count('likes', distinct=True))` (import `Count` from `django.db.models`).
2. In `_expand_comments_flat`, apply the same annotation to each sub-queryset before serialization.
3. In `travel_comments/serializers.py`, change `likes_count` field to `serializers.IntegerField(read_only=True)` (remove `source='likes.count'`).
4. Run existing serializer tests; fix any assertion that relied on the old source path.
5. Add a `assertNumQueries` test covering the flat list and the expanded-thread path.
6. Consider rate-limiting the AllowAny list endpoint (see TASK-20260609-018 for throttling baseline).

## Validation

```bash
# In metravel-backend repo:

# 1. Unit test — query count regression
python manage.py test travel_comments.tests.test_likes_n_plus_one --verbosity=2

# 2. Manual check with django-debug-toolbar or shell
python manage.py shell <<'EOF'
from django.test.utils import CaptureQueriesContext
from django.db import connection
from travel_comments.views import TravelCommentViewSet
# build a request for a travel with 30 comments and count queries
EOF

# 3. curl smoke test — field present and integer
curl -s "http://localhost:8000/api/travel-comments/?travel=1" \
  | python -m json.tool | grep likes_count
# Expected: "likes_count": <integer> for each comment object

# 4. curl expanded thread
curl -s "http://localhost:8000/api/travel-comments/?travel=1&expand=sub_threads" \
  | python -m json.tool | grep likes_count
# Expected: "likes_count" present at all comment levels
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
