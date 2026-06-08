# TASK-20260605-006: Include Quests In Sitemap

Status: Done (verified 2026-06-08)
Owner: Backend
Support: SEO Engineer, Frontend Developer, Tester, Reviewer
Created: 2026-06-05
Updated: 2026-06-08

> Verified fixed 2026-06-08: prod `GET https://metravel.by/sitemap.xml` -> `200`, 415 `<loc>` entries (was 388), 26 `/quests` URLs (was 0). Moved to archive in `docs/BACKEND_WORKBOARD.md` (BE-017).

## Goal

Include the quests catalog and published quest detail URLs in the production `sitemap.xml`.

## Context

Probe on 2026-06-05: `GET https://metravel.by/sitemap.xml` returned `200` with 388 `<loc>` entries and `0` quest URLs. The sitemap is backend-owned; the frontend can provide page metadata and internal links, but cannot add quest URLs to the served canonical sitemap.

## Acceptance Criteria

- [ ] `https://metravel.by/sitemap.xml` includes `/quests`.
- [ ] The sitemap includes every published quest detail URL `/quests/{city_id}/{quest_id}`.
- [ ] Each quest URL has a sensible `<lastmod>` from quest update data.
- [ ] SEO post-deploy verification confirms quest URLs are discoverable.

## Gherkin Tests

```gherkin
Feature: Quest sitemap entries

  Scenario: Published quests are discoverable
    Given published quests exist
    When the sitemap is generated
    Then the sitemap contains the quests catalog URL
    And it contains one detail URL for each published quest
```

## Assignment

Primary owner: Backend developer
Support agents: SEO Engineer for verification; Frontend developer for route/meta contract; Tester for production sitemap probe.

## Likely Files Or Areas

- Backend sitemap generator.
- Quest publication query.
- Production `sitemap.xml` endpoint.

## Plan

1. Locate the backend sitemap generator.
2. Add quests catalog and published quest details.
3. Use quest `updated_at` for `<lastmod>`.
4. Deploy and verify production sitemap.

## Validation

```bash
curl -sS https://metravel.by/sitemap.xml | grep -E "/quests($|/)"
```

## Progress Log

- 2026-06-05: Created after production sitemap still contained zero quest URLs.

## Results

Changed files:

Validation evidence: 2026-06-05 production sitemap probe.

Reviewer findings:

Blockers:
