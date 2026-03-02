# Оставшийся рефакторинг: C2, C3, C4, E6, I2

> **Дата:** 2026-03-02  
> **Статус:** В работе  
> **Зависимость:** REFACTORING_PLAN.md (51/55 задач завершено)  

---

## Обзор

5 оставшихся задач — все high-risk, platform-specific. Разбиты на 17 подзадач.
Каждая подзадача — отдельный PR с обратной совместимостью через barrel re-exports.

**Обязательно перед каждым PR:** `yarn lint && yarn test:run`

---

## C2 (XL) — Extract shared layers from Map.web.tsx × 2

**Цель:** `components/map/Map.web.tsx` (969 LOC) и `components/MapPage/Map.web.tsx` (1302 LOC) → тонкие адаптеры < 300 LOC каждый.

### C2.1 — Migrate types + normalization to map-core (M, 🟢 Низкий)

**Файлы:**
- `components/map/Map.web.tsx` (строки 27–87): inline `Point` type + `normalizePoint()`
- `components/MapPage/Map.web.tsx` (строки ~285): `strToLatLng`
- `components/map-core/types.ts`: уже есть `LegacyMapPoint` + `legacyPointToMarker`

**Что делать:**
1. Удалить inline `Point` type из `map/Map.web.tsx`, заменить на `LegacyMapPoint` из `map-core`
2. Заменить `normalizePoint()` на `legacyPointToMarker()` из `map-core`
3. Обновить `strToLatLng` в `MapPage/Map.web.tsx` на `legacyPointToMarker`
4. Добавить re-export `Point` из `map-core` для обратной совместимости

**Deliverable:** 0 дублированных типов Point, обе карты импортируют из `map-core`

---

### C2.2 — Extract MapPopup.tsx into map-core (L, 🟡 Средний)

**Файлы:**
- `map/Map.web.tsx` (строки 643–814): `PopupWithClose`
- `components/MapPage/Map/createMapPopupComponent.tsx`: фабрика попапа
- `map/Map.web.tsx` (строки 822–887): CSS стили попапа

**Что делать:**
1. Создать `components/map-core/MapPopup.tsx` (~200 LOC) — единый popup-компонент
2. Общая логика: `PlacePopupCard`, кнопки (Google Maps, Organic Maps, Telegram, Add Point, Copy Coord), auth-gating
3. Различия (через props): `siteCategoryDictionaryRef` vs `userLocation`
4. Создать `components/map-core/mapPopupStyles.ts` (~70 LOC) — CSS стили
5. Обновить оба `Map.web.tsx` на использование `MapPopup`

**Deliverable:** `MapPopup.tsx` + `mapPopupStyles.ts`, оба Map.web.tsx используют один popup

---

### C2.3 — Extract shared Leaflet boilerplate (M, 🟢 Низкий)

**Файлы:**
- `map/Map.web.tsx` (строки 203–221, 337–389): cleanup `_leaflet_id`, invalidateSize
- `MapPage/Map.web.tsx` (строки 157–167, 376–768): cleanup, ResizeObserver, bfcache

**Что делать:**
1. Создать `components/map-core/useMapLifecycle.ts` (~120 LOC)
2. Включить: container cleanup, invalidateSize scheduling, ResizeObserver, bfcache handling
3. Заменить boilerplate в обоих `Map.web.tsx` на `useMapLifecycle()`

**Deliverable:** `useMapLifecycle.ts`, удаление ~200 LOC boilerplate из каждого Map.web.tsx

---

### C2.4 — Extract MapMarkerLayer.tsx (L, 🟡 Средний)

**Файлы:**
- `map/Map.web.tsx` (строки 511–557): `MarkerWithPopup` + `FitBoundsOnData`
- `MapPage/Map.web.tsx` (строки 1218–1272): `MapMarkers` + `ClusterLayer`

**Что делать:**
1. Создать `components/map-core/MapMarkerLayer.tsx` (~250 LOC)
2. Принимает `MapMarker[]`, рендерит кластеры vs маркеры, popup через `MapPopup`
3. `map/Map.web.tsx` → `<MapMarkerLayer markers={markers} popupConfig={...} />`
4. `MapPage/Map.web.tsx` → аналогично, с cluster config

**Deliverable:** `MapMarkerLayer.tsx`, оба Map.web.tsx < 300 LOC

---

### C2.5 — Final cleanup + barrel (S, 🟢 Низкий)

1. Обновить `map-core/index.ts` — exports новых модулей
2. Проверить оба Map.web.tsx ≤ 300 LOC
3. Обновить `docs/MODULE_OWNERS.md`, `docs/ADR_MAP_ARCHITECTURE.md`

---

## C3 (L) — Consolidate marker components

**Цель:** `MarkersListComponent.tsx` (832 LOC) → < 200 LOC + shared modules.

### C3.1 — Extract styles (S, 🟢 Низкий)

**Файл:** `components/map/MarkersListComponent.tsx` (строки 27–412: 385 LOC стилей)

**Что делать:**
1. Создать `components/map/markersListStyles.ts` (~390 LOC)
2. `MarkersListComponent.tsx` падает до ~440 LOC

---

### C3.2 — Extract EditMarkerModal (M, 🟢 Низкий)

**Файл:** `MarkersListComponent.tsx` (строки 636–829: ~190 LOC модалка)

**Что делать:**
1. Создать `components/map/EditMarkerModal.tsx` (~200 LOC)
2. Включает: `PhotoUploadWithPreview`, `MultiSelectField`, portal-рендеринг
3. `MarkersListComponent.tsx` ≤ 250 LOC

---

### C3.3 — Create useMapMarkerData hook (M, 🟡 Средний)

**Что делать:**
1. Создать `hooks/useMapMarkerData.ts` (~100 LOC)
2. Общая логика: category label resolution, image normalization, search filtering
3. Используется в `MarkersListComponent` и MapPage marker components

**Deliverable:** Один маркерный модуль < 200 LOC

---

## C4 (M) — Unify routing logic

**Цель:** `RoutingMachine.tsx` (356) + `useRouting.ts` (612) → `map-core/useMapRouting.ts`

### C4.1 — Extract elevation logic (S, 🟢 Низкий)

**Файл:** `RoutingMachine.tsx` (строки 6–42, 255–340)

**Что делать:**
1. Создать `components/map-core/useElevation.ts` (~150 LOC)
2. Включает: `sampleIndices`, `computeElevationGainLoss`, Open-Meteo fetch, elevation cache, rate limiting
3. Standalone hook, может использоваться независимо

---

### C4.2 — Merge into useMapRouting.ts (L, 🟡 Средний)

**Файлы:** `useRouting.ts` (612 LOC) + оставшаяся логика RoutingMachine

**Что делать:**
1. Создать `components/map-core/useMapRouting.ts` (~500 LOC)
2. Принимает: `routePoints`, `transportMode`, `apiKey`
3. Возвращает: `RouteState` (из map-core/types.ts) + elevation stats
4. Callback sync: один `onRouteChange` callback вместо 10+ отдельных setters
5. Включает: ORS/OSRM/Valhalla chain + elevation hook + toast side-effects

---

### C4.3 — Update MapPage to use useMapRouting (M, 🟡 Средний)

1. Заменить `<RoutingMachine>` рендер (строки 1170–1216 MapPage/Map.web.tsx) на `useMapRouting()`
2. Маршрутная линия рендерится через `Polyline`
3. Удалить `RoutingMachine.tsx` и `useRouting.ts`
4. Обновить barrel: `map-core/index.ts`

---

## E6 (L) — Unify Slider.web.tsx + UnifiedSlider.tsx

**Цель:** 888 + 790 LOC → < 250 LOC каждый entry point, shared hooks.

### E6.1 — Migrate Slider.web.tsx to useSliderLogic (M, 🟡 Средний)

**Файлы:**
- `Slider.web.tsx` (строки 213–316): manual state (containerW, currentIndex, refs)
- `sliderParts/useSliderLogic.ts`: уже используется в `UnifiedSlider`

**Что делать:**
1. Перевести `Slider.web.tsx` на `useSliderLogic` — убрать дублированный state (~100 LOC)
2. Добавить `virtualWindow` как опциональный параметр в `useSliderLogic`
3. `Slider.web.tsx` → ~600 LOC

---

### E6.2 — Extract shared web scroll/drag logic (L, 🟡 Средний)

**Файлы:**
- `Slider.web.tsx` (строки 410–436, 548–758): ResizeObserver, mouse drag, keyboard nav
- `UnifiedSlider.tsx` (строки 204–452): аналогичная логика

**Что делать:**
1. Создать `sliderParts/useWebScrollInteraction.ts` (~200 LOC)
2. Включает: mouse drag, pointer/touch swipe, keyboard nav, scrollend snap, ResizeObserver sync
3. Оба слайдера минус ~250 LOC каждый

---

### E6.3 — Final merge with platform adapters (L, 🔴 Высокий)

**Стратегия:** Вариант B — два platform entry points (Metro `.web.tsx` extensions).

1. `Slider.web.tsx` < 250 LOC — web adapter (`ScrollView` + CSS scroll-snap + виртуализация)
2. `UnifiedSlider.tsx` < 250 LOC — native adapter (`Animated.FlatList` + `useAnimatedScrollHandler`)
3. Shared: `useSliderLogic` + `useWebScrollInteraction`
4. Не тянет `react-native-reanimated` в web bundle

---

## I2 (L) — Tree-shake React Native Web

**Цель:** Уменьшить unused JS на ~150-200KB в web bundle.

### I2.1 — Audit RNW module usage (S, 🟢 Низкий)

1. `grep` по `import { ... } from 'react-native'` — список фактически используемых модулей
2. Сравнить с полным экспортом RNW 0.21
3. Создать `docs/RNW_USAGE_AUDIT.md`

---

### I2.2 — Configure manual RNW aliasing in metro.config.js (M, 🔴 Высокий)

1. В `metro.config.js` `resolveRequest` добавить aliasing: `react-native` → cherry-picked modules
2. Создать `metro-stubs/react-native-web-slim.js` — re-exports только используемых модулей
3. Альтернатива: `babel-plugin-module-resolver` для direct imports

---

### I2.3 — Validate bundle + runtime (M, 🟡 Средний)

1. `npm run build:web:prod` → Lighthouse unused JS metric
2. Playwright E2E smoke: home, search, map, travel detail
3. Сравнить с `BASELINE_METRICS.json`

---

### I2.4 — Document approach in ADR (S, 🟢 Низкий)

1. Создать `docs/ADR_RNW_TREE_SHAKE.md`

---

## Зависимости

```
C2.1 ──→ C2.2 ──→ C2.4 ──→ C2.5
  │        │
  │        └──→ C2.3 (параллельно C2.2)
  │
  └──→ C4.1 ──→ C4.2 ──→ C4.3

C3.1 ──→ C3.2 ──→ C3.3 (параллельно C2)

E6.1 ──→ E6.2 ──→ E6.3 (полностью независима)

I2.1 ──→ I2.2 ──→ I2.3 ──→ I2.4 (полностью независима)
```

## Рекомендуемый порядок

| Шаг | Подзадачи | Почему |
|-----|-----------|--------|
| 1 | C2.1, C3.1 | Фундамент: типы + стили (низкий риск) |
| 2 | C2.2, C2.3, C3.2 | Извлечение модулей (параллельно) |
| 3 | C4.1, E6.1 | Независимые extraction'ы |
| 4 | C2.4, C3.3 | Маркерный слой (зависит от popup) |
| 5 | C4.2, C4.3, E6.2 | Routing merge + slider scroll |
| 6 | C2.5, E6.3 | Final cleanup + merge |
| 7 | I2.1 → I2.4 | RNW tree-shake (последним, высший риск) |

## Риски

| Подзадача | Риск | Причина |
|-----------|------|---------|
| C2.1, C2.3, C2.5, C3.1, C3.2, C4.1, I2.1, I2.4 | 🟢 Низкий | Механическое извлечение |
| C2.2, C2.4, C3.3, C4.2, C4.3, E6.1, E6.2, I2.3 | 🟡 Средний | Архитектурные различия между реализациями |
| E6.3, I2.2 | 🔴 Высокий | Platform-specific merge; Metro resolver hacking |

