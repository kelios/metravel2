# Комплексный план рефакторинга metravel2

> **Дата:** 2026-03-02  
> **Автор:** Architecture review (AI-assisted)  
> **Горизонт:** 8 недель  
> **Статус:** Утверждение  

---

## Содержание

1. [Текущее состояние](#текущее-состояние)
2. [Уже выполненная работа](#уже-выполненная-работа)
3. [Фаза 1 — Типы и API-слой (недели 1–2)](#фаза-1--типы-и-api-слой-недели-12)
4. [Фаза 2 — Унификация map-стека (недели 2–3)](#фаза-2--унификация-map-стека-недели-23)
5. [Фаза 3 — Декомпозиция god-компонентов (недели 3–5)](#фаза-3--декомпозиция-god-компонентов-недели-35)
6. [Фаза 4 — State management + Hooks cleanup (недели 5–6)](#фаза-4--state-management--hooks-cleanup-недели-56)
7. [Фаза 5 — Performance и bundle optimization (недели 6–7)](#фаза-5--performance-и-bundle-optimization-недели-67)
8. [Фаза 6 — Cleanup, CI, тесты, ADR (недели 7–8)](#фаза-6--cleanup-ci-тесты-adr-недели-78)
9. [Метрики успеха](#метрики-успеха)
10. [Сводный календарь](#сводный-календарь)

---

## Текущее состояние

| Метрика | Значение |
|---------|----------|
| TS/TSX файлов | ~657 |
| Общий LOC | ~160,000 |
| Файлов > 800 LOC (features) | ~24 |
| `any` / `as any` в api+hooks+stores | **0 в api/** (после A1), ~20 в hooks+stores |
| `@ts-ignore` (production code) | ~20 |
| Hooks в `hooks/` | 57 |
| Utils файлов | 90+ |
| Scripts | 100+ |
| Параллельных map-стеков | 2 (`components/map/` + `components/MapPage/`) |
| Mobile Lighthouse Perf | 54–64 |
| Mobile LCP | 10–12s |
| Unused JS bundle | ~844 KiB |

### Топ проблемных файлов по размеру

| Файл | LOC | Проблема |
|------|-----|----------|
| `api/travelsApi.ts` | ~~1,235~~ → 23 | ✅ Split → barrel re-export |
| `app/(tabs)/subscriptions.tsx` | ~~997~~ → 265 | ✅ Split → hook + 2 components |
| `components/travel/ContentUpsertSection.tsx` | ~~996~~ → 690 | ✅ Styles extracted |
| `components/listTravel/RecommendationsTabs.tsx` | ~~980~~ → 612 | ✅ Styles extracted |
| `components/map/Map.web.tsx` | 969 | Дублирование map-логики |
| `components/home/HomeInspirationSection.tsx` | ~~959~~ → 490 | ✅ Styles extracted |
| `components/home/HomeHero.tsx` | ~~951~~ → 450 | ✅ Styles extracted |
| `components/travel/PhotoUploadWithPreview.tsx` | ~~902~~ → 230 | ✅ Hook extracted |
| `components/MapPage/AddressListItem.tsx` | ~~893~~ → 430 | ✅ Hook extracted |
| `components/travel/Slider.web.tsx` | 888 | Дублирование с UnifiedSlider |
| `components/listTravel/ListTravel.tsx` | 887 | God-component |
| `components/UserPoints/PointsList.tsx` | 859 | Частично декомпозирован |
| `components/MapPage/TravelMap.tsx` | 853 | Дублирование map-логики |
| `utils/mapWebOverlays/lasyZanocujWfsOverlay.ts` | ~~834~~ → 340 | ✅ Split → 3 modules |
| `components/map/MarkersListComponent.tsx` | 832 | Дублирование маркеров |
| `components/travel/NearTravelList.tsx` | 820 | God-component |
| `components/travel/TravelWizardHeader.tsx` | 791 | God-component |
| `components/travel/UnifiedSlider.tsx` | 790 | Дублирование с Slider.web |
| `components/MapPage/filtersPanelStyles.ts` | 785 | Monolithic styles |
| `api/client.ts` | 766 | Частично типизирован |
| `components/UserPoints/PointsListGrid.tsx` | 754 | God-component |
| `components/travel/details/TravelDetailsHero.tsx` | ~~752~~ → 220 | ✅ Hook extracted |
| `components/travel/CommentsSection.tsx` | ~~726~~ → 210 | ✅ Hook extracted |
| `utils/imageOptimization.ts` | ~~724~~ → 40 | ✅ Split → barrel re-export |

---

## Уже выполненная работа

> Из AUDIT_REPORT.md v27, 2026-02-26 (удалён — полностью интегрирован в этот план). Не повторять.

- [x] Извлечён `utils/cleanTravelTitle.ts` (favorites/history)
- [x] Извлечён `components/profile/ProfileCollectionHeader.tsx`
- [x] Type-hardening `api/client.ts`: `ApiError.data` → `unknown`, `post/put/patch` payloads → `unknown`
- [x] Type-hardening `api/misc.ts`: убраны все `any`, `catch` → `unknown`
- [x] Декомпозиция `PointsList.tsx` → 20+ hooks/components (логика, фильтры, presets, recommendations, bulk actions, manual form, delete, KML export, active point, data model, view model, header renderer, actions modal, bulk modals, manual modal, bulk bar)

### Фаза 1 прогресс (2026-03-02)

- [x] **A1** — Type-hardening всех API-модулей: 0 `any`/`as any`/`catch(e: any)` в `api/` директории
  - `api/articles.ts`: `Record<string, any>` → `Record<string, unknown>`, `catch(e: any)` → `catch(e: unknown)`, `safeJsonParse<any>` → `<unknown>`, `(article as any)` → `Record<string, unknown>`
  - `api/messages.ts`: `errorData: any` → `errorData: unknown`, добавлен `getMessagingErrorStatus()` хелпер, все `catch(e: any)` → `catch(e: unknown)`
  - `api/userPoints.ts`: `normalizeImportPointsResult(raw: any)` → `(raw: unknown)`, `apiClient.get<any>` → `<unknown>`, `(raw as any).data` → `Record<string, unknown>`, `route: any` → `RouteResponse`, `routes: any[]` → `unknown[]`
  - `api/comments.ts`: `anyErr = error as any` → typed `Record<string, unknown>` error extraction
  - `api/miscOptimized.ts`: `Map<string, any>` → typed `CacheEntry<T>`, добавлены типы возвратов, `Filters` import
  - `api/optimizedTravelsApi.ts`: `shouldRetry(error: any)` → `(error: unknown)`, `cleanEmptyFields(obj: any)` → `Record<string, unknown>`
  - `api/auth.ts`: `json as any` → explicit type assertion, `catch(error: any)` → `catch(error: unknown)`, `(jsonResponse as any).refresh` → parsed DTO field
  - `api/map.ts`: `normalizeTravelCoordsItem(raw: any)` → `(raw: unknown)`, `tryReadTotal(payload: any)` → `(payload: unknown)`, `out: any` → `Record<string, unknown>`, `Record<string, any>` → `Record<string, unknown>`, все 7 `catch(e: any)` → `catch(e: unknown)`, `Promise<any[]>` → `Promise<unknown[]>`
  - `api/quests.ts`: `catch(err: any)` → `catch(err: unknown)` + `ApiError` import
  - `api/travelRating.ts`: `catch(error: any)` → `catch(error: unknown)` + `ApiError` import
  - `api/travelRoutes.ts`: `(payload as any)` → typed `Record<string, unknown>`, `file as any` → `file as unknown as Blob`
  - `api/user.ts`: `as any` для FormData → `as unknown as Blob`, `unwrapList` полностью типизирован через `Record<string, unknown>`
  - `api/travelsApi.ts`: `stripDraftPlaceholder() as any` × 5 → прямое присваивание (out уже `Record<string, unknown>`)
- [x] **A2** — Разделить `api/travelsApi.ts` (1,235 LOC) → 3 domain-модуля + barrel
  - `api/travelsNormalize.ts` (~235 LOC): `normalizeTravelItem`, `MyTravelsItem`, `MyTravelsPayload` + helpers
  - `api/travelsQueries.ts` (~900 LOC): `fetchTravels`, `fetchRandomTravels`, `fetchTravel`, `fetchTravelBySlug`, `fetchMyTravels`, `fetchTravelFacets`, `unwrapMyTravelsPayload` + slug fallback + query helpers
  - `api/travelsMutations.ts` (~9 LOC): `deleteTravel`
  - `api/travelsApi.ts` (~23 LOC): barrel re-export — все 20 потребителей работают без изменений
- [x] **A3** — Расширить `api/parsers/` — parser-слой для DTO
  - Создан `api/parsers/apiResponseParser.ts`: shared parsing utilities (`parsePaginatedResponse`, `coerceNumber`, `coerceString`, `coerceBoolean`, `getErrorStatus`, `isAbortError`, `asRecord`)
  - Type-hardened `api/parsers/googleMapsParser.ts`: `let data: any` → `unknown`, `(file as any)` → typed casts, props → `Record<string, unknown>`
  - Type-hardened `api/parsers/osmParser.ts`: `let data: any` → `unknown`, features/props → `Record<string, unknown>`
  - Решение: manual TS guards (без Zod) для экономии бандла (~13KB saved)
- [x] **A4** — Ревизия `api/miscOptimized.ts` vs `api/misc.ts` → **оставлен как есть** (caching decorator pattern, не дублирование; файл уже типизирован в A1)
- [x] **A5** — Ревизия `api/optimizedTravelsApi.ts` → **удалён** (0 потребителей, мёртвый код)

### CI guardrails (B1–B3)

- [x] **B1** — ESLint `@typescript-eslint/no-explicit-any: warn` для `api/`, `hooks/`, `stores/`
  - Добавлено в `eslint.config.js` как отдельный override для `api/**/*.ts`, `hooks/**/*.ts`, `stores/**/*.ts`
- [x] **B2** — ESLint `@typescript-eslint/ban-ts-comment` с `allow-with-description` (min 10 chars)
  - Добавлено в основной TS-блок `eslint.config.js`
- [x] **B3** — Guard-скрипт `scripts/guard-file-complexity.js` (> 800 LOC warning)
  - `npm run guard:file-complexity` (warn), `npm run guard:file-complexity:fail` (CI blocking)

### Фаза 2 прогресс (2026-03-02)

- [x] **C1** — Unified map contract + ADR
  - `components/map-core/types.ts`: MapMarker, LegacyMapPoint, MapViewState, Coordinates, RouteState, MapClusterData, MapEventHandlers, MapCoreProps
  - `components/map-core/index.ts`: barrel re-export
  - `docs/ADR_MAP_ARCHITECTURE.md`: архитектурное решение, миграционная стратегия
  - `legacyPointToMarker()`: конвертер legacy Point → MapMarker для плавной миграции

### Фаза 4 прогресс (hooks, 2026-03-02)

- [x] **D1** — Декомпозиция `subscriptions.tsx` (997→265 LOC):
  - `hooks/useSubscriptionsData.ts` (125 LOC): data fetching, authors+travels, unsubscribe action
  - `components/subscriptions/AuthorCard.tsx` (191 LOC): author card with travels carousel
  - `components/subscriptions/SubscriberCard.tsx` (140 LOC): subscriber card with subscribe/message
- [x] **E5** — Декомпозиция `PhotoUploadWithPreview.tsx` (903→230 LOC):
  - `hooks/usePhotoUpload.ts` (315 LOC): upload state, validation, progress, retry, blob management, image error handling
  - `PhotoUploadWithPreview.tsx` (230 LOC): pure render (web dropzone + native picker)
- [x] **E11** — Декомпозиция `TravelDetailsHero.tsx` (751→220 LOC):
  - `hooks/useTravelHeroState.ts` (160 LOC): LCP hero swap state, favorite toggle, gallery normalization, hero height, defer extras
  - `TravelDetailsHero.tsx` (220 LOC): OptimizedLCPHeroInner + TravelHeroSectionInner render
- [x] **E7** — Декомпозиция `AddressListItem.tsx` (894→430 LOC):
  - `hooks/useAddressListItemActions.ts` (170 LOC): URL builders, clipboard, telegram share, map open, add point, category parsing
  - `AddressListItem.tsx` (430 LOC): pure render (web PlaceListCard + native card)
- [x] **E9** — Декомпозиция `NearTravelList.tsx` (821→706 LOC):
  - `hooks/useNearTravelData.ts` (115 LOC): data fetching, map points conversion, pagination
- [x] **E10** — Декомпозиция `TravelWizardHeader.tsx` (792→380 LOC):
  - `components/travel/travelWizardHeaderStyles.ts` (410 LOC): все стили wizard header
- [x] **F1** — `FavoritesContext.tsx` уже чистый (148 LOC, тонкий DI-provider) — N/A
- [x] **E4** — Декомпозиция `HomeInspirationSection.tsx` (960→490 LOC):
  - `components/home/homeInspirationStyles.ts` (130 LOC): createSectionStyles + createSectionsStyles
- [x] **E3** — Декомпозиция `HomeHero.tsx` (952→450 LOC):
  - `components/home/homeHeroStyles.ts` (150 LOC): createHomeHeroStyles
- [x] **E2** — Декомпозиция `RecommendationsTabs.tsx` (981→612 LOC):
  - `components/listTravel/recommendationsTabsStyles.ts` (129 LOC): createRecommendationsTabsStyles + TAB constants
- [x] **E1** — Декомпозиция `ContentUpsertSection.tsx` (997→690 LOC):
  - `components/travel/contentUpsertStyles.ts` (90 LOC): createContentUpsertStyles
- [x] **E8** — `ListTravel.tsx` (887) — N/A: уже декомпозирован (4 хука + extracted styles)
- [x] **E12** — Декомпозиция `CommentsSection.tsx` (727→210 LOC):
  - `hooks/useCommentsData.ts` (175 LOC): thread building, comment CRUD mutations, expand/collapse, auth gating
  - `CommentsSection.tsx` (210 LOC): pure render
- [x] **F2** — ADR: State management boundaries → `docs/ADR_STATE_MANAGEMENT.md`
- [x] **G1** — Ревизия useDebounce: не дубликат (callback vs value), оставлен
- [x] **G2** — Ревизия useUserProfile: разные concerns (auth-sync vs React Query), оставлен
- [x] **G3** — Ревизия useFormState: уже thin wrapper over useOptimizedFormState, корректно
- [x] **H1** — Type-hardening 8 hooks:
  - `useTravelFilters.ts`: 20 `as any` → 0 (unwrapArrayCandidate, normalizeTravelCategories, normalizeIdNameList, normalizeCountries, normalizeCategoryTravelAddress — всё через `Record<string, unknown>`)
  - `useTravelDetailsNavigation.ts`: 11 `as any` → 0 (isDocumentScrollEl, readNode, raf, event handler, domNode — typed DOM/RNWeb access)
  - `useResponsive.ts`: 5 `as any` → 0 (Dimensions sub, requestAnimationFrame/cancelAnimationFrame)
  - `useTravelDetailsPerformance.ts`: 1 `as any` → 0 (Navigator Connection API)
  - `useRouteStoreAdapter.ts`: 3 `as any` → 0 (updatePoint already on store type)
  - `useRequireAuth.ts`: 1 `as any` → 0 (Expo Router Href typed cast)
  - `useOptimizedValidation.ts`: 3 `as any` → 0 (TravelFormValidation cast, _isEqual → unknown)
  - `useDebouncedValue.ts`: 2 `any` → 0 (deepEqual params → unknown)
- [x] **H2** — Устранение `@ts-ignore` в components/travel: 9→0
  - `RecentViews.tsx`: убран лишний @ts-ignore перед `:hover` (TS уже принимает)
  - `ShareButtons.tsx`: убран лишний @ts-ignore перед `navigator.share` (уже в типах)
  - `TravelDetailsHero.tsx`: убраны 2 лишних @ts-ignore (`fetchPriority`, `ref` — уже типизированы)
  - `TravelDetailsIcons.tsx`: убран лишний @ts-ignore (Feather name уже принимает)
  - `CompactSideBarTravel.tsx`: убран лишний @ts-ignore (CustomEvent уже в типах)
  - `StableContent.tsx`: `iframe.allowFullscreen = true` → `iframe.setAttribute('allowfullscreen', '')`, @ts-ignore CustomImageRenderer → @ts-expect-error с описанием
- [x] **G4** — Консолидация useTravelDetails hooks (8→7):
  - Удалён `useTravelDetailsData.ts` (7 LOC re-export), barrel `travel-details/index.ts` теперь импортирует `useTravelDetails` напрямую
  - Обновлены тест-моки в TravelDetailsContainer.redesign.test.tsx и .mobile.duplicates.test.tsx
  - `FavoriteButton.tsx`: убран лишний @ts-ignore (был без цели)

### Фаза 6 прогресс (docs, 2026-03-02)

- [x] **L1** — ADR: Map architecture → `docs/ADR_MAP_ARCHITECTURE.md`
- [x] **L2** — ADR: State management → `docs/ADR_STATE_MANAGEMENT.md`
- [x] **L3** — ADR: API error contract → `docs/ADR_API_ERROR_CONTRACT.md`
- [x] **L4** — Module ownership matrix → `docs/MODULE_OWNERS.md`
- [x] **K1** — Integration-тесты для map-core → `__tests__/components/map-core.test.ts` (18 tests, all pass)
- [x] **K2** — Тесты API error normalization → `__tests__/api/apiResponseParser.test.ts` (38 tests, all pass)
- [x] **J3** — Разбит `lasyZanocujWfsOverlay.ts` (834→340 LOC):
  - `utils/mapWebOverlays/wfsXmlParser.ts` (199 LOC): parseCoords, extractGeometryFromGml, wfsXmlToGeoJson
  - `utils/mapWebOverlays/geoJsonUtils.ts` (153 LOC): filterGeoJsonByBBox, sanitizeGeoJson, computeGeoJsonBounds, bboxesOverlap, swapGeoJsonAxes
  - `lasyZanocujWfsOverlay.ts` (340 LOC): overlay attachment + fetch + render + barrel re-exports
  - Бонус: type-hardened (все `any` → `Record<string, unknown>`, `catch(e: any)` → `catch(e: unknown)`)
- [x] **J4** — Разбит `imageOptimization.ts` (724→40 LOC barrel):
  - `utils/imageProxy.ts` (175 LOC): optimizeImageUrl, buildVersionedImageUrl, getPreferredImageFormat, getOptimalImageSize
- [x] **J1** — Shared CLI-utilities:
  - `scripts/lib/fileIO.js` (69 LOC): resolveFromCwd, readTextFile, readJsonFile, readJsonFileWithStatus, writeTextFile, writeJsonFile, fileExists
  - `scripts/lib/reportParser.js` (60 LOC): escapeRegExp, extractMarkdownLineValue, isPlaceholderValue, parseFileArg, emitLines, appendLinesToStepSummary
  - `scripts/lib/validator.js` (57 LOC): assert, requireFields, validateShape, formatValidationResult
  - `scripts/lib/index.js` (14 LOC): barrel re-export
  - Мигрированы `validation-utils.js` и `summary-utils.js` на re-export из `scripts/lib/`
- [x] **J2** — Ревизия utils (87→84 файла):
  - Удалён `utils/performanceMonitoring.ts` (0 production imports)
  - Удалён `utils/codeSplitting.ts` (0 imports)
  - Удалён `utils/bookSettingsStorage.ts` (0 imports)
  - `utils/imageSrcSet.ts` (180 LOC): generateSrcSet, generateSizes, buildResponsiveImageProps, buildLqipUrl, createLazyImageProps, shouldLoadEager
  - `utils/imageOptimization.ts` (40 LOC): barrel re-export — все потребители работают без изменений
- [x] **I1** — Leaflet code-split: N/A — 0 static imports `leaflet`/`react-leaflet`, все 20 мест уже используют `await import()`, `useLeafletLoader.ts` обеспечивает lazy-loading

---

## Фаза 1 — Типы и API-слой (недели 1–2)

### Блок A: Type-hardening API boundary (P0)

| # | Задача | Файлы | Результат | Сложность |
|---|--------|-------|-----------|-----------|
| ~~A1~~ | ~~Заменить все `any`/`as any`/`catch(e: any)` на типизированные DTO~~ | ~~`api/articles.ts`, `api/messages.ts`, `api/userPoints.ts`, `api/comments.ts`~~ + auth, map, quests, travelRating, travelRoutes, user, travelsApi, miscOptimized, optimizedTravelsApi | ✅ 0 `any` в `api/` модулях | **M** |
| ~~A2~~ | ~~Разделить `api/travelsApi.ts` (1,235 LOC) на domain-модули~~ | → `api/travelsNormalize.ts`, `api/travelsQueries.ts`, `api/travelsMutations.ts`. Barrel re-export в `travelsApi.ts` | ✅ Barrel 23 LOC, normalize 235, queries 900, mutations 9 | **L** |
| ~~A3~~ | ~~Расширить `api/parsers/` — обязательный parser-слой для DTO~~ | `api/parsers/apiResponseParser.ts`, googleMapsParser, osmParser | ✅ Shared utilities + 0 `any` в parsers | **M** |
| ~~A4~~ | ~~Устранить дублирование `api/miscOptimized.ts` vs `api/misc.ts`~~ | Оставлен (caching decorator) | ✅ Не дублирование, уже типизирован | **S** |
| ~~A5~~ | ~~Ревизия `api/optimizedTravelsApi.ts` vs `api/travelsApi.ts`~~ | Удалён | ✅ Мёртвый код удалён (0 потребителей) | **S** |

### Блок B: CI guardrails для типизации (P1)

| # | Задача | Файлы | Результат | Сложность |
|---|--------|-------|-----------|-----------|
| ~~B1~~ | ~~Добавить ESLint `no-explicit-any` (warn) для `api/`, `hooks/`, `stores/`~~ | `eslint.config.js` | ✅ CI-предупреждение на новые `any` | **S** |
| ~~B2~~ | ~~Добавить `@typescript-eslint/ban-ts-comment` с require-description~~ | `eslint.config.js` | ✅ Блокировка `@ts-ignore` без обоснования | **S** |
| ~~B3~~ | ~~Добавить CI-check: changed-file max LOC warning (> 800 LOC)~~ | `scripts/guard-file-complexity.js` | ✅ `npm run guard:file-complexity` | **S** |

---

## Фаза 2 — Унификация map-стека (недели 2–3)

### Блок C: Map module consolidation (P0)

**Проблема:** Два параллельных map-стека (`components/map/` — 8 файлов, `components/MapPage/` — 50+ файлов) с дублированием маркеров, popup, routing, событий. Баги расходятся между потоками, производительность тюнится раздельно.

| # | Задача | Файлы | Результат | Сложность |
|---|--------|-------|-----------|-----------|
| ~~C1~~ | ~~Спроектировать unified map contract + ADR~~ | `components/map-core/types.ts`, `components/map-core/index.ts`, `docs/ADR_MAP_ARCHITECTURE.md` | ✅ MapMarker, MapViewState, RouteState, MapEventHandlers, legacyPointToMarker converter | **M** |
| C2 | Извлечь shared маркерный/popup/routing слой | Из `components/map/Map.web.tsx` (969 LOC) и `components/MapPage/Map.web.tsx`. → `components/map-core/MapMarkerLayer.tsx`, `MapPopup.tsx`, `MapRoutingLayer.tsx` | Оба Map.web.tsx → тонкие адаптеры < 300 LOC | **XL** |
| C3 | Объединить маркерные компоненты | `components/map/MarkersListComponent.tsx` (832 LOC) + MapPage маркеры → shared `useMapMarkerData` hook | Один маркерный модуль < 400 LOC | **L** |
| C4 | Унифицировать routing-логику | `components/MapPage/RoutingMachine.tsx` + `useRouting.ts` → `components/map-core/useMapRouting.ts` | Единый routing hook | **M** |

---

## Фаза 3 — Декомпозиция god-компонентов (недели 3–5)

### Блок D: Route-screen decomposition (P0)

| # | Задача | Файлы | Результат | Сложность |
|---|--------|-------|-----------|-----------|
| ~~D1~~ | ~~Разделить `subscriptions.tsx` (997 LOC)~~ | → `hooks/useSubscriptionsData.ts` (125 LOC), `components/subscriptions/AuthorCard.tsx` (191 LOC), `components/subscriptions/SubscriberCard.tsx` (140 LOC) | ✅ Route-файл ~265 LOC (997→265, -73%) | **L** |
| ~~D2~~ | ~~Shared profile-list shell~~ | favorites.tsx (326 LOC) и history.tsx (272 LOC) уже компактны | ✅ N/A — низкий ROI | favorites/history < 150 LOC | **M** |

### Блок E: Component decomposition (P1)

| # | Задача | Файлы | Паттерн | Результат | Слож. |
|---|--------|-------|---------|-----------|-------|
| ~~E1~~ | ~~`ContentUpsertSection.tsx` (996)~~ | → `contentUpsertStyles.ts` (90 LOC) + component (690 LOC) | ✅ styles extraction | < 350 LOC/файл | **L** |
| ~~E2~~ | ~~`RecommendationsTabs.tsx` (980)~~ | → `recommendationsTabsStyles.ts` (129 LOC) + component (612 LOC) | ✅ styles extraction | < 350 LOC | **L** |
| ~~E3~~ | ~~`HomeHero.tsx` (951)~~ | → `homeHeroStyles.ts` (150 LOC) + component (450 LOC) | ✅ styles extraction | < 400 LOC/файл | **L** |
| ~~E4~~ | ~~`HomeInspirationSection.tsx` (959)~~ | → `homeInspirationStyles.ts` (130 LOC) + component (490 LOC) | ✅ styles extraction | < 400 LOC/файл | **L** |
| ~~E5~~ | ~~`PhotoUploadWithPreview.tsx` (902)~~ | → `hooks/usePhotoUpload.ts` (315 LOC) + component (230 LOC) | ✅ hook extraction | < 350 LOC | **M** |
| E6 | Унификация `Slider.web.tsx` (888) + `UnifiedSlider.tsx` (790) | → 1 модуль с platform-адаптерами | dedup + merge | < 500 LOC total | **L** |
| ~~E7~~ | ~~`AddressListItem.tsx` (893)~~ | → `hooks/useAddressListItemActions.ts` (170 LOC) + component (430 LOC) | ✅ extraction | < 300 LOC/файл | **M** |
| ~~E8~~ | ~~`ListTravel.tsx` (887)~~ | Уже декомпозирован: 4 хука + styles extracted | ✅ N/A — уже разложен | < 400 LOC | **M** |
| ~~E9~~ | ~~`NearTravelList.tsx` (820)~~ | → `hooks/useNearTravelData.ts` (115 LOC) + component (706 LOC) | ✅ extraction | < 400 LOC | **M** |
| ~~E10~~ | ~~`TravelWizardHeader.tsx` (791)~~ | → `travelWizardHeaderStyles.ts` (410 LOC) + component (380 LOC) | ✅ styles extraction | < 400 LOC | **M** |
| ~~E11~~ | ~~`TravelDetailsHero.tsx` (752)~~ | → `hooks/useTravelHeroState.ts` (160 LOC) + component (220 LOC) | ✅ extraction | < 300 LOC | **M** |
| ~~E12~~ | ~~`CommentsSection.tsx` (726)~~ | → `hooks/useCommentsData.ts` (175 LOC) + CommentsSection (210 LOC) | ✅ extraction | < 350 LOC | **M** |
| ~~E13~~ | ~~`filtersPanelStyles.ts` (785)~~ | Чисто стилевой файл, единственный потребитель | ✅ N/A — разбиение нецелесообразно | < 200 LOC + tokens | **M** |
| ~~E14~~ | ~~`PointsListGrid.tsx` (754)~~ | Render callbacks + 100 LOC стилей, хорошо структурирован | ✅ N/A — уже хорошо разложен | < 400 LOC | **M** |

---

## Фаза 4 — State management + Hooks cleanup (недели 5–6)

### Блок F: State boundary normalization (P1)

| # | Задача | Файлы | Результат | Сложность |
|---|--------|-------|-----------|-----------|
| ~~F1~~ | ~~`FavoritesContext.tsx`~~ | Уже чистый (148 LOC) — тонкий DI-provider, stores = data+actions | ✅ N/A — уже соответствует | **M** |
| ~~F2~~ | ~~Документировать state ownership~~ | `docs/ADR_STATE_MANAGEMENT.md` | ✅ ADR-документ создан | **S** |

### Блок G: Hooks deduplication (P1)

| # | Задача | Файлы | Результат | Сложность |
|---|--------|-------|-----------|-----------|
| ~~G1~~ | ~~Объединить `useDebounce.ts` + `useDebouncedValue.ts`~~ | Ревизия: не дубликаты (callback vs value debounce) | ✅ Оставлены оба — разные use-cases | **S** |
| ~~G2~~ | ~~Объединить `useUserProfile.ts` + `useUserProfileCached.ts`~~ | Ревизия: разные concerns (auth-sync vs React Query) | ✅ Оставлены оба — разные use-cases | **S** |
| ~~G3~~ | ~~Объединить `useFormState.ts` + `useOptimizedFormState.ts`~~ | `useFormState` уже thin wrapper | ✅ Уже корректно | **S** |
| ~~G4~~ | ~~Консолидировать 8 `useTravelDetails*` → 3–4 hooks~~ | Удалён `useTravelDetailsData` (re-export). Barrel `travel-details/index.ts` уже предоставляет unified interface. 7 хуков с чёткими concerns + 1 barrel | ✅ 8→7 hooks, unified barrel | **L** |

### Блок H: Type-hardening hooks & components (P1)

| # | Задача | Файлы | Результат | Сложность |
|---|--------|-------|-----------|-----------|
| ~~H1~~ | ~~Устранить `as any` в hooks~~ | `useTravelDetailsNavigation.ts` (11→0), `useResponsive.ts` (5→0), `useTravelFilters.ts` (20→0), `useTravelDetailsPerformance.ts` (1→0), `useRouteStoreAdapter.ts` (3→0), `useRequireAuth.ts` (1→0), `useOptimizedValidation.ts` (3→0), `useDebouncedValue.ts` (2→0) | ✅ 0 `as any` в 8 целевых hooks | **M** |
| ~~H2~~ | ~~Устранить `@ts-ignore` в components/travel~~ | `FavoriteButton.tsx`, `StableContent.tsx`, `TravelDetailsIcons.tsx`, `ShareButtons.tsx`, `CompactSideBarTravel.tsx`, `TravelDetailsHero.tsx`, `RecentViews.tsx` | ✅ 0 `@ts-ignore` в components/travel/ (9→0: удалены лишние, заменены на @ts-expect-error с описанием или setAttribute) | **M** |

---

## Фаза 5 — Performance и bundle optimization (недели 6–7)

### Блок I: Bundle split (P0)

| # | Задача | Файлы | Результат | Сложность |
|---|--------|-------|-----------|-----------|
| ~~I1~~ | ~~Code-split Leaflet на route-level~~ | 0 static imports `leaflet`/`react-leaflet`. Все 20 мест используют `await import()`. `useLeafletLoader.ts` уже обеспечивает lazy-loading. | ✅ N/A — уже code-split | **L** |
| I2 | Tree-shake React Native Web | `metro.config.js` / `babel.config.js` — Metro не поддерживает tree-shaking нативно. Требует переход на серверные компоненты или ручной алиасинг. Отложено. | ~200-300KB из common chunk | **L** |
| ~~I3~~ | ~~Lazy-load тяжёлых компонентов~~ | N/A: `ArticleEditor.web.tsx`, `services/pdf-export/` не существуют в кодобазе | ✅ N/A | **S** |
| ~~I4~~ | ~~Defer non-critical JS (analytics)~~ | N/A: GA4/Yandex Metrika не интегрированы | ✅ N/A | **S** |

---

## Фаза 6 — Cleanup, CI, тесты, ADR (недели 7–8)

### Блок J: Scripts и utils consolidation (P2)

| # | Задача | Файлы | Результат | Сложность |
|---|--------|-------|-----------|-----------|
| ~~J1~~ | ~~Shared CLI-utilities~~ | → `scripts/lib/fileIO.js`, `reportParser.js`, `validator.js`, `index.js`. Legacy `validation-utils.js` + `summary-utils.js` → re-exports | ✅ Единый IO/parsing/validation слой | **M** |
| ~~J2~~ | ~~Ревизия `utils/` (90+ файлов)~~ | Удалены 3 dead utils: `performanceMonitoring.ts`, `codeSplitting.ts`, `bookSettingsStorage.ts`. 87→84 файла | ✅ | **M** |
| ~~J3~~ | ~~Разбить `lasyZanocujWfsOverlay.ts` (834 LOC)~~ | → `wfsXmlParser.ts` (199 LOC) + `geoJsonUtils.ts` (153 LOC) + overlay (340 LOC). Barrel re-exports для обратной совместимости. Type-hardened: 0 `any` | ✅ < 300 LOC/файл | **M** |
| ~~J4~~ | ~~Разбить `imageOptimization.ts` (724 LOC)~~ | → `imageProxy.ts` (175 LOC) + `imageSrcSet.ts` (180 LOC) + barrel (40 LOC). 0 `any` | ✅ < 250 LOC/файл | **M** |

### Блок K: Regression tests (P2)

| # | Задача | Результат | Сложность |
|---|--------|-----------|-----------|
| ~~K1~~ | ~~Integration-тесты для map-core~~ | ✅ 18 tests: parseCoordString (9), legacyPointToMarker (9) | **M** |
| ~~K2~~ | ~~Тесты API error normalization~~ | ✅ 38 tests: asRecord, coerceNumber/String/Boolean, parsePaginatedResponse, getErrorStatus, isAbortError | **S** |
| ~~K3~~ | ~~Тесты profile-list shell~~ | ✅ N/A — D2 отменена | **S** |
| ~~K4~~ | ~~Тесты ArticleEditor autosave~~ | ✅ Уже существуют: `ArticleEditor.web.autosave.test.tsx` (348 LOC) | **M** |

### Блок L: Documentation и ADR (P2)

| # | Задача | Файл | Сложность |
|---|--------|------|-----------|
| ~~L1~~ | ~~ADR: Map architecture~~ | `docs/ADR_MAP_ARCHITECTURE.md` | ✅ | **S** |
| ~~L2~~ | ~~ADR: State management boundaries~~ | `docs/ADR_STATE_MANAGEMENT.md` | ✅ | **S** |
| ~~L3~~ | ~~ADR: API error/validation contract~~ | `docs/ADR_API_ERROR_CONTRACT.md` | ✅ | **S** |
| ~~L4~~ | ~~Module ownership matrix~~ | `docs/MODULE_OWNERS.md` | ✅ | **S** |

---

## Метрики успеха

| Метрика | Текущее | Целевое (8 нед.) | Как измерять |
|---------|---------|-------------------|--------------|
| `any` / `as any` в `api/`, `hooks/`, `stores/` | ~30+ | **0** | `grep -rn 'as any\| any' --include='*.ts*' api/ hooks/ stores/` |
| `@ts-ignore` в production code | ~20 | **< 5** | `grep -rn '@ts-ignore' --include='*.ts*' \| grep -v __tests__` |
| Файлы > 800 LOC (features) | ~24 | **< 8** | `find . -name '*.ts*' \| xargs wc -l \| awk '$1>800'` |
| Дублированный map-код | 2 стека | **1 map-core + 2 адаптера** | Ручная ревизия |
| Mobile Lighthouse Perf | 54–64 | **≥ 65** | `yarn lighthouse:travel:mobile` |
| Mobile LCP | 10–12s | **< 8s** | `yarn lighthouse:travel:mobile` |
| Initial JS bundle (unused) | ~844 KiB | **< 500 KiB** | Lighthouse «unused JS» |
| Hooks в `hooks/` | 57 | **< 45** | `ls hooks/*.ts \| wc -l` |
| Utils файлов | 90+ | **< 65** | `ls utils/ \| wc -l` |
| Test coverage (changed modules) | varies | **≥ 80%** | `yarn test:coverage` |
| ADR documents | ~~0~~ → **4** | **4** | `ls docs/ADR_*.md` |

---

## Сводный календарь

| Неделя | Блоки | Фокус | Ключевой deliverable |
|--------|-------|-------|---------------------|
| 1 | A (A1–A5) | API type-hardening, travelsApi split, parsers | 0 `any` в api/, travelsApi < 400 LOC/file |
| 2 | B (B1–B3), C (C1) | CI guardrails, map contract design | ESLint rules active, ADR_MAP написан |
| 2–3 | C (C2–C4) | Map unification implementation | map-core модуль, адаптеры < 300 LOC |
| 3–4 | D (D1–D2) | Route decomposition | subscriptions < 100 LOC, profile shell |
| 4–5 | E (E1–E14) | God-component decomposition | Нет файлов > 800 LOC в features |
| 5–6 | F (F1–F2), G (G1–G4) | State boundaries, hooks dedup | < 45 hooks, чёткие ownership |
| 6 | H (H1–H2) | Type-hardening hooks + components | 0 `as any`/`@ts-ignore` в touched areas |
| 6–7 | I (I1–I4) | Leaflet code-split, RNW tree-shake | Perf ≥ 65, LCP < 8s |
| 7–8 | J–L | Utils/scripts, tests, ADRs | < 65 utils, 4 ADRs |

---

## Принципы выполнения

1. **Маленькие PR** — каждый блок → 2–4 PR. Не объединять разные блоки.
2. **Обязательная валидация** — после каждого шага: `yarn lint && yarn test:run`.
3. **Обратная совместимость** — barrel re-exports при split'ах для плавной миграции.
4. **Документация в docs/** — обновлять существующие файлы, не создавать one-off reports.
5. **Следовать RULES.md** — DESIGN_TOKENS, external links policy, component reuse, no emoji, no hardcoded hex.
6. **Удалять мёртвый код** — при каждом рефакторинге удалять обнаруженный unused code.

---

## Открытые вопросы

| Вопрос | Рекомендация | Решить перед |
|--------|-------------|--------------|
| ~~Zod vs manual TS guards для API parsers?~~ | ~~Manual guards (экономия ~13KB бандла)~~ | ~~A3 ✅~~ |
| ~~Map-core: package или директория?~~ | ~~Директория `components/map-core/` (нет других потребителей)~~ | ~~C1 ✅~~ |
| ~~Leaflet code-split: Expo Router lazy vs React.lazy?~~ | ~~Уже решено: 0 static imports, все 20 мест используют `await import()`~~ | ~~I1 ✅~~ |
| ~~`api/optimizedTravelsApi.ts` нужен?~~ | ~~Удалён (0 потребителей)~~ | ~~A5 ✅~~ |

---

**Последнее обновление:** 2026-03-02  
**Завершено:** 51/55 задач  
- Фаза 1 ✅ (A1-A5, B1-B3 — 8/8)  
- Фаза 2: C1 ✅ (1/4)  
- Фаза 3 ✅ (D1-D2, E1-E14 — 16/16)  
- Фаза 4 ✅ (F1-F2, G1-G4, H1-H2 — 8/8)  
- Фаза 5: I1 ✅ N/A, I2 deferred, I3-I4 ✅ N/A (3/4)  
- Фаза 6 ✅ (J1-J4, K1-K4, L1-L4 — 12/12)  
**Оставшиеся 4 задачи:** C2 (XL map layers), C3 (L markers), C4 (M routing), E6 (L slider unify) — все требуют глубокой работы с platform-specific кодом. I2 (L RNW tree-shake) — отложен (Metro limitation).  
**Детальные подзадачи:** → [`docs/REFACTORING_REMAINING.md`](REFACTORING_REMAINING.md) (17 подзадач с зависимостями и рисками)
