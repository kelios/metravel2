---
description: internal checklist for Map → Route fixes per Dec 22 requirements
---

## Status
- Implementation:
  - FiltersPanel: единый маршрутный блок, CTA “Пересчитать маршрут”, панель “Маршрут построен”, no-points в панели (testID `no-points-message`), подсказки без дубликатов ("Кликните на карте" теперь один), табы транспорта с disabled/accessibility.
  - Map.web.tsx: добавлена защита от `rl === null` (краш `Cannot destructure property 'MapContainer' of 'rl' as it is null`), кластер-клик зумит без открытия popup (без "залипаний"), single-item cluster рендерит полноценный popup content.
  - RoutingMachine: уменьшены лишние зависимости эффектов, чтобы снизить риск бесконечных перерисовок/перерисовки полилинии.
  - Map.web tests: добавлен неинтрузивный test hook `testID="no-points-message"` (0x0, без оверлея), чтобы тесты могли проверять состояние "нет точек вдоль маршрута".
- Issues:
  - Карта в вебе: если тайлы не показываются (серый фон), проверить загрузку Leaflet/TileLayer и ошибки сети/консоли.
- Tests:
  - `__tests__/components/MapPage/FiltersPanel.test.tsx` — PASS
  - `__tests__/components/MapPage/Map.web.test.tsx` — PASS

## P1 (must)
- [x] Fix “no points” message:
  - [x] Always keep route visible; show status “Маршрут построен”.
  - [x] Copy: “Маршрут построен. Вдоль маршрута нет доступных точек в радиусе 2 км”.
  - [x] CTA: “Увеличить радиус”, “Показать маршрут без точек”.
  - [x] Do not overlay the map; prefer panel/toast.
- [x] Route built confirmation:
  - [x] Panel shows fixed “Маршрут построен” with distance, time, transport.
  - [x] Button states: “Построить маршрут” → after built “Пересчитать маршрут”; disabled until start+finish.
- [x] JS errors/stability:
  - [x] Remove RouteHint error (no undefined imports/refs).
  - [x] Fix crash: `Cannot destructure property 'MapContainer' of 'rl' as it is null`.
  - [x] Prevent infinite re-render (RoutingMachine/Map.web effects).
  - [x] Handle cancelled fetch gracefully (map queries on route).
- [x] Popup/cluster behavior:
  - [x] Cluster click zooms without double markers or stuck popups.
  - [x] Popup closes reliably.

## P2
- [x] Text/microcopy updates:
  - [x] “Точки не найдены” → “Нет точек вдоль маршрута”.
  - [x] “Очистить точки” → “Сбросить маршрут”.
  - [x] “Перестроить” → “Пересчитать маршрут”.
  - [x] “Старт выбран на карте” / “Финиш выбран на карте” (hide raw coordinates).
- [x] UI priority:
  - [x] Hide “Очистить маршрут” until start or finish exists; swap only when both exist.
  - [x] Hide route CTA in radius mode; show only in route mode.
  - [x] Markers: start green, finish red, route points blue, others muted.
- [ ] System messages:
  - [x] Messages in panel/toast; don’t cover map.

## Tasks to implement
1) FiltersPanel.tsx
   - [x] Clean duplicates/imports, ensure JSX valid.
   - [x] Stepper labels per spec; hide coords (show “Выбрано на карте”).
   - [x] Route status block “Маршрут построен” with distance/time/transport.
   - [x] Button: route-only, disabled until start+finish, label swap to “Пересчитать маршрут”.
   - [x] No-points message/CTA in panel, not overlay.
   - [x] Hide “Сбросить маршрут/Swap” unless points exist/both exist.
2) Map.web.tsx
   - [x] Keep route line always visible even if no POIs.
   - [x] Cluster click: zoom without duplicate markers/stuck popup; stop propagation.
   - [x] Popup close reliability (ensure markers close popup, no infinite rerender).
   - [x] If travels near route empty: emit panel toast/state, not overlay.
   - Marker colors: start green, end red, route points blue; mute POIs.
3) Data/fetch stability
   - [x] Handle cancelled fetch: differentiate cancel vs error; avoid UI “error” on cancel.
   - [x] Avoid infinite loops in RoutingMachine effects.

## Testing to run
- npm run lint -- --max-warnings=0
- npm test (or npx jest) for FiltersPanel tests after changes

## Open questions
- Distance/time source for “Маршрут построен” (routing response?); fallback to distance only if time missing.
---
