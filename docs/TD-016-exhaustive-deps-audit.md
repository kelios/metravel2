# TD-016 — Audit: `react-hooks/exhaustive-deps` disables

Date: 2026-06-03. Owner: `test-author` + domain review. Scope: каждый `eslint-disable react-hooks/exhaustive-deps` в `components/`, `hooks/`, `app/`, `screens/`, `context/`, `stores/` проверен на риск устаревшего замыкания (stale closure).

Method: для каждой площадки сверён список значений, читаемых внутри callback, с массивом зависимостей. Stale-closure риск возникает, только если callback читает **мутабельное реактивное** значение, которого нет в deps (и оно не ref/не закодировано через key-string). Refs всегда «живые», поэтому их законное отсутствие в deps — не риск.

Итог: **19 вхождений, 0 реальных багов**. Все обоснованы. 3 помечены `maintenance-fragile` (enumerated sub-key deps — корректны сейчас, но требуют синхронизации при добавлении полей). Кода не меняли.

## Классификация

| # | Площадка | Вид хука | Категория | Вердикт |
| --- | --- | --- | --- | --- |
| 1 | `components/MapPage/TravelListPanel.tsx:369` | `useMemo` webWindow | version-bump trigger + live ref | **SAFE** — `itemHeightsRef.current` намеренно «живой»; `heightsVersion` форсит пересчёт против реальных offset'ов (есть комментарий) |
| 2 | `components/MapPage/RoutingMachine.tsx:208` | `useEffect` | key-co-change | **SAFE (low)** — читает `routingState.coords` без него в deps, но coords всегда приходят вместе с `distance`/`duration` (в deps) → эффект ре-ранится |
| 3 | `components/MapPage/Map.web.tsx:254` | `useMemo` фильтрация маркеров | derived-from-deps | **SAFE** — `center = filterCenter ?? coordinatesLatLng`, `guardRadius` из `radiusInMeters`, `hasValidCenter` из `center` — всё производно от перечисленных deps (`filterCenter?.lat/lng`, `coordinatesLatLng`, `radiusInMeters`) |
| 4 | `components/ui/Typography.tsx:78` | `useMemo` style | complete | **SAFE** — все читаемые значения (`config`, `bp.*`, `color`, `colors.text`, `align`, `isMobile`) перечислены |
| 5 | `components/calendar/MiniCalendar.tsx:87` | `useMemo` todayStr `[]` | mount-once | **SAFE** — снимок «сегодня» на маунт; дата сессии не меняется в рамках жизни компонента |
| 6 | `components/map-core/useElevation.ts:172` | `useEffect` `[enabled, transportMode, coordsKey]` | key-string substitution | **SAFE** — координаты закодированы в `coordsKey` (сериализованный ключ массива) |
| 7 | `components/map-core/useMapLifecycle.ts:125` | `useEffect` cleanup `[]` | mount-once lifecycle | **SAFE** — читает только refs (`containerElRef`, `rootEl`, `containerId`); они «живые» |
| 8 | `components/map-core/useMapLifecycle.ts:141` | `useEffect` ResizeObserver `[]` | mount-once lifecycle | **SAFE** — `rootRef`/`mapRef` refs, observer ставится один раз |
| 9 | `components/map-core/useMapRouting.ts:138` | `useEffect` toasts/callback | callback-excluded | **SAFE (low)** — `onRouteChange?.()` исключён намеренно (внешний колбэк); `result.*`+`coordsKey` перечислены |
| 10 | `screens/tabs/MapScreen.tsx:343` | `useMemo` quickFilters | enumerated sub-keys | **SAFE (fragile)** — `buildQuickFiltersData(filtersPanelProps,…)` читает срезы `filtersCtx`, перечисленные в deps; при добавлении нового читаемого среза deps надо обновить (есть комментарий) |
| 11 | `hooks/useMapScreenController.ts:60` | `useMemo` initialCategories `[]` | intentional initial snapshot | **SAFE** — «initial» захват URL-params на маунт (имя говорит само) |
| 12 | `hooks/useMapScreenController.ts:63` | `useMemo` initialRadius `[]` | intentional initial snapshot | **SAFE** — то же |
| 13 | `hooks/useMapScreenController.ts:70` | `useMemo` urlCoordinates `[]` | intentional initial snapshot | **SAFE** — то же |
| 14 | `context/AuthContext.tsx:34` | `useEffect` `[authReady]` | one-shot init | **SAFE** — гард `if (authReady) return`, `checkAuthentication` стабилен; запуск ровно один раз |
| 15 | `context/MapFiltersContext.tsx:125` | `useMemo` context value | enumerated sub-keys | **SAFE (fragile)** — мемоизация объекта контекста по ~16 перечисленным полям; при добавлении нового поля в `contextValue` его надо добавить в deps, иначе потребители получат stale |
| 16 | `components/listTravel/ListTravelBase.tsx:520` | `useMemo` activeConditionChips | granular sub-keys (TD-022) | **SAFE** — уже закрыто TD-022 с обоснованием |
| 17 | `components/listTravel/ListTravelBase.tsx:618` | `useMemo` getEmptyStateMessage | granular sub-keys (TD-022) | **SAFE** — TD-022 |
| 18 | `components/listTravel/ListTravelBase.tsx:716` | `useMemo` topContent | granular sub-keys (TD-022) | **SAFE** — TD-022 |
| 19 | `hooks/useMapScreenController.ts` (setUserLocation `[]`, поз. ~60 кластера) | `useCallback` `[]` | stable setter | **SAFE** — обёртка стабильного сеттера |

## Maintenance-fragile (не баг, но требуют дисциплины)

- `context/MapFiltersContext.tsx:125` — при добавлении поля в `FiltersProviderProps`/`contextValue` обязательно дописать его в массив зависимостей мемо.
- `screens/tabs/MapScreen.tsx:343` — при расширении того, что читает `buildQuickFiltersData`, синхронизировать deps.

Обе уже несут поясняющий комментарий рядом с disable; рекомендация — оставить как есть, ничего не править.

## Вывод

Изменений в коде не требуется. Все 19 disable — намеренные и безопасные паттерны (live refs, mount-once snapshot, key-string substitution, derived-from-deps, granular/enumerated deps ради стабильной identity и отсечения лишних пересчётов). Реальных stale-closure дефектов не найдено.
