# TASK-20260605-007: Profile Avatar URL Fresh Reproduction

Status: Backlog
Owner: Backend
Support: Frontend Developer, Tester, Reviewer, Releaser
Created: 2026-06-05
Updated: 2026-06-08

## Goal

Verify whether profile avatar URLs still point to missing files and fix backend URL generation or storage if the issue reproduces on a current account.

## Context

Earlier production browser evidence on 2026-06-05 showed a profile avatar URL with a suspicious doubled path segment (`/avatar/profile/<id>/avatar/<file>.webp`) returning `404`. A later direct probe could not re-check the same user because `/api/user/82/profile/` returned `404`, and the travel payload no longer exposed a numeric author id. This needs a fresh backend-side reproduction using a known account with an uploaded avatar.

Frontend mitigation: `useAvatarUri` caches failed avatar URLs for the browser session and falls back after the first failed URL.

Source task:

- Source id:
- Source path: 2026-06-05 production browser evidence (avatar `404`, doubled path segment)

## Acceptance Criteria

- [ ] Identify a current profile with an uploaded avatar.
- [ ] `GET /api/user/{id}/profile/` returns an avatar URL for that profile.
- [ ] The raw avatar URL returns `200` with an image content type.
- [ ] If a doubled path or missing file reproduces, backend fixes URL generation/storage and adds regression coverage.
- [ ] Frontend failed-avatar cache can stay as UX defense but should no longer be exercised by valid avatar URLs.

## Gherkin Tests

```gherkin
Feature: Profile avatar URLs

  Scenario: Existing profile avatar is served
    Given a user has uploaded an avatar
    When the client reads /api/user/<id>/profile/
    Then the avatar URL points to an existing image file
```

## Assignment

Primary owner: Backend developer
Support agents: Frontend developer for confirming retry behavior; Tester for browser/network probe.

## Likely Files Or Areas

- Backend profile API.
- Avatar storage/path generation.
- Frontend mitigation: `hooks/useAvatarUri.ts`.

## Plan

1. Pick a known current user with an uploaded avatar.
2. Probe profile response and raw avatar URL.
3. Fix URL generation/storage if the avatar 404 reproduces.
4. Add backend regression coverage.

## Validation

```bash
curl -sS -i "https://metravel.by/api/user/<id>/profile/"
curl -sS -I "https://metravel.by/avatar/profile/<id>/<file>.webp"
```

## Release Checklist

- [ ] Changed files are listed in `## Results`.
- [ ] New files created by this task are identified.
- [ ] Generated/cache/secret/local files are excluded.
- [ ] Task-scope files are staged when the user asks to prepare git.
- [ ] Skipped files and release blockers are recorded.

## Progress Log

- 2026-06-05: Created because old production avatar evidence could not be treated as closed or current without a fresh user fixture.

## Results

Changed files:

Validation evidence: 2026-06-05 direct re-check could not verify old user id (`/api/user/82/profile/` returned `404`).

Reviewer findings:

Release notes:

Blockers:
