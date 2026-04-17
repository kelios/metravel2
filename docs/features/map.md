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

## Связанные документы

- `docs/features/travel.md` — деталь travel использует map-секцию
- `docs/OPTIMIZATION_AND_FIX_PLAN.md`
