# Backend workboard

Last verified: 2026-06-04.

Scope: active issues that still require changes in the **backend service** (separate repo / separate service, not this Expo frontend monorepo). Closed items are archived below so the backend team can read the top table as the current queue.

Verification source: read-only probes against the e2e backend from `.env.e2e` (`192.168.50.36`) plus linked frontend evidence in `docs/AGENT_WORKBOARD.md`. Auth-only probes used programmatic login and did not print secrets.

Rule: a frontend mitigation is load-bearing until a backend fix is verified and a frontend regression test covers the new backend behaviour. Do not remove frontend guards just because a backend task is archived here.

## Active Backend Tasks

| ID | Task | Priority | Verified status | Frontend mitigation | Backend action |
| --- | --- | --- | --- | --- | --- |
| BE-002 | Comments endpoint returns an error for some travels with no comments | P2 | Still reproduces partially. Probe 2026-06-04: `GET /api/travel-comments/?travel_id=391` -> `200` array-like, but `GET /api/travel-comments/?travel_id=563` -> `400`. | Frontend treats the 400 as "no comments" and renders the empty state; comments read path avoids the older `main-thread` 404 probe. | Return `200` + empty list/page for any valid travel with zero comments. Reserve `400` for malformed `travel_id`. |
| BE-004 | Places/map catalog endpoint does not honor server-side pagination | P2 | Still reproduces. Probe 2026-06-04: `GET /api/travels/search_travels_for_map/?page=1&perPage=1000&where={lat,lng,radius,publish,moderation}` -> `200`, but returns `1505` rows, no `count`, no `next`; `perPage=1000` is not enforced. | Frontend fetches the full payload, then reveals cards incrementally with `visibleCount`; this reduces DOM but not network/parse cost. | Enforce pagination/cursor contract or provide bbox/viewport-scoped catalog fetch. Coordinate with frontend before changing `api/places.ts` / `api/map.ts`. |
| BE-005 | Places catalog lacks explicit country/name quality guarantees | P3 | Still relevant as backend data/API quality. Probe 2026-06-04: all sampled map-catalog rows lacked an explicit country field; frontend can derive many countries from address text, but the backend contract still does not provide normalized country data. | Frontend derives a country from address text and falls back to neutral labels; UI should not show raw broken data. | Backfill/enforce non-empty normalized country and place name fields, or document and expose the canonical fields the frontend should use. |
| TASK-20260520-001 | Image server resize params and cache headers | P2 | Partially fixed, still active. Probe 2026-06-04 on `metravel.by/gallery/...detail_hd.jpg?w=`: `w=480` -> `51,362b` WebP, `w=720` -> `112,680b` WebP, `w=1200` -> `241,698b` WebP; single `Cache-Control: public, max-age=31536000, immutable`; `Vary: Accept`. Size/header basics are fixed, but target WebP budget for `w=1200` (`<=220KB`) is still missed. | Frontend already sends responsive image params; performance still depends on backend byte budget. | Finish image encoder/quality tuning so all size AC in `tasks/001-image-server-resize-cache.md` pass; then run PSI/Lighthouse mobile LCP check. |

## Closed / Verified Archive

| ID | Closed on | Verification | Frontend note |
| --- | --- | --- | --- |
| BE-001 | 2026-06-04 | Quest media double-scheme no longer reproduces. Probe: `GET /api/quests/by-quest-id/krakow-dragon/` -> `200`, `doubleSchemeCount=0`, media hosts are valid S3/API URLs. | Keep `normalizeMediaUrl` / `fixMediaUrl` regression coverage; do not remove guards without tests. |
| BE-003 | 2026-06-04 | `PUT /api/travels/upsert/` with `{}` now returns structured `400` validation errors instead of `500`. | Wizard still builds full payload client-side; backend validation is now sane for raw/partial requests. |
| BE-006 | 2026-06-04 | Dedicated e2e auth context is usable and no longer empty for QA smoke: programmatic login -> `200`, token/user id present, favorite-travels probe -> `200` with data rows. | Manual QA can use `.env.e2e` auth flow; still avoid destructive prod actions and do not print secrets. |
| BE-007 | 2026-06-04 | Profile avatar no longer comes back as a direct S3 URL. Probe: profile avatar host is backend (`192.168.50.36`), path `/avatar/profile/...`, no presigned S3 query. | Existing avatar `optimizeImageUrl` calls stay in place; add avatar resize-proxy support later only if perf measurements show it is still needed. |

## Notes

- The active table is intentionally short. If a backend item is fixed and verified, move it to the archive instead of leaving stale blockers in the queue.
- BE-004 changes an API contract and must be coordinated with the frontend before landing frontend incremental-fetch changes.
- BE-002 is now narrower than the original finding: one no-comments travel returns `200`, another still returns `400`.
- `TASK-20260520-001` remains in `tasks/` because it has detailed acceptance criteria and validation commands.
