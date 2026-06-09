# TASK-20260605-003: Comment Tree Expand Contract

Status: Done (verified 2026-06-09)
Owner: Backend
Support: Frontend Developer, Tester, Reviewer, Releaser
Created: 2026-06-05
Updated: 2026-06-09

## Goal

Return the full travel comment tree in one request, or expose a documented expansion mode, so the frontend can remove N+1 sub-thread fetches.

## Context

Probe on 2026-06-05: `GET /api/travel-comments/?travel_id=733` returned `200` with 4 comments, including comments with `sub_thread > 0`. The frontend still has to fetch sub-threads separately to assemble the conversation.

Source task:

- Source id:
- Source path: 2026-06-05 e2e backend probe (`GET /api/travel-comments/?travel_id=733`)

## Acceptance Criteria

- [ ] The comments endpoint can return the full tree in one request, for example with `?expand=sub_threads` or `?depth=full`.
- [ ] Parent/child relationships are explicit and stable.
- [ ] The response avoids one request per sub-thread.
- [ ] Frontend can remove the BFS sub-thread fetch loop after backend deploy and regression coverage.

## Gherkin Tests

```gherkin
Feature: Travel comment tree

  Scenario: Client fetches nested comments
    Given a travel has top-level comments and replies
    When the client requests comments with full-tree expansion
    Then the response contains top-level comments and their replies
    And no extra sub-thread request is required
```

## Assignment

Primary owner: Backend developer
Support agents: Frontend developer for API adapter cleanup; Tester for nested-comment fixtures.

## Likely Files Or Areas

- Backend comments API handler.
- Backend comments serializer.
- Frontend mitigation: `api/comments.ts`.

## Plan

1. Choose and document the full-tree response shape.
2. Add backend serializer support and tests.
3. Deploy behind the stable endpoint/parameter.
4. Coordinate frontend adapter cleanup.

## Validation

```bash
curl -sS "https://metravel.by/api/travel-comments/?travel_id=733&expand=sub_threads"
```

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-05: Created after verification showed sub-thread IDs are still returned without embedded replies.
- 2026-06-09: Backend shipped `?expand=sub_threads` / `?depth=full` (`travel_comments/views.py:257-312`, `_expand_comments_flat`) — returns the whole comment tree as a flat list in one request. Prod re-probe confirmed the param is parsed and the response shape is unchanged (bare array, no pagination wrapper). Frontend simplification landed: `getTravelComments` now requests `expand=sub_threads` in the initial call and only BFS-fetches sub-threads on legacy deployments that ignore the param. Regression tests added in `__tests__/api/comments.test.ts` (single-request expand path + legacy BFS fallback).

## Results

Changed files:
- `api/comments.ts` — `getComments`/`getCommentsByTravel` accept `{ expandSubThreads }`; `getTravelComments` prefers the single server-expanded request and keeps the BFS as a legacy fallback.
- `__tests__/api/comments.test.ts` — regression coverage for the expanded single-request path and the legacy BFS fallback.

Validation evidence: 2026-06-05 e2e backend probe; 2026-06-09 prod probe (`/api/travel-comments/?travel_id=384&expand=sub_threads` -> `200`, bare array, same shape as without `expand`); `npx jest __tests__/api/comments.test.ts` -> 26 passed.

Reviewer findings:

Release notes:

Blockers:
