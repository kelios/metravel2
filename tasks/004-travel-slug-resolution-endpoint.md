# TASK-20260605-004: Travel Slug Resolution Endpoint

Status: Backlog
Owner: Backend
Support: Frontend Developer, Tester, Reviewer
Created: 2026-06-05
Updated: 2026-06-05

## Goal

Provide a stable slug-resolution contract so the frontend does not brute-force travel search variants after a slug 404.

## Context

Probe on 2026-06-05: `GET /api/travels/resolve-slug/?slug=definitely-not-existing-slug` returns `404` because the endpoint does not exist. The frontend fallback still runs multiple search variants across pages in `api/travelDetailsQueries.ts`.

## Acceptance Criteria

- [ ] Backend documents whether travel slugs are immutable.
- [ ] If slugs can drift, backend exposes `GET /api/travels/resolve-slug/?slug=<slug>`.
- [ ] The resolver returns the canonical travel id/slug/url or an explicit `404`.
- [ ] Frontend can replace the fan-out search fallback with one resolver call after backend deploy and regression coverage.

## Gherkin Tests

```gherkin
Feature: Travel slug resolution

  Scenario: Old slug resolves to current travel
    Given a travel slug changed
    When the client requests /api/travels/resolve-slug/?slug=<old-slug>
    Then the response contains the current canonical travel URL
```

## Assignment

Primary owner: Backend developer
Support agents: Frontend developer for fallback simplification; Tester for old/current slug fixtures.

## Likely Files Or Areas

- Backend travel detail/slug API.
- Backend travel slug history, if available.
- Frontend fallback: `api/travelDetailsQueries.ts`.

## Plan

1. Decide immutable slug vs resolver endpoint.
2. Implement the chosen contract.
3. Add backend tests for current, old, and missing slugs.
4. Deploy and coordinate frontend cleanup.

## Validation

```bash
curl -sS -i "https://metravel.by/api/travels/resolve-slug/?slug=<old-slug>"
```

## Progress Log

- 2026-06-05: Created after backend handoff verification still found no resolver endpoint.

## Results

Changed files:

Validation evidence: 2026-06-05 e2e backend probe.

Reviewer findings:

Blockers:
