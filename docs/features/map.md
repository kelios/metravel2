# Фича: map

**Последняя актуализация:** 2026-07-14

**Ответственный домен:** frontend map/places

**Канонический обзор проекта:** [Архитектура и функциональность Metravel](../ARCHITECTURE.md)

## Назначение документа

Этот файл описывает текущие frontend-границы map-фичи: маршруты, движки,
platform adapters, data flow и минимальную проверку. Он не является
production-readiness отчётом. Реальная доступность результатов, кластеров,
маршрутизации и внешних слоёв зависит от backend/external services и должна
подтверждаться runtime evidence для конкретной задачи.

## TL;DR

- Web-карта использует Leaflet и React Leaflet.
- Основная карта на Android и iOS использует Leaflet внутри
  `react-native-webview`; `react-native-maps` в текущем map path не используется.
- Общий screen/controller слой выбирает platform adapter через `MapPanel`.
- Встроенная карта деталей travel имеет отдельные реализации
  `TravelMap.web.tsx` и `TravelMap.native.tsx`; это не тот же renderer, что
  основная `/map`.
- Общими должны оставаться DTO точек, координатная валидация, popup/card model,
  navigation actions и UX-контракт. Web React Leaflet и native WebView renderers
  не нужно сливать в один cross-platform god-component.

## Статус по поверхностям

| Поверхность | Реализация в репозитории | Что требует отдельной проверки |
| --- | --- | --- |
| `/map` на web | React Leaflet, filters, radius/route modes, panels, overlays | browser flow, console/network, backend payloads |
| `/map` на Android/iOS | Leaflet HTML/JS в WebView, RN bridge, offline tile cache | локальная device build, permissions, WebView messages, tiles/offline |
| Embedded travel map | React Leaflet на web, Leaflet-in-WebView на native | travel detail interaction и route-point parity |
| `/places` | отдельный places catalog поверх нормализованных map points | см. `docs/features/places.md`; backend-dependent |
| Quest maps | отдельные quest adapters | не принадлежат основной map renderer; проверяются quest-сценарием |

Наличие компонента или unit-теста не подтверждает доступность backend endpoint,
API key, WFS/Overpass/OWM provider либо корректную работу на реальном устройстве.

## Маршруты и точки входа

| Route / surface | Файл | Ответственность |
| --- | --- | --- |
| `/map` web | `app/(tabs)/map.web.tsx` | hydration gate, SEO, Leaflet CSS, lazy screen shell |
| `/map` native | `app/(tabs)/map.tsx` | тонкий route к `screens/tabs/MapScreen.tsx` |
| Map screen | `screens/tabs/MapScreen.tsx` | композиция map canvas, desktop/mobile chrome и screen states |
| `/places` | `app/(tabs)/places.tsx` | каталог точек; отдельный owner, общий point/place contract |
| `/travels/:param` map section | `components/travel/details/sections/TravelDetailsMapSection.tsx` | встроенная карта и route points на detail page |
| `/quests/map` | `app/(tabs)/quests/map.tsx` | quest map route, не основной `/map` renderer |

## Ownership и слои

| Слой | Основные файлы | Что ему принадлежит |
| --- | --- | --- |
| Route | `app/(tabs)/map.tsx`, `app/(tabs)/map.web.tsx` | entry point, SEO/hydration shell |
| Screen composition | `screens/tabs/MapScreen.tsx`, `screens/tabs/map.styles.ts`, `screens/tabs/mapScreenHelpers.ts` | desktop/mobile composition, screen-level state wiring |
| Facade | `hooks/useMapScreenController.ts` | объединение coordinates, filters, data, route и panel controllers |
| Focused controllers | `hooks/map/` | `useMapCoordinates`, `useMapFilters`, `useMapDataController`, `useMapTravels`, `useMapClusters`, `useRouteController` |
| Engine boundary | `components/MapPage/MapPanel.tsx` | выбор web/native renderer и общий prop contract |
| Web renderer | `components/MapPage/Map.web.tsx`, `components/MapPage/Map/*` | React Leaflet canvas, markers, clusters, layers, popups, route line |
| Native renderer | `components/MapPage/Map.ios.tsx`, `components/MapPage/Map.android.tsx` | Leaflet WebView, RN↔WebView bridge, native tiles/offline, native map UI API |
| Shared map chrome | `components/MapPage/MapCanvas.tsx`, `MapScreenParts/`, `MapMobile/`, `MapBottomSheet*`, `MapMobileLayout.tsx` | loading, panels, mobile sheet, floating controls |
| Place surface | `components/MapPage/Map/createMapPopupComponent.tsx`, `Map/PlacePopupCard/`, `MapPlaceBottomCard.tsx` | единый content/action model для popup и mobile bottom card |
| Embedded travel renderer | `components/MapPage/TravelMap.web.tsx`, `components/MapPage/TravelMap.native.tsx` | карта внутри travel details, отдельный platform adapter |

`components/MapPage/Map.android.tsx` переэкспортирует `Map.ios.tsx`: обе native
платформы используют один WebView renderer. `components/MapPage/Map.tsx` остаётся
generic web fallback; platform resolution выбирает `.web`, `.ios` или `.android`
файлы для соответствующей сборки.

## Platform engines

| Concern | Web | Android/iOS |
| --- | --- | --- |
| Движок | Leaflet + React Leaflet | Leaflet внутри `react-native-webview` |
| Runtime loading | `useLeafletLoader`, web CSS/runtime loaders | inline Leaflet assets из `utils/leafletInlineAsset.ts` |
| Markers/clusters | React components/layers | сериализованный payload, injected JS, server cluster data |
| Overlays | `config/mapWebLayers.ts`, `utils/mapWebOverlays/*` | сериализуемое подмножество layers; weather labels остаются web-only |
| View commands | Leaflet refs/API | `injectJavaScript` через `MapUiApi` |
| Map events | React Leaflet handlers | `WebView.onMessage` |
| Offline tiles | web tile/network path | `utils/mapTileCache.ts`, `MapOfflineDownloadControl.tsx` |

### Native bridge ownership

`components/MapPage/Map.ios.tsx` владеет протоколом основной native-карты:

- RN → WebView: render points/clusters, user location, zoom, center, overlays,
  resize invalidation и tile responses;
- WebView → RN: `READY`, `SELECT_PLACE`, `MAP_CLICK`, `MAP_MOVED`,
  `MAP_VIEWPORT`, `TILE_REQ`;
- dynamic payload передаётся через безопасную JSON-сериализацию и
  `injectJavaScript`, а не через пересборку HTML на каждое изменение данных.

`TravelMap.native.tsx` имеет более узкий отдельный bridge для embedded travel
map (`POINT_SELECT`, `CLEAR_SELECTED_POINT`, `OPEN_URL`, `RESIZE`). Изменение
одного bridge не означает автоматический parity второго.

При развитии bridge нужно выносить typed DTO, message validation, coordinate
normalization и escaping в общие модули, сохраняя renderers раздельными.

## Данные и backend contracts

Backend-facing map adapter — `api/map.ts`; React Query ownership находится в
`hooks/map/*` и использует ключи из `api/queryKeys.ts`.

| Функция | Endpoint family | Примечание |
| --- | --- | --- |
| `fetchTravelsForMap` | `GET /api/travels/search_travels_for_map/` | paginated radius/filter/search data |
| `fetchMapClusters` | `GET /api/map/clusters/` | bbox/zoom, optional query/category/radius; backend-dependent |
| `fetchTravelsNearRoute` | `POST /api/travels/near-route/` | GeoJSON route + tolerance |
| `fetchFiltersMap` | `GET /api/filterformap/` | map filter dictionaries |
| `fetchTravelsNear` | `GET /api/travels/{id}/near/` | `404` нормализуется в empty result |
| popular/month/random | `/api/travels/popular/`, `/of-month/`, `/random/` | discovery data used around map surfaces |

Карта также зависит от:

- `config/mapWebLayers.ts` и `utils/mapWebOverlays/*` для OSM/Overpass,
  WFS и weather overlays;
- `api/external/serverRouting.ts` (`POST /api/routing/route/`) как
  канонического routing path;
- client-side ORS/OSRM/Valhalla adapters как compatibility/failure fallback;
- geolocation permissions и platform network state;
- env key names из runtime config. Значения ключей в документацию и логи не
  копируются.

Некоторые API adapters возвращают empty payload при recoverable/expected error.
Поэтому пустая карта должна диагностироваться по network/API evidence, а не
объявляться успешным backend contract только потому, что UI не упал.

## Client state

| Owner | Роль |
| --- | --- |
| React Query | map travels, server clusters, filters и cache invalidation |
| `stores/mapPanelStore.ts` | active panel/tab и screen commands |
| `stores/routeStore.ts` | route points, geometry и route state |
| `hooks/useMapScreenController.ts` | screen-level derived state и stable callbacks |
| component state | selected place, WebView readiness, local popup/layout state |

## Point/place mobile contract

- Mobile web, Android и iOS сохраняют одинаковый порядок данных и действий.
- Маркер открывает point/place surface; travel detail point-card tap только
  фокусит/подсвечивает marker, но не открывает popup автоматически.
- Карточка использует общий `PlacePopupCard` content model через
  `createMapPopupComponent`; mobile wrapper — `MapPlaceBottomCard`.
- Координаты доступны для копирования; internal article/travel routes остаются
  внутренней навигацией, external map apps открываются через централизованные
  external-link helpers.
- Navigation choices при наличии координат: Google Maps, Apple Maps,
  Organic Maps, Waze, Яндекс Карты, Яндекс Навигатор и OpenStreetMap.
- Travel status должен быть понятен текстом (`Был здесь`, `Хочу поехать`,
  `Планирую`), а не только безымянной иконкой.

Канонические UI-правила находятся в [docs/RULES.md](../RULES.md).

## Проверки по scope

Ближайшие test surfaces:

- `__tests__/components/MapPage/` — renderers, panels, popup/card, markers,
  clusters и bridge-adjacent helpers;
- `__tests__/hooks/useMap*` и `__tests__/hooks/useMapScreenController*` —
  data/filter/route controller behavior;
- `__tests__/api/fetchMapClusters.test.ts` и
  `__tests__/api/fetchTravelsForMap.whereEncoding.test.ts` — backend adapter;
- `__tests__/integration/map-route.integration.test.ts` — routing integration;
- `e2e/map-page.spec.ts`, `e2e/map-mobile-panel-content.spec.ts`,
  `e2e/map-mobile-route-toolbar.spec.ts`, `e2e/points-map-popup.spec.ts`,
  `e2e/map-route-visual.spec.ts` — browser flows.

Минимальный выбор проверки:

- docs-only изменение: structural Markdown/link/path check;
- map logic/API change: ближайшие targeted Jest tests + `npm run check:fast`;
- видимый web map change: targeted checks + browser screenshot,
  console/network review;
- native renderer/bridge/offline change: targeted Jest + локальная Android
  build/install на USB device; iOS-ready только с simulator/device evidence;
- широкий cross-platform map change: `npm run check:preflight` после проверки
  operation gate.

Все Jest/Playwright/full gates запускаются с учётом общего quality-gate lock из
`docs/TESTING.md`.

## Технический долг

- `Map.ios.tsx`, `Map.web.tsx` и `useMapScreenController.ts` остаются крупными
  orchestration/bridge hotspots; актуальный список см. в
  [архитектурном аудите](../ARCHITECTURE.md#p2--архитектурный-и-типовой-долг).
- Main map, embedded travel map и quest maps частично дублируют HTML/JS bridge,
  marker, resize, popup и escaping logic.
- Необходимо расширять typed bridge DTO и coverage до снятия широких map
  exclusions из `jest.config.js`.
- Backend cluster/search/route contracts и external overlay providers требуют
  runtime verification; dev/test fallback не является production evidence.

## Исторический UX-аудит

Аудит first-time mobile discovery от **2026-05-12** — исторический snapshot, а
не текущий readiness baseline. Его выводы использовались для onboarding,
discovery CTA, terminology и result-context work. Статусы старых чекбоксов и
формулировки «уже работает» не следует переносить в новые задачи без повторного
browser/device прогона.

Сохраняющийся продуктовый ориентир:

1. первый экран объясняет сценарий выбора места, а не только инструменты карты;
2. discovery/search path визуально предшествует route-building для нового
   пользователя;
3. результат явно показывает anchor и radius;
4. marker/card flow остаётся понятным без icon-only догадок.

## Связанные документы

- [Архитектура и функциональность](../ARCHITECTURE.md)
- [Project rules](../RULES.md)
- [Testing guide](../TESTING.md)
- [Places feature map](./places.md)
- [Travel feature map](./travel.md)
- [Optimization and fix plan](../OPTIMIZATION_AND_FIX_PLAN.md) — плановый
  документ; его даты и статусы проверяются отдельно перед использованием.
