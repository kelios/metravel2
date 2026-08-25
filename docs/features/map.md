# Фича: map

**Последняя актуализация:** 2026-08-13

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
- Основная Android-карта использует Leaflet внутри `react-native-webview`;
  `react-native-maps` в текущем map path не используется. `Map.ios.tsx` остаётся
  отдельным iOS renderer; он проверяется только в iOS-specific map scope.
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
| `/map` на Android | Leaflet HTML/JS в WebView, RN bridge, offline tile cache | при Android-specific изменении: локальная USB device build, permissions, WebView messages, tiles/offline |
| iPhone | `Map.ios.tsx` содержит WebView renderer | active release scope; simulator + physical iPhone map QA |
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
| Overlays | `config/mapWebLayers.ts`, `utils/mapWebOverlays/*` | тот же сериализуемый набор layers; числовые weather labels поддерживаются и в Leaflet WebView через `nativeMapHtml.ts` |
| View commands | Leaflet refs/API | `injectJavaScript` через `MapUiApi` |
| Map events | React Leaflet handlers | `WebView.onMessage` |
| Offline map data | point-index package only; no tile bulk download | transparent seven-day cache of tiles actually viewed; lawful PMTiles option is documented in ADR 0004 but remains `wont_do` until the owner approves its license and budget |

### Web cold-start viewport and tiles

На основной web-карте готовность Leaflet и готовность базовой OSM-подложки —
разные события. `useMapController` передаёт `initialResultsSettled` через
`MapPanel` только web-renderer. Пока первый map data request остаётся в состоянии
`loading`, query выключен из-за потери focus либо новый anchor ещё проходит
debounce/placeholder fetch, `MapLogicComponent` не применяет radius auto-fit, а
`useMapInstance` не создаёт tile/overlay layers. После settled result set карта
синхронно применяет один стартовый fit и только затем разрешает подключение
слоёв. Retryable first-frame pane error получает один следующий animation frame
до разрешения fallback, поэтому он не открывает transient placeholder tiles.
Для settled empty result явный fallback — fit валидного radius circle; если fit
намеренно недоступен, сохраняется безопасный исходный viewport.

Гейт монотонный для смонтированного `MapContainer`: последующие background
refetch, pagination, pan/zoom и переключение `radius`/`route` не снимают и не
пересоздают базовый слой. Это не debounce и не затрагивает Android WebView
renderer, который сохраняет собственный tile lifecycle.

Статический HTML bootstrap заранее загружает Leaflet/MarkerCluster CSS и может
сделать только connection-level preconnect к внешнему proxy в local/dev. Он не
подставляет guessed OSM URL в preload или SSG shell image: до settled data fit
неизвестны финальные zoom и tile coordinates, поэтому любой такой запрос мог бы
стать отдельным лишним уровнем до runtime base-layer attach.

### Native bridge ownership

`components/MapPage/Map.ios.tsx` владеет протоколом основной native-карты:

- RN → WebView: render points/clusters, user location, zoom, center, overlays,
  resize invalidation и tile responses;
- WebView → RN: `READY`, `SELECT_PLACE`, `MAP_CLICK`, `MAP_MOVED`,
  `MAP_VIEWPORT`, `TILE_REQ`;
- dynamic payload передаётся через безопасную JSON-сериализацию и
  `injectJavaScript`, а не через пересборку HTML на каждое изменение данных.

### Native base tile lifecycle

`components/MapPage/Map/nativeTileBridgeScript.ts` владеет мостом базовой
подложки для iOS и Android (Android — реэкспорт `Map.ios`). Прямой
`L.tileLayer` не используется: каждый реально запрошенный тайл идёт через
прозрачный дисковый кэш в RN. Bulk/prefetch регионов запрещён политикой
tile.openstreetmap.org.

Инварианты моста:

- **ключ pending уникален на DOM-тайл.** Leaflet отдаёт в `createTile`
  ОБЁРНУТЫЕ координаты (`_wrapCoords`), поэтому на низком зуме несколько разных
  DOM-тайлов приходят с одинаковыми `z/x/y`. Ключ вида `z/x/y` их склеивал:
  вторая запись затирала первую, первый `<img>` навсегда оставался без `src` и
  без `done()`, то есть под `.leaflet-tile { visibility: hidden }`. `z/x/y`
  едут в сообщении отдельными полями — RN качает тайл по ним, а не по ключу;
- **нижняя граница зума считается от вьюпорта** (`resolveBaseMinZoom`,
  глобалка `__metravelBaseMinZoom`). Ниже неё один мир Leaflet уже/ниже экрана
  и тайлов на остальную площадь просто не существует: подложка вырождается в
  серое поле независимо от сети. На iPhone 13 mini граница — z2;
- **граница едет за размером вьюпорта.** Стартовый замер берётся из
  `window.innerWidth/innerHeight` до layout, а WebView отдаёт финальный размер
  позже (RN-layout вкладки, поворот — тот же F-17-сценарий, ради которого живёт
  каскад `__metravelScheduleInvalidate` → `invalidateSize`). Поэтому мост
  подписан на `resize` и пересчитывает границу от `map.getSize()` через
  `map.setMinZoom`; если текущий зум оказался ниже новой границы, Leaflet сам
  подтягивает карту наверх. Формула берётся из одной глобалки
  `__metravelResolveBaseMinZoom`, её паритет с TS-версией закреплён тестом;
- **пустой ответ = ошибка тайла, а не успешная загрузка.** `done(null, img)` на
  пустом `dataUrl` вешал `leaflet-tile-loaded` на пустую картинку, и провал
  сети выглядел как здоровая карта. Теперь летит `tileerror` и растёт счётчик
  `failed`;
- **ретраи живут в RN** (`Map/tileFetchRetry.ts`): Leaflet тайл не
  перезапрашивает, поэтому единственный 429/503 из nginx-зоны при бурсте зума
  (#807) иначе консервировал бы серую клетку. Окно — две попытки поверх первой
  (400 мс, 1200 мс), уход в офлайн ретраи прекращает;
- **снятый с карты тайл чистит свою pending-запись** (`_removeTile`), иначе
  гонка зума копила записи до конца сессии.

Счётчики для разбора серой подложки на устройстве (IOS-07) читаются из WebView
через `window.__metravelGetTileStats()` → `{ requested, loaded, failed,
dropped, pending }`; сам слой лежит в `window.__metravelBaseTileLayer`, потому
что события `tileerror`/`load` живут на слое и на карту не всплывают.

Регрессия: `__tests__/components/MapPage/Map/nativeTileBridge.lifecycle.test.ts`
гоняет реальный Leaflet 1.9.4 через zoom-цикл до нижней границы на размерах
iPhone 13 mini и падает, если хоть один DOM-тайл остался без ответа. Уникальность
ключа наблюдаема только на кадре, где вьюпорт ШИРЕ мира (fallback-граница на
ландшафтном 1366 px): на телефоне граница z2 держит мир не уже экрана,
обёрнутые координаты там не повторяются вовсе и ключ `z/x/y` дефекта не
показывает — отдельный кейс держит именно этот кадр.

Позиция пользователя на Android следует атомарному визуальному контракту:

- явный trusted target одной WebView-командой сначала создаёт accuracy-круг и
  общий 30px GPS-маркер, а затем центрирует карту по той же координате;
- user-location pane находится выше POI/cluster `markerPane`, но ниже tooltip и
  popup, поэтому «Вы здесь» не скрывается маркерами и не перекрывает подсказки;
- сам GPS-маркер не перехватывает события, поэтому совпадающие POI/кластеры
  остаются доступными для нажатия, как на mobile web; у всего visual-only pane
  отключён DOM hit-testing, чтобы viewport-sized accuracy canvas не перекрывал
  нижний `markerPane`;
- ошибка отрисовки очищает визуальный слой и center target: состояние «камера
  центрируется, но точки нет» не допускается.

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

### Лицензии и атрибуция внешних картографических провайдеров

- Все стандартные OSM-подложки, включая PNG/PDF-снимки карты, загружаются
  только через MeTravel OSM proxy и показывают `© OpenStreetMap contributors`
  со ссылкой на страницу copyright. Прямые OSM tile-hosts и CARTO basemaps
  запрещены guard-скриптом.
- CARTO не используется, пока коммерческая лицензия не подтверждена отдельно.
- Каждый активный OpenWeather-слой, включая числовые температурные подписи,
  добавляет в Leaflet обязательные текст `Weather data provided by OpenWeather`,
  ссылку на OpenWeather и официальный логотип. Это provider-owned wording и
  поэтому намеренно не локализуется.
- Отсутствие API key скрывает OpenWeather-слои; наличие ключа не доказывает
  тариф или договор и проверяется отдельно перед релизом.

Некоторые API adapters возвращают empty payload при recoverable/expected error.
Поэтому пустая карта должна диагностироваться по network/API evidence, а не
объявляться успешным backend contract только потому, что UI не упал.

### Один физический объект с несколькими источниками

Физическое место и запись точки внутри статьи — разные сущности. Если несколько
статей описывают один объект, карта показывает один marker/hit target на
канонической координате места и сохраняет все связанные материалы внутри одной
карточки.

Целевой additive DTO:

```ts
type MapPlaceMarker = {
  placeId: string | number;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  sourceCount: number;
  primarySource: MapPlaceSource;
};

type MapPlaceSource = {
  sourceId: `travel-address:${number}`;
  pointId: number;
  travelId: number | null;
  articleTitle: string;
  articleUrl: string | null;
  thumbnailUrl: string | null;
  thumbnailWidth: number | null;
  thumbnailHeight: number | null;
};
```

- Группировка опирается только на стабильный `placeId`, назначенный данным. Ни
  расстояние, ни совпадение названия/адреса не являются достаточным identity:
  соседние здания, корпуса, входы и смотровые площадки нельзя склеивать
  эвристикой. Legacy-точка без `placeId` остаётся отдельным marker.
- Нормализация выполняется один раз за обновление dataset через `Map` за `O(n)`;
  popup не запускает новый поиск и не пересобирает marker-слой при перелистывании.
  Marker payload несёт только `sourceCount` и `primarySource`. При
  `sourceCount > 1` остальные короткие summary загружаются по
  `GET /api/map/places/{placeId}/sources/` только после открытия карточки и
  кэшируются по `placeId`; галереи и rich text в этот ответ не входят.
- Карточка показывает счётчик `1/N` и локально перелистывает источники. Фото,
  заголовок материала и ссылка на статью относятся к активному source;
  название/адрес, координаты, навигация, сохранение и travel-status относятся к
  каноническому месту и не меняются при перелистывании.
- Одновременно монтируется только активное фото через общий media-компонент;
  допустим prefetch только следующего thumbnail. Полный массив sources не
  сериализуется в native WebView marker payload. Desktop popup, mobile-web
  bottom card, Android и iPhone используют один source-pager model, а не четыре
  platform-specific карусели.
- Один источник остаётся прежним одиночным popup без pager. Для нескольких
  источников доступны swipe и явные previous/next controls с локализованными
  accessibility labels для RU/BE/UK/PL/EN.

## Client state

| Owner | Роль |
| --- | --- |
| React Query | map travels, server clusters, filters и cache invalidation |
| `stores/mapPanelStore.ts` | active panel/tab и screen commands |
| `stores/routeStore.ts` | route points, geometry и route state |
| `hooks/useMapScreenController.ts` | screen-level derived state и stable callbacks |
| component state | selected place, WebView readiness, local popup/layout state |

## Point/place mobile contract

- Mobile web, Android и iPhone сохраняют одинаковый порядок данных и действий
  как design-инвариант. Общие responsive-изменения проверяются на
  desktop/mobile web; native map evidence требуется только на платформе с
  затронутым platform-specific поведением.
- Маркер открывает point/place surface; travel detail point-card tap только
  фокусит/подсвечивает marker, но не открывает popup автоматически.
- Карточка использует общий `PlacePopupCard` content model через
  `createMapPopupComponent`; mobile wrapper — `MapPlaceBottomCard`.
- Bottom-card layout (mobile web sheet ≤560, native bottom card, tablet card):
  hero-фото занимает всё место над фиксированным низом, а place info (категория/
  расстояние-чипы, название, адрес, координаты с copy и share-иконка) рисуется
  подписью на фото поверх статического градиента; под фото фиксированно стоят
  строка ♥ + «Был / Хочу / Планирую» и ряд из 4 icon-действий. Вся карточка
  видна без скролла; навигация раскрывается отдельным `ActionListSheet`.
  ⤢ expand при этом переезжает в верхний правый угол фото.
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
  `e2e/map-popup-close.spec.ts` — deterministic browser flows. Route behavior is
  asserted from DOM/API state; artifact-only screenshots without a baseline are
  not treated as regression tests.

Минимальный выбор проверки:

- docs-only изменение: structural Markdown/link/path check;
- map logic/API change: ближайшие targeted Jest tests + `npm run check:fast`;
- видимый map UI change: targeted checks + desktop/mobile browser screenshots,
  console/network review + тот же flow на локальной Android USB-сборке;
- native renderer/bridge/offline change: targeted Jest + локальная Android
  build/install на USB device + тот же mobile-web flow;
- широкий cross-platform map change: `npm run check:preflight` после проверки
  operation gate.

Все Jest/Playwright/full gates запускаются с учётом общего quality-gate lock из
`docs/TESTING.md`.

## Технический долг

- `Map.ios.tsx`, `Map.web.tsx` и `useMapScreenController.ts` остаются крупными
  orchestration/bridge hotspots; extraction выполняется небольшими
  behavior-preserving шагами по текущему complexity guard и board task.
- Main map, embedded travel map и quest maps частично дублируют HTML/JS bridge,
  marker, resize, popup и escaping logic.
- Необходимо расширять typed bridge DTO и coverage до снятия широких map
  exclusions из `jest.config.js`.
- Backend cluster/search/route contracts и external overlay providers требуют
  runtime verification; dev/test fallback не является production evidence.

## Product orientation

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
