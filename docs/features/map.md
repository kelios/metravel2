# Фича: map

**Последняя актуализация:** 2026-04-17
**Ответственный:** team

## TL;DR

Интерактивная карта путешествий с кросс-платформенной поддержкой: Leaflet на web, react-native-maps на iOS/Android. Фильтрация по локации/радиусу, кластеризация маркеров, попапы точек, построение маршрутов через OpenRouteService.

## Точки входа

| Путь | Назначение |
|------|-----------|
| `app/(tabs)/map.tsx` | Таб-навигация, основной экран |
| `components/MapPage/Map.web.tsx` | Web (Leaflet) |
| `components/MapPage/Map.ios.tsx` | iOS (react-native-maps) |
| `components/MapPage/Map.android.tsx` | Android (react-native-maps) |

## Дерево компонентов

```
<MapPage>
 └─ <TravelMap> (1015 LOC) 🔴 — корневой контейнер
     ├─ <Map.web|ios|android> — платформенная реализация
     │   ├─ <MapWebCanvas> (378) — Leaflet холст
     │   ├─ <MapLogicComponent> (546) — общая логика
     │   ├─ <MarkerClusterGroup> (470) — кластеризация
     │   ├─ <MapLayers> — WFS + основной фон
     │   ├─ <MapRoute> — отрисовка маршрута
     │   ├─ <PlacePopupCard> (1300) 🔴 — попап места
     │   └─ <LazyPopup> — асинк загрузка попапов
     ├─ <MapMobileLayout> (624) — раскладка мобайла
     ├─ <MapPanel>, <FiltersPanel> — фильтры/настройки
     ├─ <TravelListPanel> (322) — список
     ├─ <MapQuickFilters> (367) — быстрые фильтры
     ├─ <RoutingMachine> — режим построения маршрутов
     └─ <MapFAB>, <QuickActions>, <MapOnboarding>
```

🔴 — кандидаты на распил (см. ниже).

## Кросс-платформенность

| Слой | Web | Native |
|------|-----|--------|
| Движок | Leaflet 1.9 + react-leaflet | react-native-maps (Apple/Google) |
| Корень | `Map.web.tsx` (632) | `Map.ios.tsx` (281) / `Map.android.tsx` |
| Холст | `Map/MapWebCanvas.tsx` (378) | — |
| Слои | `mapWebLayers.ts` (WFS) | — |
| Panel | `MapBottomSheet.web.tsx`, `SwipeablePanel.web.tsx` | `MapMobileLayout.tsx` |
| Загрузка движка | `hooks/useLeafletLoader.ts` (dynamic import) | нативная сборка |

Выбор платформы: `components/MapPage/Map/useMapInstance.ts`, условные web-эффекты в `useMapWebLayoutEffects.ts`.

## Mobile parity contract

- Mobile web, Android and iOS map/place UX must look and behave the same for the
  same scenario. Platform-specific files may swap Leaflet, WebView or native map
  engines, but the card structure, action order, hero proportions and tap
  semantics must stay aligned.
- A marker popup/card on mobile opens fullscreen inside the available app content
  area: app header/footer remain visible, the hero image occupies about 70% of
  the card, then title/meta, coordinates with copy, article/page action,
  expandable navigation choices and existing save/add/share/route actions.
- The expandable navigation choices must show the full map-app set when
  coordinates exist: Google Maps, Apple Maps, Organic Maps/offline, Waze,
  Яндекс Карты, Яндекс Навигатор, and OpenStreetMap. Telegram/share is optional
  extra, not a substitute for those choices.
- Related travel state must be explicit in the same surface: users need to see a
  clear "Был / Хочу / Планирую" action that opens the "Был здесь",
  "Хочу поехать", and "Планирую" choices.
- `/places`, `/map`, and travel details route-point map cards should reuse the
  same point/place template with optional fields instead of separate visual
  patterns.
- On travel details, a tap on a route-point card focuses/highlights the marker on
  the map only. It must not auto-open the popup; only a direct marker tap opens
  the fullscreen point card.

## Данные

### React Query (`api/map.ts`, 541 LOC)

| Функция | Endpoint |
|---------|----------|
| `fetchTravelsForMap` | `GET /travels/search_travels_for_map/?page=X&where=...` |
| `fetchTravelsNearRoute` | `POST /travels/near-route/` |
| `fetchTravelsNear` | `GET /travels/:id/near/` |
| `fetchTravelsPopular` | `GET /travels/popular/` |
| `fetchTravelsOfMonth` | `GET /travels/of-month/` |
| `fetchFiltersMap` | `GET /filterformap/` |

Retry: `fetchWithTransientRetry` — на 502/503/504 с 350ms задержкой. Таймауты 10s (default) / 30s (long).

### Zustand

| Store | Файл | Роль |
|-------|------|------|
| `useMapPanelStore` | `stores/mapPanelStore.ts` | Открытие/закрытие панели, таб (`filters`/`list`), nonce для реактивности, toggle с throttle 300ms |

## Hooks

| Хук | Назначение |
|-----|-----------|
| `useMapScreenController` | Главный facade (координаты, фильтры, UI) |
| `useMapMarkers` | Кластеризация + видимость маркеров |
| `useMapMarkerData` | Данные → `Point[]` |
| `useMapLazyLoad` | Ленивая подгрузка при панорамировании |
| `useLeafletLoader` | Dynamic import Leaflet (web only) |
| `useMapApi` | API Leaflet/RN Maps |
| `useMapInstance` | Выбор платформы |
| `useMapCleanup` | Сброс listeners, AbortController |
| `useMapLogic` | Фильтрация, фокус, зум |
| `useMapUserLocation` | Геолокация |
| `useMapPopupAutoPan` | Авто-панирование на попап |
| `useRouting` | Построение маршрутов через ORS |

## Утилиты

- `utils/mapClustering.ts` — алгоритм кластеризации по зуму
- `utils/mapWebLayers.ts` — WFS слои (LASY), Tile, Attribution
- `utils/mapToasts.ts` — уведомления ошибок
- `utils/coordinateConverter.ts`, `coordinateValidator.ts`
- `utils/mapImageGenerator.ts` — превью путешествий
- `utils/routingApiKey.ts` — резолв ORS ключа

**Routing (ORS + OSRM fallback):** поддержка car/foot/bike, mock режим через `EXPO_PUBLIC_OSRM_MOCK`.

## Env

```
EXPO_PUBLIC_ORS_API_KEY           ORS ключ
EXPO_PUBLIC_ROUTE_SERVICE_KEY     альтернативный ключ
EXPO_PUBLIC_ROUTE_SERVICE         URL сервиса
EXPO_PUBLIC_LASY_WFS_URL          WFS URL (Беларусь)
EXPO_PUBLIC_LASY_ATTRIBUTION      attribution WFS
EXPO_PUBLIC_LASY_WFS_TYPENAME     имя типа
EXPO_PUBLIC_LASY_WFS_VERSION      версия (2.0.0)
EXPO_PUBLIC_LASY_WFS_OUTPUT       формат (GEOJSON)
EXPO_PUBLIC_LASY_WFS_SRS          SRS (EPSG:4326)
EXPO_PUBLIC_DEBUG_ROUTING         debug routing
EXPO_PUBLIC_FORCE_OSRM            принудить OSRM
EXPO_PUBLIC_OSRM_MOCK             mock OSRM (тесты)
```

## Тесты

### Unit (22 файла в `__tests__/components/MapPage/`)

- `Map.web.test.tsx`, `OptimizedMap.web.test.tsx`
- `MapMarkers.test.tsx`, `ClusterLayer.test.tsx`
- `MapLogicComponent.test.tsx`, `MapLogicComponent.zoom-radius.test.tsx`
- `TravelMap.web.test.tsx`, `PlacePopupCard.test.tsx`
- `FiltersPanel.test.tsx`, `FiltersPanel.controls.test.tsx`
- `MapQuickFilters.test.tsx`, `TravelListPanel.test.tsx`
- `SwipeablePanel.web.test.tsx`, `AddressListItem.native.test.tsx`, `.web.test.tsx`
- `useMapPopupAutoPan.test.ts`, `useMapApi.test.ts`
- `map-mobile-layout.test.tsx`

Интеграционные: `__tests__/integration/map-route.integration.test.ts`, `__tests__/config/mapWebLayers.test.ts`, `__tests__/routes/map-screen.test.tsx`, `__tests__/utils/mapFiltersStorage.test.ts`.

### E2E

- `e2e/map-page.spec.ts` — основной сценарий
- `e2e/points-map-popup.spec.ts` — попапы
- `e2e/map-route-visual.spec.ts` — маршруты (визуал)
- `e2e/map-popup-close.spec.ts`
- `e2e/map-travel-card-no-image.spec.ts`

### Coverage исключения (`jest.config.js`)

- `components/Map`
- `components/MapPage/`
- `components/MapUploadComponent`

После распила критичных файлов эти исключения нужно пересмотреть.

## Большие файлы (>800 LOC)

| Файл | LOC | Приоритет |
|------|-----|-----------|
| `components/MapPage/Map/PlacePopupCard.tsx` | 1300 | 🔴 1 |
| `components/MapPage/TravelMap.tsx` | 1015 | 🔴 2 |

## Известные боли

- **PlacePopupCard.tsx (1300)** — план распила в открытом спринте (header/gallery/metadata/actions).
- **TravelMap.tsx (1015)** — много логики в одном файле, кандидат на вынесение хуков-контроллеров.
- **Coverage** — целые папки исключены, нужны unit-тесты после распила.
- **WFS слои** медленно грузятся на мобайле — возможна оптимизация чанкированием.
- **Sync Web↔Native state** — аккуратная работа с refs при переключении платформ.

## Mobile UX audit — first-time discovery flow

**Дата аудита:** 2026-05-12

Цель аудита: посмотреть на мобильную карту как на первый вход пользователя, который ещё не знает продукт и хочет быстро понять, куда можно поехать.

### Проверенные сценарии

- Первый вход на `/map` в mobile web.
- Collapsed-state карты до открытия панели.
- Открытие bottom sheet и переход между табами `search` / `route` / `list`.
- Поиск мест по радиусу и категориям.
- Список найденных мест и empty state.
- Построение маршрута после выбора стартовой и конечной точки.

### Что уже работает хорошо

- Базовый mobile flow не сломан: список, поиск по радиусу и route-builder доступны и покрыты e2e.
- У списка есть понятный summary-блок `Места рядом` и быстрый переход к фильтрам.
- В collapsed-state появился явный стартовый CTA `Найти места рядом`, который даёт понятную первую точку входа.
- В mobile sheet и panel header список переименован из `Точки` в `Места`.
- Контекст результатов стал явнее: mobile summary теперь может показывать радиус и близость к пользователю (`в радиусе 60 км`, `рядом с вами`).
- Empty state не тупиковый: пользователь может увеличить радиус, сбросить фильтры или вернуться к карте.
- Route mode хорошо объясняет следующий шаг, когда точек маршрута ещё недостаточно.

### Главные UX-проблемы

#### 1. Первый экран слишком инструментальный, а не сценарный

- На mobile web onboarding фактически выключен, хотя именно здесь он полезнее всего для первого визита.
- Collapsed overlay показывает в первую очередь compact controls, но не даёт явного ответа на вопрос `с чего начать`.

Следствие: новый пользователь видит карту и набор контролов, но не получает понятный первый шаг вроде `Найти места рядом`.

#### 2. Язык интерфейса местами говорит языком карты, а не языком выбора поездки

- `Радиус`, `Оверлеи`, `Точки` — понятные термины для опытного пользователя, но слабые entry points для discovery.
- Для первого визита важнее формулировки уровня `Подобрать`, `Места`, `Недалеко`, `На выходные`, `Природа`, `Замки`.

#### 3. Tabs в mobile sheet равноправны, хотя пользовательские намерения не равноправны

- Для первого визита основной путь — `подобрать место`, затем `посмотреть список`, и только потом `строить маршрут`.
- Сейчас `route` выглядит слишком рано и конкурирует за внимание с discovery-сценарием.

#### 4. Collapsed state перегружен icon-first логикой

- Compact overlay экономит место, но требует догадки: что открывает список, что меняет фильтры, а что просто центрирует карту.
- Для нового пользователя нужно хотя бы одно явное primary действие текстом, а не только набор иконок и коротких чипов.

#### 5. Контекст результатов выражен недостаточно явно

- В списке есть `Места рядом`, но не всегда очевидно, рядом с чем именно: с геолокацией, центром карты или в текущем радиусе.
- Пользователю полезнее видеть контекст вида `3 места в радиусе 60 км` или `3 места рядом с вами`.

#### 6. Карточка места на мобильном делает слишком много сразу

- Для первого выбора пользователю важнее быстро понять `что это`, `насколько далеко`, `подходит ли мне`.
- Secondary actions полезны, но в discovery-сценарии они должны быть менее заметны, чем основной CTA.

### Приоритетный план улучшений

#### P1 — обязательные улучшения

1. [x] Вернуть для mobile web лёгкий first-visit onboarding или coachmark.
2. [x] Добавить в collapsed state явный стартовый CTA: `Найти места рядом`.
3. [x] Переименовать tab `Точки` в более человеко-понятное `Места`.
4. [x] Явно показывать контекст результатов: радиус / геолокация / центр карты.

Статус: P1 закрыт — mobile web снова показывает лёгкий first-visit coachmark, а collapsed state и список уже поддерживают discovery-first вход.

#### P2 — сильные UX-улучшения без смены архитектуры

1. В search-tab добавить блок `С чего начать` с intent-based chips.
2. Сделать discovery-path визуально приоритетнее route-path на первом визите.
3. Упростить верхнюю часть mobile travel-card под быстрый выбор направления.

#### P3 — polishing

1. Добавить микро-подсказку `Нажмите на маркер, чтобы посмотреть место`.
2. Усилить quick recommendations как отдельный discovery-блок.
3. Для first-visit режима временно показывать text+icon controls вместо максимально compact icon-only панели.

### Рекомендуемый целевой first-time flow

1. Пользователь открывает `/map`.
2. Видит понятный стартовый CTA `Найти места рядом`.
3. Получает небольшую подборку ближайших мест.
4. Быстро уточняет подборку через категории/намерения.
5. Открывает карточку места.
6. Только после этого переходит к построению маршрута.

### Вывод

Текущая мобильная карта уже хорошо работает как инструмент карты, фильтров и маршрутов. Основной следующий шаг для UX — сделать её более понятной именно как интерфейс выбора направления для нового пользователя, а не только как набор картографических контролов.

## Связанные документы

- `docs/features/travel.md` — деталь travel использует map-секцию
- `docs/OPTIMIZATION_AND_FIX_PLAN.md`
