# T-073 — App-wide architecture audit

Owner: Майкл (System Architect)
Date: 2026-06-03
Branch: `main`
Method: static repository inventory (file/LOC scan, `package.json` scripts, `metro.config.js`, `jest.config.js`, store/context/api enumeration). Not a runtime/Lighthouse pass — no browser surface for an audit doc.

Goal (from Today active dispatch): produce a decision table — area, current problem, decision (`rework` / `change` / `keep`), affected modules, risks, validation, proposed owner/priority — so new dev work starts from a single architectural truth instead of ad-hoc per-task scope.

Decision legend:

- `keep` — architecture is correct and proven; do not touch without a fresh repro.
- `change` — incremental, low-risk improvement worth scheduling (no behavior change in scope).
- `rework` — known oversized/coupled area that needs a structural pass (still behavior-neutral, via profile agents).

---

## 1. Snapshot (verified LOC, not bytes)

| Layer | What exists | Numbers |
| --- | --- | --- |
| Routing | Expo Router file-based, `app/(tabs)/*`; heavy screens delegated to `screens/tabs/*` (Map/Places/Quests/UserPoints) | `app/(tabs)/profile.tsx` 783, `settings.tsx` 654; `screens/tabs/MapScreen.tsx` 760 |
| Server state | TanStack Query, domain `api/*Queries.ts` + `api/client.ts` | `api/client.ts` 796, `travelDetailsQueries.ts` 549, `map.ts` 547 |
| Client state | 9 Zustand stores | total 1579 LOC; largest `authStore` 336, `travelStatusStore` 301, `favoritesStore` 290 |
| Cross-cutting state | 6 React Context files | `MapFiltersContext` 211, `FavoritesProvider` 135, `AuthContext` 83 |
| Maps | web Leaflet / native RN Maps via `.web/.ios/.android` + metro stub | `Map.web.tsx` 653, `TravelMap.tsx` 752; `metro-stubs/react-native-maps.js` |
| Images | centralized `ImageCardMedia` → `OptimizedImage`; `UnifiedTravelCard`; ESLint guard | `ImageCardMedia.tsx` 655, guard `scripts/check-image-architecture.js` |
| Perf infra | metro web-resolver stubs (GH/maps/CSS), bundle-budget guard, perf e2e | `config/bundle-budget.json`, `scripts/guard-bundle-budget.js`, `e2e/pages-perf-budget.spec.ts` |
| Tests | Jest (jsdom) + Playwright e2e | ~580 jest files; ~30 e2e specs |
| Guards | 9 guard/check scripts wired into `lint`/`check:*` | see §9 |

Stores LOC corrected from the raw scan (the earlier 1947/10997-style figures were `wc -c` byte sizes, not lines).

---

## 2. Decision table

| # | Area | Current state / problem | Decision | Affected modules | Risk if touched | Validation gate | Proposed owner | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | **Routing model** (Expo Router file-based + `screens/tabs/*` delegation) | Consistent, file-based, heavy screens already delegated. Works on all 3 platforms. | **keep** | `app/`, `screens/tabs/` | n/a | n/a | — | — |
| A2 | **SSR-first + deferred islands** (Home/Search/Map/Places migrated; travel is the reference) | Proven model, documented in `docs/TRAVEL_PERFORMANCE_REFACTOR.md`; islands via `DeferredSection`/`useProgressiveLoad`. | **keep** | `components/home/Home.tsx`, `search.tsx`, map/places screens | regress LCP/CLS if re-coupled | existing perf e2e (`pages-perf-budget`) | — | — |
| A3 | **Image architecture** (`ImageCardMedia` + `OptimizedImage`, guard-enforced, contain+blur rule) | Enforced by `check:image-architecture`; blur/contain contract is a hard project rule. | **keep** | `components/ui/ImageCardMedia.tsx`, `UnifiedTravelCard.tsx` | guard already blocks drift | `check:image-architecture` | — | — |
| A4 | **External-link & window.open discipline** | Centralized via `@/utils/externalLinks`, two guards enforce. | **keep** | `utils/externalLinks.ts` | guard-enforced | `guard:external-links` | — | — |
| A5 | **God-components still >700 LOC** (post tech-debt wave) | A residual band of files sits at 700–824 LOC: `ListTravelBase` 824, `ArticleEditor.web` 792, `UpsertTravelView` 783, `profile.tsx` 783, `PlacePopupCard/index` 776, `PointsListGrid` 763, `MapScreen` 760, `RouteElevationProfile` 758, `RightColumn` 758, `TravelMap` 752. Threshold-target is <800; several already cross it. | **rework** (incremental, behavior-neutral splits — same pattern as TD-003…TD-021) | listed files | pure-move splits risk only if hooks order/deps change | per-file: `check:fast` + `guard:file-complexity:changed` 0 + targeted jest + browser for visible ones | `refactor-surgeon` + domain expert (`travel-expert`/`map-expert`) | P2 |
| A6 | **`api/client.ts` (796 LOC)** | Already reduced via TD-012 (errors/types extracted) but still near the 800 ceiling; central HTTP/retry/401/Token logic. | **change** (watch, no further split unless it crosses 800) | `api/client.ts`, `clientErrors.ts`, `clientTypes.ts` | high blast radius (every request) — do not refactor speculatively | `jest __tests__/api`, typecheck | `refactor-surgeon` | P3 |
| A7 | **State split: Zustand (9 stores) vs Context (6)** | Healthy separation; stores are small (largest 336 LOC). Map state is spread across `MapFiltersContext` (211) + `mapPanelStore`/`routeStore`/`bottomSheetStore` + `hooks/map/*`. | **change** (document the map-state ownership map; no merge) | `stores/*`, `context/MapFiltersContext.tsx`, `hooks/map/*` | merging would create a god-store — explicitly avoid | n/a (doc) | `map-expert` | P3 |
| A8 | **Maps web/native dual implementation** | `.web/.ios/.android` + metro stub (`react-native-maps`→stub on web, Leaflet loaded separately). PERF-008/014 already optimized eager weight. | **keep** | `components/MapPage/*`, `components/map-core/*`, `metro.config.js` | stub contract is load-bearing (PERF-014) | `map-expert` sign-off + map jest + `e2e/map-page` | — | — |
| A9 | **Perf budget enforcement** | `guard:bundle-budget` (PERF-006 §7) + perf e2e exist, but the **eager `entry`/`__common` guard from PERF-014 is not yet a repeatable production gate** (tracked as PERF-017, still Open). | **change** | `metro.config.js`, `config/bundle-budget.json`, `scripts/`, `docs/PERF_014_EAGER_BUNDLE_AUDIT.md` | scripts/ is protected — needs explicit go | prod export + guard `--fail` exit 1 on GH/reanimated re-entry | `test-author` + `refactor-surgeon` (= **PERF-017**) | P2 |
| A10 | **Heavy lazy chunks on travel** | `TravelDetailsMapSection-*` (~100KB budget) + `CommentsSection-*` (~84KB) are the heaviest route chunks; possible shared-Leaflet/lazy-boundary win. | **rework** | `components/travel/details/sections/*` | shared map dep — coordinate with map | bundle-budget delta + travel perf e2e | `refactor-surgeon` + `map-expert` (= **PERF-007**) | P2 |
| A11 | **Map marker perf** | Clustering/virtualization, deferred ORS routing, filter debounce not fully landed. | **rework** | `components/MapPage/TravelMap.tsx`, `RoutingStatus.tsx`, `MapMobileLayout.tsx` | gesture/routing regressions | map jest + `e2e/map-page` + Leaflet bytes check | `map-expert` (= **PERF-009**) | P2 |
| A12 | **Places critical-shell migration** | `PlacesScreen` split landed (TD-019), CLS fixed (PERF-015), but full deferred-islands pass (incremental catalog, defer map/filters) is still Open. | **rework** | `app/(tabs)/places.tsx`, `screens/tabs/PlacesScreen.tsx` | catalog load behavior | places jest + perf e2e (CLS <0.1) | `refactor-surgeon` + `travel-expert` (= **PERF-010**) | P1 |
| A13 | **Retina/DPR card-media byte budget** | DPR-aware sizing added; needs validation that small slots aren't oversized and own-domain resize URLs aren't regressed. | **change** | `components/ui/UnifiedTravelCard.tsx`, `utils/imageOptimization.ts`, `e2e/pages-perf-budget.spec.ts` | own-domain resize regression | image-arch guard + perf e2e transfer bytes | `travel-expert` + DevOps (= **PERF-016**) | P2 |
| A14 | **Articles feature** | `ArticleEditor.web.tsx` 792 LOC, article routes split by platform — but feature is **deprioritized / not in active use** ([[project_active_features]]). | **keep** (do not invest; split only if it blocks a guard) | `components/article/*`, `app/(tabs)/article/*` | low value | n/a | — | P4 |
| A15 | **Test architecture** | Jest jsdom + Playwright e2e are broad (~580 + ~30). Coverage exclusions for Map/image-upload/ArticleEditor/Gallery are intentional. Two QA test-case backlogs (create/edit travel `TD-025`, quests `TD-026`) are Open but **browser-blocked** in headless env. | **keep** (test infra) / unblock TD-025/026 separately | `__tests__/*`, `e2e/*` | env, not code | n/a | Мариночка (QA) | P1 (env-gated) |
| A16 | **PDF export subsystem** | `services/pdf-export/*` already split (TD-018/021), golden snapshots stable; `BookSettingsModal` 743 LOC. | **keep** | `services/pdf-export/*`, `components/export/*` | golden-output regression | `jest pdf` (snapshots 0 updated) | — | P3 |

---

## 3. Cross-cutting risks

- **scripts/ is protected** (`CLAUDE.md`). A9/PERF-017 and any new guard need explicit user approval before touching `scripts/`.
- **Browser-gated work** (A12/A13 perf e2e, A15 manual QA, marker reshoots) repeatedly blocked by dev-SSR crash on `/travels/[slug]`; the proven workaround is the static `dist/prod` SPA via `.claude/prod-server.js` with `/api/`→`metravel.by` ([[static_spa_browser_verify]]). Any visible-UI decision above must verify through that path, not the crashing dev server.
- **No big-bang rewrites**: every `rework` row is explicitly a behavior-neutral, staged pass routed through a profile agent with per-stage `check:fast` + guards, per the Performance Refactor backlog rules.

## 4. Recommended starting order (for next dev pickups)

Mirrors `docs/PERF_SPEEDUP_PLAN.md` and the open backlog:

1. **A12 / PERF-010** (Places deferred islands) — P1, entry-point page, biggest user-facing win.
2. **A5** residual god-component splits crossing 800 (`ListTravelBase` 824 first) — P2, unblocks file-complexity guard.
3. **A9 / PERF-017** eager-bytes production guard — P2, *requires scripts/ approval*.
4. **A10 / PERF-007** travel heavy-chunk split, then **A11 / PERF-009** marker perf.
5. **A13 / PERF-016** retina byte audit alongside any card-media change.

## 5. What is explicitly NOT to be reworked

`keep` rows A1–A4, A8, A14, A16 are proven or guard-enforced. Do not reopen them without a fresh repro + ticket, per the board's "do not retest closed work" rule.

---

Evidence basis: file/LOC scan of `app/ components/ screens/ hooks/ services/ api/ stores/ context/`, `package.json` scripts, `metro.config.js`, `jest.config.js`, and the existing PERF-*/TD-* ledger in `docs/AGENT_WORKBOARD.md`. This is an audit artifact (docs-only), no code or runtime surface changed.
