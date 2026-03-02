# Module Ownership Matrix

> **Date:** 2026-03-02  
> **Purpose:** Defines ownership and responsibility for each major module in the codebase.

---

## Core Modules

| Module | Path | Responsibility | Key Exports | Owner Pattern |
|--------|------|---------------|-------------|---------------|
| API Client | `api/client.ts` | HTTP transport, auth headers, token refresh, `ApiError` | `apiClient`, `ApiError` | Singleton |
| Travels API | `api/travelsApi.ts` (barrel) | Travel CRUD operations | `fetchTravels`, `fetchTravel`, `fetchTravelBySlug`, `deleteTravel`, `normalizeTravelItem` | Barrel re-export |
| Travels Normalize | `api/travelsNormalize.ts` | Travel DTO normalization | `normalizeTravelItem`, `MyTravelsPayload` | Pure functions |
| Travels Queries | `api/travelsQueries.ts` | Travel GET operations + slug fallback | `fetchTravels`, `fetchRandomTravels`, `fetchTravel`, `fetchTravelBySlug`, `fetchMyTravels`, `fetchTravelFacets` | Async functions |
| Travels Mutations | `api/travelsMutations.ts` | Travel write operations | `deleteTravel` | Async functions |
| Articles API | `api/articles.ts` | Article CRUD | `fetchArticles`, `fetchArticle`, `createArticle` | Async functions |
| Messages API | `api/messages.ts` | User messaging | `sendMessage`, `fetchMessages` | Async functions |
| User Points API | `api/userPoints.ts` | Points CRUD, import/export | `userPointsApi` | Namespace object |
| Auth API | `api/auth.ts` | Login, register, token refresh | `login`, `register`, `refreshToken` | Async functions |
| Map API | `api/map.ts` | Map data (coords, clusters) | `fetchTravelCoords`, `fetchMapClusters` | Async functions |
| Misc API | `api/misc.ts` | Filters, countries, upload, form save | `fetchFilters`, `uploadImage`, `saveFormData` | Async functions |
| Misc Optimized | `api/miscOptimized.ts` | Cached wrapper over misc.ts | `fetchAllFiltersOptimized` | Caching decorator |
| API Parsers | `api/parsers/apiResponseParser.ts` | Shared parsing utilities | `parsePaginatedResponse`, `coerceNumber`, `getErrorStatus`, `isAbortError` | Pure functions |
| File Parsers | `api/parsers/googleMapsParser.ts`, `osmParser.ts` | Import file parsing (KML, GeoJSON, GPX) | `GoogleMapsParser`, `OSMParser` | Static classes |

## Map Stack

| Module | Path | Responsibility | Status |
|--------|------|---------------|--------|
| Map Core Types | `components/map-core/types.ts` | Unified map contract | **New** (C1) |
| Travel Detail Map | `components/map/Map.web.tsx` | Leaflet map for travel detail | Legacy, pending C2 migration |
| Full Map Page | `components/MapPage/Map.web.tsx` | Full map with routing/filters | Legacy, pending C2 migration |
| Travel Map | `components/MapPage/TravelMap.tsx` | Reusable travel map component | Active |
| Markers | `components/map/MarkersListComponent.tsx` | Marker rendering | Legacy, pending C3 |
| Routing | `components/MapPage/RoutingMachine.tsx` | Route calculation | Legacy, pending C4 |

## State Management

| Module | Path | Owner Of | Pattern |
|--------|------|----------|---------|
| Auth Context | `context/AuthContext.tsx` | Auth state (token, userId, avatar) | React Context (DI) |
| Theme Context | `context/ThemeContext.tsx` | Theme (light/dark) | React Context (DI) |
| Map Filters Context | `context/MapFiltersContext.tsx` | Map filter UI state | React Context (scoped) |
| Favorites Store | `stores/favoritesStore.ts` | Favorites list | Zustand |
| History Store | `stores/historyStore.ts` | View history | Zustand |
| Route Store | `stores/routeStore.ts` | Route waypoints, distance, elevation | Zustand |
| Bottom Sheet Store | `stores/bottomSheetStore.ts` | Bottom sheet UI coordination | Zustand |
| React Query | via `queryClient.ts` | Server state cache | TanStack Query |

## Hooks

| Module | Path | Responsibility |
|--------|------|---------------|
| `useAuth` | `context/AuthContext.tsx` | Auth state access |
| `useScrollNavigation` | `hooks/useScrollNavigation.ts` | Scroll-to-section navigation |
| `useActiveSection` | `hooks/useActiveSection.ts` | Intersection Observer section tracking |
| `useTravelFilters` | `hooks/useTravelFilters.ts` | Travel filter normalization |
| `useLeafletLoader` | `hooks/useLeafletLoader.ts` | Lazy Leaflet/ReactLeaflet loading |
| `useMapMarkers` | `hooks/useMapMarkers.ts` | Map marker data preparation |
| `useResponsive` | `hooks/useResponsive.ts` | Responsive breakpoints |
| `useDebounce` | `hooks/useDebounce.ts` | Debounce callbacks |
| `useDebouncedValue` | `hooks/useDebouncedValue.ts` | Debounce values |
| `useFormState` | `hooks/useFormState.ts` | Form state + validation (thin wrapper) |
| `useOptimizedFormState` | `hooks/useOptimizedFormState.ts` | Optimized form state management |

## CI / Quality

| Module | Path | Responsibility |
|--------|------|---------------|
| ESLint Config | `eslint.config.js` | Linting rules incl. no-explicit-any, ban-ts-comment |
| File Complexity Guard | `scripts/guard-file-complexity.js` | Warns on files > 800 LOC |
| Jest Config | `jest.config.js` | Test configuration |
| Playwright Config | `playwright.config.ts` | E2E test configuration |

---

## Rules

1. Each module has **one clear responsibility** — no god-modules
2. API modules **never import from hooks or components** — dependency flows downward
3. Hooks **never import from components** — only from api/, stores/, utils/, context/
4. Components import from hooks/, api/ (via hooks), stores/ (via hooks), utils/
5. `docs/` files are **source of truth** — code follows documentation

