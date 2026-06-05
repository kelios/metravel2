# TASK-20260605-005: Near Travels Empty List Contract

Status: Backlog
Owner: Backend
Support: Frontend Developer, Tester, Reviewer
Created: 2026-06-05
Updated: 2026-06-05

## Goal

Return `200` with an empty list for valid travels that have no nearby travels, instead of `404`.

## Context

Probe on 2026-06-05:

- `GET /api/travels/563/near/` -> `404`.
- `GET /api/travels/391/near/` -> `200` with nearby rows.

The frontend currently swallows `404` as `[]` in `api/map.ts`.

## Acceptance Criteria

- [ ] Valid travel with zero nearby travels returns `200`.
- [ ] Empty nearby results are returned as `[]` or a paginated empty list.
- [ ] Non-existent travel ids still return `404`.
- [ ] Frontend can remove the `404`-as-empty mitigation after backend deploy and regression coverage.

## Gherkin Tests

```gherkin
Feature: Nearby travels

  Scenario: Valid travel has no nearby matches
    Given a published travel exists
    And no nearby travels match the backend radius
    When the client requests /api/travels/<id>/near/
    Then the response status is 200
    And the response body is empty
```

## Assignment

Primary owner: Backend developer
Support agents: Frontend developer for adapter cleanup; Tester for valid-empty and missing-id probes.

## Likely Files Or Areas

- Backend travels near endpoint.
- Frontend mitigation: `api/map.ts`.

## Plan

1. Reproduce with a valid travel that has no near-list.
2. Distinguish valid-empty from missing travel id.
3. Return a stable empty list/page for valid-empty.
4. Add backend regression tests.

## Validation

```bash
curl -sS -i "https://metravel.by/api/travels/563/near/"
```

## Progress Log

- 2026-06-05: Created after verification still reproduced `404` for valid travel `563`.

## Results

Changed files:

Validation evidence: 2026-06-05 e2e backend probe.

Reviewer findings:

Blockers:
