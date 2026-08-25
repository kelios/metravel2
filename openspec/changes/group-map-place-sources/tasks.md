## 1. Backend dependency (read-only from this workspace; board #1566, #1567, catalog follow-up)

- [ ] 1.1 Track backend delivery: Place identity + migration/backfill, grouped marker DTO (`place_id`, `source_count`, `primary_source`) in `search_travels_for_map` + `clusters`, `GET /api/map/places/{place_id}/sources/`, cluster counts by place — verify the deployed contract with GET probes on the deploy target (National Library + Stankovo pairs) before starting group 5
- [ ] 1.2 Confirm data fix #1566 (coordinate of point 15688) landed, or record it as a known offset in acceptance evidence

## 2. Shared model and adapters (board FE-1)

- [x] 2.1 Add `MapPlaceMarker` / `MapPlaceSource` types and `placeKey` derivation (`String(place_id)`; legacy identity fallback for rows without `place_id`) to the shared map types
- [x] 2.2 Implement `O(n)` grouping normalization (single `Map` pass per dataset update) in the `api/map.ts` adapter layer for `fetchTravelsForMap`, `fetchMapClusters`, `fetchTravelsNearRoute`, accepting both the grouped DTO and the legacy flat shape
- [x] 2.3 Add `fetchMapPlaceSources(placeId, cursor)` adapter + React Query key `['map-place-sources', placeKey]` with fetch-once-per-cache semantics
- [x] 2.4 Add DTO fixtures (two-source place, nearby distinct places, legacy placeless row, single-source place) exactly matching `docs/features/map.md`
- [ ] 2.5 Targeted Jest: grouping, placeKey stability across refreshes, `different place_id never merge`, `no place_id stays standalone`, adapter legacy fallback

## 3. Source pager UI (board FE-2, depends on group 2)

- [ ] 3.1 Extend the `PlacePopupCard` content model with `sources`, `activeSourceId`, paging callbacks; place-owned vs source-owned prop split per design decision 6
- [ ] 3.2 Wire pager into web popup (`createMapPopupComponent`) and `MapPlaceBottomCard`: counter `Материал {{current}} из {{total}}`, previous/next controls (≥44 dp), swipe; single source renders no pager
- [ ] 3.3 Mount only the active source image via the shared media component; prefetch at most the next thumbnail
- [ ] 3.4 Add RU/BE/UK/PL/EN keys for counter, previous/next labels, paging announcement; announce paging to assistive tech; keyboard operability on web
- [ ] 3.5 Targeted Jest for pager model + card rendering (fixtures from 2.4); `npm run test:i18n`

## 4. Renderers and native bridge (board FE-3, depends on group 2)

- [ ] 4.1 Web: render one marker per `placeKey` in `Map.web.tsx` / `MarkerClusterGroup.tsx`, keeping #1347 keyed-diff stability (assert no churn on dataset refresh)
- [ ] 4.2 Native: build one WebView marker per place in `nativeMapHtml.ts`; marker payload carries only `sourceCount` + `primarySource`, never the full sources array
- [ ] 4.3 Bridge: add stable `placeKey` to `SELECT_PLACE` in `nativeBridge.ts` (keep legacy `index`/`id`/`coord` during transition); resolve selection by key in `Map.ios.tsx` / `Map.android.tsx`
- [ ] 4.4 Targeted Jest: bridge round-trip with `placeKey`, tap-after-reorder selection, WebView payload size assertion vs baseline
- [ ] 4.5 Android device smoke of tap → card → paging (shared bridge diff)

## 5. Integration and acceptance (board #1568, depends on groups 1–4)

- [ ] 5.1 Wire lazy sources fetch to the real endpoint on the deploy target; network assertion: sources requested only after first card open, once per cache, never on paging; reopen uses cache
- [ ] 5.2 e2e fixture flow: one place → one marker → `1 из 2` → `2 из 2` → back; nearby distinct place opens separately; single-source place has no pager
- [ ] 5.3 MAP-20 runtime evidence: desktop web + mobile web (screenshots, console, network) at zoom 10/13/16 on the National Library; both sources link to travels `389` and `646`; place-owned fields stable while paging
- [ ] 5.4 MAP-20 on physical iPhone/TestFlight (originating defect surface)
- [ ] 5.5 Performance evidence: initial marker/WebView payload ≤ baseline; no marker layer rebuild while paging

## 6. Review and validation

- [ ] 6.1 Update `docs/features/map.md` cross-references if implementation deviates; keep MAP-20 in `docs/MANUAL_TEST_CASES.md` in sync
- [ ] 6.2 Code-review-and-fix over the full task diff (review-auditor), rerun affected checks after fixes
- [ ] 6.3 `npm run check:fast` + targeted suites green; `openspec validate group-map-place-sources --strict`
