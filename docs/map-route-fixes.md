---
description: internal checklist for Map → Route fixes per Dec 22 requirements
---

## Status
- Implementation: FiltersPanel переписан (единый маршрутный блок, CTA “Пересчитать”, панель “Маршрут построен”, no-points в панели, подсказки без дубликатов). RouteHint текст обновлён. Map.web.tsx: структура восстановлена, добавлен no-points toast testID, dev-мок OSRM в useRouting.
- Issues: карта в вебе сейчас не показывает тайлы (серый фон; проверить загрузку Leaflet/TileLayer и координаты). Tests: `npm test -- --runInBand` всё ещё падает (FiltersPanel тесты на CTA/подсказки/доступность табов и др.).

## P1 (must)
- Fix “no points” message:
  - Always keep route visible; show status “Маршрут построен”.
  - Copy: “Маршрут построен. Вдоль маршрута нет доступных точек в радиусе 2 км”.
  - CTA: “Увеличить радиус”, “Показать маршрут без точек”.
  - Do not overlay the map; prefer panel/toast.
- Route built confirmation:
  - Panel shows fixed “Маршрут построен” with distance, time, transport.
  - Button states: “Построить маршрут” → after built “Пересчитать маршрут”; disabled until start+finish.
- JS errors/stability:
  - Remove RouteHint error (no undefined imports/refs).
  - Prevent infinite re-render (RoutingMachine/Map.web effects).
  - Handle cancelled fetch gracefully (map queries on route).
- Popup/cluster behavior:
  - Cluster click zooms without double markers or stuck popups.
  - Popup closes reliably.

## P2
- [x] Text/microcopy updates:
  - [x] “Точки не найдены” → “Нет точек вдоль маршрута”.
  - [x] “Очистить точки” → “Сбросить маршрут”.
  - [x] “Перестроить” → “Пересчитать маршрут”.
  - [x] “Старт выбран на карте” / “Финиш выбран на карте” (hide raw coordinates).
- [ ] UI priority:
  - [ ] Hide “Очистить маршрут” until start or finish exists; swap only when both exist.
  - [x] Hide route CTA in radius mode; show only in route mode.
  - [ ] Markers: start green, finish red, route points blue, others muted.
- [ ] System messages:
  - [x] Messages in panel/toast; don’t cover map.

## Tasks to implement
1) FiltersPanel.tsx
   - [x] Clean duplicates/imports, ensure JSX valid.
   - [x] Stepper labels per spec; hide coords (show “Выбрано на карте”).
   - [x] Route status block “Маршрут построен” with distance/time/transport.
   - [x] Button: route-only, disabled until start+finish, label swap to “Пересчитать маршрут”.
   - [x] No-points message/CTA in panel, not overlay.
   - [ ] Hide “Сбросить маршрут/Swap” unless points exist/both exist.
2) Map.web.tsx
   - [ ] Keep route line always visible even if no POIs.
   - [ ] Cluster click: zoom without duplicate markers/stuck popup; stop propagation.
   - [ ] Popup close reliability (ensure markers close popup, no infinite rerender).
   - [ ] If travels near route empty: emit panel toast/state, not overlay.
   - Marker colors: start green, end red, route points blue; mute POIs.
3) Data/fetch stability
   - Handle cancelled fetch: differentiate cancel vs error; avoid UI “error” on cancel.
   - Avoid infinite loops in RoutingMachine effects.

## Testing to run
- npm run lint -- --max-warnings=0
- npm test (or npx jest) for FiltersPanel tests after changes

## Open questions
- Distance/time source for “Маршрут построен” (routing response?); fallback to distance only if time missing.
---
