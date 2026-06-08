# TASK-20260605-002: Comments Empty List Contract

Status: Done (verified 2026-06-08)
Owner: Backend
Support: Frontend Developer, Tester, Reviewer
Created: 2026-06-05
Updated: 2026-06-08

> Verified fixed 2026-06-08 via a 60-id prod sweep: all `200`; 55/60 valid travels with zero comments return `200 []`; `400` only for malformed/nonexistent `travel_id`. FE 400->empty guard kept as defensive-only. Archived as BE-002 in `docs/BACKEND_WORKBOARD.md`.

## Goal

Return a stable empty-list response for valid travels with no comments so the frontend does not need to treat `400` as an empty state.

## Context

Production/e2e backend probe on 2026-06-05:

- `GET /api/travel-comments/?travel_id=391` -> `200` with an empty array.
- `GET /api/travel-comments/?travel_id=563` -> `400` with a validation-shaped body.

The frontend currently handles this as an empty state, but `400` should be reserved for malformed `travel_id`, not a valid travel with zero comments.

## Acceptance Criteria

- [ ] `GET /api/travel-comments/?travel_id=<valid travel with no comments>` returns `200`.
- [ ] Empty comments are returned as `[]` or a paginated empty list.
- [ ] Malformed or non-existent `travel_id` still returns an appropriate validation/not-found error.
- [ ] Frontend can remove the `400`-as-empty mitigation after backend deploy and regression coverage.

## Gherkin Tests

```gherkin
Feature: Empty travel comments

  Scenario: Valid travel has no comments
    Given a published travel exists
    And the travel has zero comments
    When the client requests /api/travel-comments/?travel_id=<id>
    Then the response status is 200
    And the response body is an empty list or empty paginated list
```

## Assignment

Primary owner: Backend developer
Support agents: Frontend developer for removing the mitigation after verification; Tester for API probes.

## Likely Files Or Areas

- Backend comments API handler.
- Backend comment serializer/paginator.
- Frontend mitigation: `api/comments.ts`.

## Plan

1. Reproduce with a valid travel that has no comments.
2. Distinguish valid-empty from malformed `travel_id`.
3. Return a stable empty list/page for valid-empty.
4. Add backend regression tests.
5. Deploy and verify with curl.

## Validation

```bash
curl -sS -i "https://metravel.by/api/travel-comments/?travel_id=563"
```

## Progress Log

- 2026-06-05: Created after backend handoff verification still reproduced `400` for travel `563`.

## Results

Changed files:

Validation evidence: 2026-06-05 e2e backend probe.

Reviewer findings:

Blockers:
