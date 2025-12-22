---
description: Detailed architecture and runtime behavior of the Map page (web + native)
---

# Map Page Architecture

## Purpose
Interactive travel discovery and route planning page combining:
- Map with clustered travel markers and routing overlay
- Filter panel (radius/category/address) and travel list panel
- Route builder (start/end points, transport mode, statistics)

## Entry Points
- `app/(tabs)/map.tsx` — Expo Router screen, platform-agnostic container.
- `components/MapPage/Map.web.tsx` — Web Leaflet map implementation.
- `components/MapPage/Map.native.tsx` (if present) — Native map implementation (not covered here).

## High-Level Data Flow
1) **Screen init (map.tsx)**
   - Derives `isMobile` via `useResponsive`, safe area insets via `useSafeAreaInsets`, header offset via `Platform.OS`.
   - Kicks off geolocation (`expo-location`); falls back to Minsk coords on failure.
   - Loads map filters via `fetchFiltersMap()` → normalizes categories + default radius list.
   - Initializes route state via `useRouteStoreAdapter()` (mode, transport, route points, distance, full coords, errors).

2) **Filtering & Querying**
   - UI filter state stored locally (`filterValues`), debounced via `useDebouncedValue`.
   - Normalized categories → `buildTravelQueryParams`.
   - `mapQueryDescriptor` memo bundles only primitives (lat/lng, radius, address, mode, routePointsKey, routeKey, transportMode, filtersKey) to stabilize react-query keys.
   - `useQuery(['travelsForMap', mapQueryDescriptor], enabled: focused + valid coords + (radius or route-ready))`
     - `mode === 'radius'`: `fetchTravelsForMap(lat,lng,radius,categories)` → flattens values.
     - `mode === 'route'`: uses `fullRouteCoordsRef` (ref, not dep) → `fetchTravelsNearRoute(coords, 2)`.
     - Errors logged; staleTime 2m, gcTime 10m, no refetch on focus/mount.

3) **Map Rendering (web)**
   - `Map.web.tsx` lazily loads Leaflet (script + CSS) and `react-leaflet`; guards for SSR/test.
   - Local state: `L`, `rl`, `userLocation`, `errors`, `loading`, `routingLoading`, `disableFitBounds`, `isMobileScreen`.
   - Map components (`MapContainer`, `TileLayer`, `Marker`, `Popup`, `Circle`) come from `react-leaflet` once loaded.
   - Marker icons memoized (orange travel, green start, red end, blue user) via Leaflet CDN assets.
   - Travel markers rendered through memoized `TravelMarkersMemo` with strict point comparison to avoid re-renders.
   - User interactions:
     - Map click (route mode, <2 points) delegates to parent handler; sets `disableFitBounds` to avoid auto-centering jank.
     - Popup close uses `useMap` inside `PopupWithClose`.
   - Radius display: `Circle` with `radiusInMeters` derived from selected radius (defaults to 60km).

4) **Routing**
   - `RoutingMachine` (Leaflet polyline renderer) consumes `routePoints`, `transportMode`, and `useRouting` hook results.
   - `useRouting` (not detailed here) chooses ORS (env `EXPO_PUBLIC_ROUTE_SERVICE`) or OSRM fallback; returns `{loading,error,distance,coords}`.
   - `RoutingMachine` syncs routing state to parent callbacks (`setRoutingLoading`, `setErrors`, `setRouteDistance`, `setFullRouteCoords`) with change detection to prevent loops.
   - Polylines keyed by `fitKey` (transport + points) to avoid repeated fitBounds; fits only when start/end change.

5) **Panels & Layout (map.tsx)**
   - Styles via `getStyles(isMobile, insetTop, headerOffset)` in `app/(tabs)/map.styles.ts` (web header offset 88px).
   - Right panel toggles between Filters and Travels tabs; overlay shown on mobile.
   - Layout reacts to `rightPanelVisible` and dispatches `window.resize` on web to force Leaflet invalidate size.

6) **State Synchronization**
   - Route store adapter provides stable handlers: `setRoutePoints`, `setFullRouteCoords`, `handleRemoveRoutePoint`, `handleClearRoute`, `handleAddressSelect`, plus derived data `routeDistance`, `fullRouteCoords`, `routingError`, `routingLoading`.
   - `fullRouteCoordsRef` keeps last coords outside react-query deps to avoid refetch loops.

## Key Dependencies
- `react-native` primitives for shared layout and styling.
- `react-native-safe-area-context` for insets.
- `expo-location` for geolocation (web + native).
- `@tanstack/react-query` for data fetching and caching.
- `leaflet` + `react-leaflet` (web map rendering).
- Backend API wrappers: `fetchFiltersMap`, `fetchTravelsForMap`, `fetchTravelsNearRoute` (`src/api/map`).
- Routing services: ORS via `EXPO_PUBLIC_ROUTE_SERVICE`; OSRM fallback.

## Environment Variables
- `EXPO_PUBLIC_SITE_URL` — base site URL for canonical SEO.
- `EXPO_PUBLIC_ROUTE_SERVICE` — ORS API key for routing (web).
- `EXPO_PUBLIC_GOOGLE_GA4`, `EXPO_PUBLIC_GOOGLE_API_SECRET` — GA4; warning shown if missing.

## Error Handling & Edge Cases
- Geolocation failure → default coords used; error logged.
- Map module load failure → `errors.loadingModules` triggers fallback loader message.
- Routing errors surfaced through `setErrors({ routing })` and change detection; polyline color switches to orange + dashed when not optimal.
- Query guards prevent requests without valid coords or insufficient route points.

## Performance Considerations
- Debounced filter/coord state before querying.
- Primitive-only react-query keys to prevent spurious refetch/cancel.
- Memoized markers and icons to reduce rerenders.
- Lazy loading Leaflet/react-leaflet via `requestIdleCallback`/timeout.
- `window.resize` dispatch on panel visibility change (web) to invalidate map size.

## Hypothetical Risks & Mitigations
- **Routing loop / max update depth** (stack in RoutingMachine): State setters could fire on every render if `useRouting` returns new refs or parent handlers aren’t stable.  
  - Mitigation: ensure `useRouting` memoizes results; wrap parent setters in `useCallback`; keep deps primitive; add guard to skip setter calls when values unchanged.
- **Network throttling / 429 from OSRM/ORS**: High-frequency route rebuilds or large marker fetches may hit rate limits.  
  - Mitigation: debounce route creation; introduce request budget; cache last successful route; fall back to simplified polyline on failure; add exponential backoff.
- **Leaflet load failures (CDN blocked/offline)**: External JS/CSS may not load, leaving map blank.  
  - Mitigation: ship local Leaflet assets or add retry with alternate CDN; surface user-facing error with retry CTA.
- **GA4 config missing**: Analytics events silently skipped.  
  - Mitigation: env validation on boot; log structured warning once; feature-flag analytics to avoid noisy logs.
- **Geolocation denial/unavailable**: Users may refuse geolocation; default coords may feel incorrect.  
  - Mitigation: prompt with context; allow manual location entry; persist last manual location; show “using fallback location” banner.
- **Large marker sets (performance)**: Many markers can degrade FPS on mid devices.  
  - Mitigation: add server-side pagination, clustering, or tile-based loading; memoize markers (already in place) and prefer canvas renderer on web.
- **Map resize invalidation**: Hidden/show panels may desync Leaflet size.  
  - Mitigation: keep explicit `map.invalidateSize()`/`window.resize` dispatch when panel visibility changes (already done); add throttle.
- **Routing service key leakage**: ORS key is public env; risk of scraping.  
  - Mitigation: rotate regularly, apply domain/IP restrictions where possible, add server proxy if stricter controls needed.
- **Accessibility gaps**: Map controls and popups may not be keyboard/ARIA friendly.  
  - Mitigation: add keyboard handlers for tabs, focus traps for dialogs/popups, ARIA labels for controls/markers.

## Known Issues / Warnings (as of Dec 22, 2025)
- GA4 warning when `EXPO_PUBLIC_GOOGLE_GA4` / `EXPO_PUBLIC_GOOGLE_API_SECRET` are absent.
- Potential render loop reported at `RoutingMachine` stack when state setters fire each render; verify `useRouting`/parent handlers for stability.
- OSRM 429/5xx responses visible in browser network panel; check routing backend availability/limits.

## Extension Points
- Add clustering for travel markers if result sets are large.
- Add offline/low-connectivity mode caching for last-known tiles and routes.
- Enhance accessibility: keyboard focus management for tabs and markers, ARIA labels on web.
- Add analytics events for filter changes, route creation, and travel selection once GA4 keys provided.

## Developer Plan (Implementation Priorities)
1) **Stabilize routing loop risks**  
   - Ensure `useRouting` returns memoized results; guard setter calls in `RoutingMachine` against unchanged values.  
   - Add unit tests for `RoutingMachine` change-detection and `useRouting` memoization.
2) **Rate-limit network traffic**  
   - Debounce route creation and map queries; introduce request budget/backoff for OSRM/ORS.  
   - Add integration test covering 429 retry/backoff path (mock fetch).
3) **Leaflet asset reliability**  
   - Add local Leaflet JS/CSS fallback or alt CDN with retry.  
   - E2E: simulate blocked CDN → expect user-facing retry/error message.
4) **GA4 configuration guard**  
   - Add runtime env validation + single structured warning; feature-flag analytics.  
   - Unit test: missing env triggers warning once, events skipped gracefully.
5) **Geolocation UX**  
   - Manual location entry + persist last manual location; banner when using fallback.  
   - E2E: deny geolocation → can enter address and see map update.
6) **Performance for large datasets**  
   - Add clustering/pagination/tile loading; prefer canvas renderer on web.  
   - Performance test: render 5k markers clustered vs non-clustered (FPS baseline).
7) **Accessibility**  
   - Add keyboard navigation for tabs/panels; ARIA labels for controls/markers; focus management on popups.  
   - a11y test pass with axe/lighthouse where applicable.
8) **Static assets / MIME correctness (from screenshot)**  
   - Ensure map static assets and any bundled scripts (e.g., service worker) are served with proper `Content-Type` (no `text/html` for JS).  
   - Add dev-server check or middleware to reject/flag wrong MIME; document fallback for localhost deployments.

## QA Test Plan
**Functional**
- Map loads with filters tab and travels tab; right panel toggle + overlay on mobile.
- Geolocation granted: centers on user; denied: falls back to default, banner shown, manual location works.
- Radius mode: changing radius updates circle and queries; categories filter narrows markers.
- Route mode: add start/end via map click; transport switch (car/bike/foot) rebuilds route; clear/remove points works.
- Popups open/close; “build route to” from travel list moves map to travel coords.

**Routing & Network**
- ORS key present: route builds; key missing → handled error, fallback to OSRM if configured.
- Simulate 429/timeout: backoff/retry invoked; user sees non-blocking warning; stale route preserved.
- Ensure no maximum update depth warnings in console during routing.

**Layout & Resize**
- Switching tabs/panels triggers map resize without visual glitches (desktop/mobile).
- Mobile overlay blocks map when open; closing re-enables interactions.

**Performance**
- With large dataset (mock 2k–5k markers): map remains responsive; clustering engaged if enabled.
- No excessive refetch loops (react-query requests stable when filters unchanged).

**Accessibility**
- Keyboard: tab through filters/buttons, open/close panels, focus stays visible.  
- Screen readers: labels on controls, markers, and popups; popup close is reachable.

**Analytics**
- With GA4 env set: events dispatched (smoke via mock); without env: single warning, no crashes.
- Static assets served with correct MIME types: no console “Expected a JavaScript module script but server responded with MIME type of text/html” on localhost/prod.

**Regression**
- Snapshot/unit: `getStyles` header offset logic; `RoutingMachine` change-detection; filter-to-query mapping.
- E2E happy paths: radius search, route build, toggle panels on mobile/desktop.

## Responsive Layout Plan (Dec 2025)
- **Goals**: единый UX на mobile/tablet/desktop, стабильная карта без мерцаний при смене панелей, минимальный дубликат стилей, доступность клавиатурой/ARIA.
- **Breakpoints & tokens**: MOBILE ≤768, TABLET 769–1199, DESKTOP ≥1200; header web 88px; padding (desktop 24–32, tablet 20–24, mobile 16); panelWidth (desktop 360–420, tablet 320–360, mobile overlay 100%); gap 12–16.
- **Layout**:
  - Desktop: двухколоночная сетка — карта (flex:1) + правая панель (табы Filters/Travels). Панель всегда в DOM, смена табов без ресоздания контейнера.
  - Tablet: аналогично desktop, но панель уже; minmax по ширине при узком viewport.
  - Mobile: карта во весь экран; правая панель как overlay/drawer (translate, без unmount). FAB/app-bar кнопка открывает панель, закрытие возвращает интерактивность карты; invalidateSize по закрытию.
- **Слои**: header/app bar с CTA панели, map layer под overlay, right-panel container с табами (persistent), overlays для ошибок/баннера “fallback location”.
- **State & data**: сохраняем текущие query-ключи (примитивы, дебаунс фильтров/coords); при закрытой панели на mobile не триггерим лишние refetch; состояние маршрута/гео хранится в store, overlay не сбрасывает.
- **Resize/perf**: throttle resize/invalidateSize при смене панели/rotate; ленивый Leaflet + fallback CDN/локальные ассеты; мемо маркеры/иконки; стабильные ключи полилиний (fitKey) + change-detection сеттеров; debounce ввода фильтров/адреса, cache 2m/10m.
- **A11y**: табы с aria-selected/roles и управлением стрелками; кнопка открытия панели aria-expanded/controls; focus-trap + ESC для overlay; видимый focus state; попапы маркеров с ESC/Tab.
- **Implementation steps**:
  1) Вынести брейкпоинты/отступы/высоты в shared responsive tokens (reuse METRICS/designTokens).  
  2) map.styles.ts: контейнер grid/flex с minmax панелью; gap; overlay (translate) вместо unmount; поддержка headerOffset/safe area.  
  3) Добавить FAB/app-bar action для панели на mobile; state overlay + body scroll lock.  
  4) Унифицировать FiltersPanel/TravelListPanel shell: общий каркас, контент меняется внутри.  
  5) Throttle invalidateSize на open/close/resize; ограничить refetch, когда панель скрыта на mobile.  
  6) ARIA/focus: табы, кнопка, overlay, попапы.  
  7) QA: desktop/tablet/mobile layout переключения без дерганий; perf без refetch loop; a11y проход; large markers с кластерами.

## Files Reference
- `app/(tabs)/map.tsx` — screen composition, data fetching, layout, SEO, state wiring.
- `app/(tabs)/map.styles.ts` — shared styles and header offset logic (exports getStyles + placeholder default).
- `components/MapPage/Map.web.tsx` — Leaflet-based map renderer and marker logic.
- `components/MapPage/RoutingMachine.tsx` — polyline rendering and routing state sync.
- `components/MapPage/useRouting.ts` — routing hook (ORS/OSRM selection, not detailed here).
- `components/MapPage/FiltersPanel.tsx`, `TravelListPanel.tsx` — right-panel UI for filters and travel list.
