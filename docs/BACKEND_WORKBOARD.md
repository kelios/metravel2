# Backend workboard

Last verified: 2026-06-05.

Scope: active issues that still require changes in the **backend service** (separate repo / separate service, not this Expo frontend monorepo). Closed items are archived below so the backend team can read the top table as the current queue.

Verification source: read-only probes against the e2e backend from `.env.e2e` (`192.168.50.36`) plus linked frontend evidence in `docs/AGENT_WORKBOARD.md`. Auth-only probes used programmatic login and did not print secrets.

Rule: a frontend mitigation is load-bearing until a backend fix is verified and a frontend regression test covers the new backend behaviour. Do not remove frontend guards just because a backend task is archived here.

## Active Backend Tasks

| ID | Task | Priority | Verified status | Frontend mitigation | Backend action |
| --- | --- | --- | --- | --- | --- |
| BE-002 / TASK-20260605-002 | Comments endpoint returns an error for some travels with no comments | P2 | Still reproduces. Probe 2026-06-05: `GET /api/travel-comments/?travel_id=391` -> `200` empty array, but `GET /api/travel-comments/?travel_id=563` -> `400`. | Frontend treats the 400 as "no comments" and renders the empty state. | Return `200` + empty list/page for any valid travel with zero comments. Reserve `400` for malformed `travel_id`. |
| TASK-20260520-001 | Image server resize params and cache headers | P2 | Partially fixed, still active. Probe 2026-06-05: `w=480&q=55` -> WebP `51,362b`, `w=720&q=60` -> WebP `118,296b`, `w=1200&q=65` -> WebP `268,680b`; single `Cache-Control: public, max-age=31536000, immutable`; `Vary: Accept`; `Accept: image/avif` returns JPEG. | Frontend travel LCP/mobile image contract is already capped (`w=720` for mobile hero). | Finish `w=1200&q=65 <=220KB`, AVIF if supported, and PSI/Lighthouse mobile LCP validation. |
| BE-010 / TASK-20260605-003 | Comment tree requires N+1 sub-thread fetches | P2 | Still reproduces. Probe 2026-06-05: `GET /api/travel-comments/?travel_id=733` -> `200` with comments carrying `sub_thread > 0`; replies are not embedded. | `getTravelComments` (`api/comments.ts`) BFS-fetches sub-threads. | Return the full comment tree in one request (`?expand=sub_threads` / `?depth=full`) or a flat list with `parent_id`. |
| BE-011 / TASK-20260605-004 | No slug-resolution endpoint; FE brute-forces search on 404 | P2 | Still reproduces. Probe 2026-06-05: `GET /api/travels/resolve-slug/?slug=definitely-not-existing-slug` -> `404` because resolver endpoint is absent. | `findTravelBySlugFallback` runs multiple search variants across pages. | Provide stable immutable slugs or a resolver endpoint so FE can collapse the fan-out to one call. |
| BE-015 / TASK-20260605-005 | Collection endpoints return 404 instead of `200` + empty list | P3 | Still reproduces. Probe 2026-06-05: `GET /api/travels/563/near/` -> `404`; `GET /api/travels/391/near/` -> `200`. | FE swallows the 404 as `[]` (`api/map.ts`). | For valid resources with no rows return `200` + `[]`/`{results:[]}`; reserve `404` for non-existent resources. |
| BE-016 / TASK-20260605-007 | Profile avatar URL fresh reproduction | P3 | Needs fresh repro. Earlier prod browser evidence showed an avatar 404 with doubled `/avatar/.../avatar/`; direct 2026-06-05 re-check could not verify old user id because `/api/user/82/profile/` returned `404`, and current `torun` travel payload exposes `userName` but no numeric author id. | `useAvatarUri` caches failed avatar URLs for the session and renders fallback. | Backend/tester should probe a current known account with an uploaded avatar and fix URL generation/storage if raw avatar still returns 404. |
| BE-017 / TASK-20260605-006 | Quests absent from `sitemap.xml` | P2 | Still reproduces in prod. Probe 2026-06-05: `GET https://metravel.by/sitemap.xml` -> `200`, 388 `<loc>` entries, 0 quest URLs. | Frontend owns quest pages/meta/internal links, but canonical sitemap is backend-owned. | Add `/quests` and published `/quests/{city_id}/{quest_id}` URLs to backend sitemap generator. |

## Closed / Verified Archive

| ID | Closed on | Verification | Frontend note |
| --- | --- | --- | --- |
| BE-001 | 2026-06-04 | Quest media double-scheme no longer reproduces. Probe: `GET /api/quests/by-quest-id/krakow-dragon/` -> `200`, `doubleSchemeCount=0`, media hosts are valid S3/API URLs. | Keep `normalizeMediaUrl` / `fixMediaUrl` regression coverage; do not remove guards without tests. |
| BE-003 | 2026-06-04 | `PUT /api/travels/upsert/` with `{}` now returns structured `400` validation errors instead of `500`. | Wizard still builds full payload client-side; backend validation is now sane for raw/partial requests. |
| BE-006 | 2026-06-04 | Dedicated e2e auth context is usable and no longer empty for QA smoke: programmatic login -> `200`, token/user id present, favorite-travels probe -> `200` with data rows. | Manual QA can use `.env.e2e` auth flow; still avoid destructive prod actions and do not print secrets. |
| BE-007 | 2026-06-04 | Profile avatar no longer comes back as a direct S3 URL. Probe: profile avatar host is backend (`192.168.50.36`), path `/avatar/profile/...`, no presigned S3 query. | Existing avatar `optimizeImageUrl` calls stay in place; add avatar resize-proxy support later only if perf measurements show it is still needed. |
| BE-004 | 2026-06-05 | Places/map catalog pagination now returns canonical and legacy shapes and honors `perPage`: `page=1&perPage=1000` -> `resultsLen=1000`, `count=1507`, `next` present. | Frontend follow-up completed: `fetchPlacesCatalog` now follows paginated pages instead of only reading the first 1000 rows. |
| BE-005 | 2026-06-05 | Places catalog rows now include explicit country fields: sampled map row had `countryName`, `countryCode`, `country_name`, and `country_code`. | Keep country fallback for old/offline payloads, but it is no longer load-bearing for current backend rows. |
| BE-008 | 2026-06-05 | Public `/api/travels/` and authenticated `/api/messages/?thread_id=1` now return canonical `count`, `next`, `previous`, and `results` in addition to legacy Laravel fields. | Existing normalizers remain compatible; optional future cleanup can remove dead dual-shape reads with tests. |
| BE-009 | 2026-06-05 | Travel list canonical `name`/`url` remained verified: sampled `/api/travels/` rows include `name` and canonical `/travels/{slug}` URL. | Optional future cleanup only. |
| BE-012 | 2026-06-05 | Media URL shape remained clean on sampled travel and place media: no double host or `/api` media prefix observed. | Keep media URL guards unless removed with regression tests. |
| BE-013 | 2026-06-05 | Quest catalog and detail now return numeric coordinates and `country_code`: `/api/quests/` first row has numeric `lat/lng` and `country_code=pl`; `/api/quests/by-quest-id/krakow-dragon/` city and first step also have numeric coordinates and `country_code=pl`. | Coordinate parsing fallback is now defensive; optional cleanup requires tests. |
| BE-014 | 2026-06-05 | Quest bundle structured fields are objects/arrays: `steps` is an array and `intro` is an object for `krakow-dragon`. | JSON-string parse fallback is now defensive; optional cleanup requires tests. |

## Notes

- The active table is intentionally short. If a backend item is fixed and verified, move it to the archive instead of leaving stale blockers in the queue.
- BE-004 changed an API contract and required a frontend follow-up: `api/places.ts` now loads all paginated catalog pages.
- BE-002 is now narrower than the original finding: one no-comments travel returns `200`, another still returns `400`.
- BE-016 needs a fresh current-account fixture before it can be closed or escalated as still reproducing.
- Backend task details now live in `tasks/` per project rules.
- `TASK-20260520-001` remains in `tasks/` because it has detailed acceptance criteria and validation commands.
