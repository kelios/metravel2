# ADR: State Management Boundaries

> **Status:** Accepted  
> **Date:** 2026-03-02  
> **Deciders:** Architecture review  
> **Context:** Refactoring Plan, Фаза 4 (F1–F2)

---

## Context

The project uses multiple state management approaches:
- **Zustand stores** (`stores/`) for persistent domain data
- **React Context** (`context/`) for auth, favorites, theme, map filters
- **React Query** (`@tanstack/react-query`) for server state caching
- **Local component state** (`useState`) for UI-transient data

Boundaries between these layers are not always clear, leading to:
- Data fetching logic duplicated between contexts and stores
- Unclear ownership of loading/error states
- `FavoritesContext` doing both DI and data orchestration

---

## Decision

### State ownership matrix

| Domain | Owner | Location | Rationale |
|--------|-------|----------|-----------|
| Auth (token, userId, avatar) | `AuthContext` | `context/AuthContext.tsx` | Needs React tree injection for `useAuth()` |
| Favorites list | `favoritesStore` (Zustand) | `stores/favoritesStore.ts` | Persistent, shared across screens |
| History list | `historyStore` (Zustand) | `stores/historyStore.ts` | Persistent, shared across screens |
| Recommendations | `recommendationsStore` (Zustand) | `stores/recommendationsStore.ts` | Cached domain data |
| Route builder | `routeStore` (Zustand) | `stores/routeStore.ts` | Complex state machine (waypoints, distance, elevation) |
| Map filters | `MapFiltersContext` | `context/MapFiltersContext.tsx` | Scoped to map screens, UI-transient |
| Bottom sheet | `bottomSheetStore` (Zustand) | `stores/bottomSheetStore.ts` | Cross-component UI coordination |
| Theme | `ThemeContext` | `context/ThemeContext.tsx` | Needs React tree injection |
| Travel list (server) | React Query | `hooks/useListTravelData.ts` | Server cache with staleTime |
| User profile (server) | React Query | `hooks/useUserProfileCached.ts` | Server cache with staleTime |
| Travel detail (server) | React Query | `hooks/useTravelDetails*.ts` | Server cache per slug/id |
| Form state (UI) | `useState` / `useOptimizedFormState` | Component-local | Ephemeral, no persistence needed |
| Scroll/layout (UI) | `useState` / `useRef` | Component-local | Frame-level, no persistence |

### Rules

1. **Zustand stores** own **persistent domain data** and **actions** (CRUD, sync, optimistic updates)
2. **React Context** is for **dependency injection** only (auth provider, theme provider) — no business logic
3. **React Query** owns **server-state caching** — no manual cache in stores for server data
4. **Local state** for **UI-transient** values (form inputs, scroll position, animation state)
5. **No duplication** — each piece of data has exactly one owner

### Migration: FavoritesContext (F1)

`FavoritesContext` currently orchestrates loading, which should move to `favoritesStore` actions:
- `FavoritesContext.loadFavorites()` → `favoritesStore.getState().load()`
- `FavoritesContext` becomes a thin DI wrapper or is removed entirely
- Components call `useFavoritesStore()` directly

---

## Consequences

### Positive
- Clear ownership — no ambiguity about where state lives
- Easier debugging — one place to look for each data domain
- Better performance — Zustand selectors prevent unnecessary re-renders
- Testable — stores can be tested in isolation

### Negative
- Migration effort for FavoritesContext consumers
- Need to ensure React Query and Zustand don't cache the same data

---

## References

- `docs/REFACTORING_PLAN.md` — Phase 4 (F1–F2)
- `stores/` — Zustand store implementations
- `context/` — React Context providers

