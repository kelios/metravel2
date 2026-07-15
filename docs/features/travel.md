# Фича: travel

**Последняя актуализация:** 2026-07-14

**Ответственный домен:** frontend travel

**Канонический обзор проекта:** [Архитектура и функциональность Metravel](../ARCHITECTURE.md)

## Назначение документа

Этот файл описывает текущие frontend-маршруты и ownership списка, публичной
детали и create/edit wizard. Он не подтверждает production readiness backend
операций. Publish/moderation, comments, rating, favorites, route files и upload
flows остаются backend-dependent и требуют runtime evidence для конкретной
задачи.

## TL;DR

Travel-домен состоит из трёх разных поверхностей:

1. list/search — `components/listTravel/`;
2. public detail — route `/travels/:param` и `components/travel/details/`;
3. create/edit wizard — routes `/travel/new`, `/travel/:id` и
   `components/travel/upsert/`.

`/travels/:param` — публичная деталь по slug/id. `/travel/:id` — редактирование,
а не detail route. Это различие обязательно сохранять в ссылках, SEO и тестах.

## Статус по поверхностям

| Поверхность | Реализация в репозитории | Что требует отдельной проверки |
| --- | --- | --- |
| Public catalog/search | pagination, filters, sorting, responsive cards | list/facets API, empty/error/stale states |
| User-owned list | auth-aware drafts/published filters | реальный user-scoped backend payload |
| Public detail | id/slug load, hero, content, map, deferred sections, SEO | API/media/comments/rating runtime и performance |
| Create/edit wizard | six steps, autosave, draft recovery, preview, publish step | upsert/upload/moderation contract и auth/access |
| Route files | list/upload/delete/download adapters | backend endpoint and multipart/download evidence |
| Embedded map | React Leaflet web / Leaflet-in-WebView native | browser and device point/card parity |

Наличие UI, adapter или mock/test path не означает, что соответствующий backend
contract развёрнут и готов на production.

## Маршруты и ownership

| Route | Route-файл | Feature owner | Назначение |
| --- | --- | --- | --- |
| `/search` | `app/(tabs)/search.tsx` | `components/listTravel/ListTravelRoute.tsx` | публичный поиск/каталог с filters и SEO |
| `/metravel` | `app/(tabs)/metravel.tsx`, `metravel.native.tsx` | `components/listTravel/ListTravelBase.tsx` | список текущего пользователя, включая auth-aware states |
| `/travelsby` | `app/(tabs)/travelsby.tsx` | `components/listTravel/ListTravelRoute.tsx` | публичный discovery/catalog surface |
| `/travels/:param` | `app/(tabs)/travels/[param].tsx` | `components/travel/details/TravelDetailsContainer.tsx` | публичная detail page по ID или slug |
| `/travel/new` | `app/(tabs)/travel/new.tsx` | `components/travel/upsert/UpsertTravelRoute.tsx` | создание travel через wizard |
| `/travel/:id` | `app/(tabs)/travel/[id].tsx` | `components/travel/upsert/UpsertTravelRoute.tsx` | загрузка и редактирование существующего travel |

Route-файлы остаются тонкими: hydration/SEO/back handling и передача управления
feature-компоненту. Data flow и business state принадлежат hooks/API слоям.

## List/search architecture

| Owner | Ответственность |
| --- | --- |
| `components/listTravel/ListTravelBase.tsx` | screen-level list orchestration, auth/list mode, responsive layout |
| `components/listTravel/ListTravelRoute.tsx` | стабильный route-facing export |
| `components/listTravel/hooks/useListTravelData.ts` | paginated list queries и mutations wiring |
| `components/listTravel/hooks/useListTravelFilters.ts` | filter/query parameters |
| `components/listTravel/hooks/useListTravelInitialFilter.ts` | route/query initial state |
| `components/listTravel/hooks/useListTravelExport.ts` | list export surface |
| `components/listTravel/RenderTravelItem.tsx`, `TravelListItem.tsx` | card rendering/actions |
| `api/travelListQueries.ts` | public list, facets, random/near-location adapters |
| `api/travelUserQueries.ts` | user-scoped travels, drafts/published status filtering |

List mode определяется route/path context. Public list по умолчанию фильтрует
publish/moderation, а user-owned запросы могут включать drafts только при
подтверждённом auth path.

## Public detail architecture

| Owner | Ответственность |
| --- | --- |
| `components/travel/details/TravelDetailsContainer.tsx` | critical/deferred shell composition, SEO, history, error/loading states |
| `hooks/travel-details/index.ts` | агрегирует data/layout/navigation/performance/menu/scroll hooks |
| `hooks/useTravelDetails.ts` | route param, id/slug query, preload/stale-data integration |
| `api/travelDetailsQueries.ts` | detail by id/slug, resolver/fallback/cache policy |
| `TravelDetailsCriticalShell.tsx`, `TravelDetailsHero.tsx` | first-screen hero/content shell |
| `TravelDetailsDeferredRuntimeSlot*`, `TravelDetailsDeferred*` | map, points, comments и другие тяжёлые sections |
| `sections/TravelDetailsMapSection.tsx`, `TravelRouteMapBlock*` | embedded map/route line composition |
| `components/MapPage/TravelMap.web.tsx`, `TravelMap.native.tsx` | platform renderers встроенной travel-карты |

Detail data может загружаться по numeric ID или slug. Web direct-load path также
учитывает preload из `app/+html.tsx`; SPA navigation не должна ждать stale preload
другого travel. Recoverable public errors могут читать stale payload, поэтому
runtime-проверка должна различать свежий backend response и stale fallback.

### Hero/media contract

- Web hero/slider media сохраняет стабильную геометрию `70vh`.
- Main image, blurred surround и slider chrome появляются как единый первый
  визуальный state после готовности runtime; interaction-gated activation не
  используется.
- Изменения slider/details/media обязаны проходить обе стороны bilateral
  contract: `npm run verify:slider` и `npm run verify:slider-perf`, с запуском
  через общий quality-gate lock по `docs/RULES.md`.

## Create/edit wizard architecture

| Owner | Ответственность |
| --- | --- |
| `components/travel/upsert/UpsertTravelRoute.tsx` | focus gate и form error boundary |
| `components/travel/UpsertTravel.tsx` | SEO wrapper и controller/view composition |
| `components/travel/upsert/useUpsertTravelController.ts` | auth/access, form data, filters, draft recovery, wizard state |
| `components/travel/upsert/UpsertTravelView.tsx` | loading/error/access states и wizard chrome |
| `components/travel/upsert/WizardStepRouter.tsx` | выбор одного из шести step components |
| `hooks/useTravelFormData.ts` | load/save/upsert, marker/media state и autosave contract |
| `hooks/useTravelWizard.ts` | step navigation, validation и publish transition |
| `hooks/useDraftRecovery.ts` | local draft persistence/recovery |

Шаги wizard:

1. `TravelWizardStepBasic.tsx`;
2. `TravelWizardStepRoute.tsx`;
3. `TravelWizardStepMedia.tsx`;
4. `TravelWizardStepDetails.tsx`;
5. `TravelWizardStepExtras.tsx`;
6. `TravelWizardStepPublish.tsx`.

Create flow синхронизирует выданный backend ID в route params после первого
успешного save. Draft recovery не заменяет server save и не является
подтверждением publish/moderation.

## Data/API ownership

Server state хранится в React Query и использует централизованные query keys.
Zustand/context остаются для client/UI state.

| Module | Endpoint family / role |
| --- | --- |
| `api/travelListQueries.ts` | `GET /api/travels/`, `/facets/`, `/random/`, `/near-location/` |
| `api/travelUserQueries.ts` | `GET /api/travels/` с user/status `where` contract |
| `api/travelDetailsQueries.ts` | `/api/travels/{id}/`, `/by-slug/{slug}/`, `/resolve-slug/{slug}/` |
| `api/misc.ts` | `PUT /api/travels/upsert/` |
| `api/travelsMutations.ts` | `DELETE /api/travels/{id}/` |
| `api/travelsFavorites.ts` | mark/unmark favorite actions |
| `api/travelRating.ts` | travel rating POST и user-rating lookup |
| `api/comments.ts` | `/api/travel-comments/` tree/CRUD/like/reply |
| `api/travelRoutes.ts` | `/api/travels/{id}/routes/` list/upload/delete/download |
| `api/instagramPublish.ts` | optional Instagram publish integration |

### Backend-dependent границы

- `publish`, `moderation` и `enforce_moderation_validation` должны проверяться
  реальным upsert response, а не только состоянием формы;
- point/media upload завершается только после server IDs и upload response;
- comments/rating/favorites требуют auth/error/empty evidence;
- route file preview/upload/download зависит от server multipart/parser contract;
- stale public cache обеспечивает degraded read, но не подтверждает свежесть API;
- optional external/Instagram/Telegram integrations не считаются готовыми без
  configuration и runtime evidence.

Frontend не должен маскировать отсутствующий backend contract permissive mock
fallback. Backend blockers оформляются как `area=back` задачи.

## Client state

| Owner | Роль |
| --- | --- |
| React Query | lists, detail, facets, ratings, route files и server mutations |
| `stores/favoritesStore.ts` | локальный favorites cache/sync |
| `stores/recommendationsStore.ts` | recommendations client cache |
| `stores/viewHistoryStore.ts` | история просмотров |
| `stores/travelSectionsStore.ts` | commands для detail sections |
| `stores/travelStatusStore.ts` | `visited/planned/wishlist` и calendar state |
| wizard hooks/component state | текущий step, draft/autosave, local form/media state |

## Route points и map contract

- Detail point cards и `/map` используют общий point/place content/action model
  там, где это возможно.
- Клик по point card или изображению фокусит и поднимает marker, но не открывает
  popup автоматически; popup открывает явный marker tap.
- Web embedded map использует React Leaflet; native embedded map — Leaflet в
  WebView. Это отдельные adapters от основной `/map`, поэтому parity проверяется
  отдельно.
- Координаты доступны для copy, internal detail/article links остаются internal,
  external navigation проходит через centralized link helpers.
- Navigation set: Google Maps, Apple Maps, Organic Maps, Waze, Яндекс Карты,
  Яндекс Навигатор, OpenStreetMap.
- Travel status виден текстом: `Был здесь`, `Хочу поехать`, `Планирую`.

Канонические UI-правила находятся в [docs/RULES.md](../RULES.md), map ownership —
в [map feature map](./map.md).

## Проверки по scope

Ближайшие test surfaces:

- list: `__tests__/components/listTravel/`,
  `__tests__/api/fetchTravels.userScoped.test.ts`;
- detail: `__tests__/components/travel/TravelDetails*`,
  `__tests__/hooks/useTravelDetails*`, `__tests__/api/travels*.test.ts`;
- wizard: `__tests__/components/travel/TravelWizard*`,
  `__tests__/components/travel/UpsertTravel*`;
- map/route points: `__tests__/components/travel/TravelDetailsMapSection.test.tsx`,
  `__tests__/components/travel/TravelRouteMapBlock.test.tsx`,
  `__tests__/components/travel/TravelMap.native.test.tsx`;
- browser: `e2e/travels.spec.ts`, `e2e/travel-detail-page.spec.ts`,
  `e2e/travel-full-flow.spec.ts`, `e2e/travel-crud.spec.ts`,
  `e2e/travel-wizard.spec.ts`, `e2e/travel-route-line.spec.ts`.

Минимальный выбор проверки:

- docs-only изменение: structural Markdown/link/path check;
- list/detail/wizard logic: ближайшие targeted Jest tests +
  `npm run check:fast`;
- visible web flow: browser screenshot + console/network review;
- route-point native behavior: локальная Android build/install и device flow;
- travel hero/slider/media: `npm run verify:slider` и
  `npm run verify:slider-perf` через общий quality-gate lock;
- medium/cross-cutting change: `npm run check:preflight` после operation-gate
  проверки.

## Технический долг

- Актуальные oversized hotspots и порядок extraction живут в
  [архитектурном аудите](../ARCHITECTURE.md#p2--архитектурный-и-типовой-долг),
  а не дублируются моментальными LOC в этом файле.
- `ListTravelBase`, recommendations, slider/publish/point-list modules требуют
  постепенного behavior-preserving split по ownership, а не переписывания всего
  travel flow.
- Embedded travel map и основная map-фича повторяют часть marker/WebView/resize
  logic; shared DTO/escaping нужно расширять без слияния platform renderers.
- Jest coverage всё ещё исключает часть map/editor/media surfaces; coverage gap
  не следует путать с отсутствием targeted tests.
- Backend-dependent publish/moderation/media/comments/rating/route-file paths
  должны закрываться adapter tests и реальным API evidence.

## Исторические документы

- [Travel details refactoring](../TRAVEL_DETAILS_REFACTORING.md) и
  [Travel performance refactor](../TRAVEL_PERFORMANCE_REFACTOR.md) содержат
  исторические решения и планы. Их даты, цифры, checklist/status и performance
  baseline нельзя считать текущими без нового замера.
- Текущий architecture/status source —
  [docs/ARCHITECTURE.md](../ARCHITECTURE.md); актуальные обязательные contracts —
  [docs/RULES.md](../RULES.md).

## Связанные документы

- [Архитектура и функциональность](../ARCHITECTURE.md)
- [Project rules](../RULES.md)
- [Testing guide](../TESTING.md)
- [Map feature map](./map.md)
- [Calendar feature map](./calendar.md)
