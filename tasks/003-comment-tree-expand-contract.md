# TASK-20260605-003: Comment Tree Expand Contract

Status: Backlog
Owner: Backend
Support: Frontend Developer, Tester, Reviewer
Created: 2026-06-05
Updated: 2026-06-05

## Goal

Return the full travel comment tree in one request, or expose a documented expansion mode, so the frontend can remove N+1 sub-thread fetches.

## Context

Probe on 2026-06-05: `GET /api/travel-comments/?travel_id=733` returned `200` with 4 comments, including comments with `sub_thread > 0`. The frontend still has to fetch sub-threads separately to assemble the conversation.

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

## Progress Log

- 2026-06-05: Created after verification showed sub-thread IDs are still returned without embedded replies.

## Results

Changed files:

Validation evidence: 2026-06-05 e2e backend probe.

Reviewer findings:

Blockers:
