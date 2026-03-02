# ADR: Map Architecture

> **Status:** Accepted  
> **Date:** 2026-03-02  
> **Deciders:** Architecture review  
> **Context:** Refactoring Plan, Фаза 2 (C1–C4)

---

## Context

The project has **two parallel map stacks** that evolved independently:

1. **`components/map/`** (8 files, ~2,400 LOC) — Travel detail map  
   - `Map.web.tsx` (970 LOC): Leaflet-based, inline `Point` type, own marker normalization
   - `MarkersListComponent.tsx` (832 LOC): Marker rendering for travel detail
   - Platform files: `Map.android.tsx`, `Map.ios.tsx`, `MapUploadComponent.*`

2. **`components/MapPage/`** (50+ files, ~8,000 LOC) — Full map page  
   - `Map.web.tsx` (1,302 LOC): Leaflet-based, separate `Point` type in `Map/types.ts`
   - `TravelMap.tsx` (854 LOC): Reusable travel map component
   - Routing: `RoutingMachine.tsx`, `useRouting.ts`
   - Filters: `FiltersPanel.tsx`, `FiltersPanelBody.tsx`, etc.
   - Clustering: `Map/ClusterLayer.tsx`
   - Modular hooks: `Map/useMapInstance.ts`, `Map/useMapApi.ts`, etc.

### Problems

- **Duplicated types**: Two `Point` types (one inline, one exported), both supporting the same backend fields
- **Duplicated normalization**: Each stack has its own `normalizePoint()` / marker parsing logic
- **Duplicated popup**: `PlacePopupCard` used by both but with different data shapes
- **Divergent bugs**: Fixes in one stack don't propagate to the other
- **No shared contract**: No single source of truth for map marker, route, or event interfaces

---

## Decision

Introduce a **`components/map-core/`** directory as a shared contract layer:

### Architecture

```
components/
├── map-core/           # Shared contract (NEW)
│   ├── types.ts        # MapMarker, MapViewState, RouteState, MapEventHandlers, etc.
│   ├── index.ts        # Barrel re-export
│   └── (future: MapMarkerLayer.tsx, MapPopup.tsx, useMapRouting.ts)
│
├── map/                # Travel detail map (consumer)
│   ├── Map.web.tsx     # → imports MapMarker from map-core, thin adapter
│   └── ...
│
└── MapPage/            # Full map page (consumer)
    ├── Map.web.tsx     # → imports MapMarker from map-core, thin adapter
    ├── Map/types.ts    # → re-exports from map-core for backward compat
    └── ...
```

### Migration Strategy

1. **C1** (done): Create `map-core/types.ts` with unified types + `legacyPointToMarker()` converter
2. **C2** (next): Both Map.web.tsx files import `MapMarker` from map-core; use `legacyPointToMarker` as bridge
3. **C3**: Extract shared `MapMarkerLayer` / `MapPopup` from both stacks into map-core
4. **C4**: Unify routing logic into `map-core/useMapRouting.ts`

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| Directory, not package | Only 2 consumers within the same project |
| `LegacyMapPoint` type preserved | Gradual migration; converters bridge old → new |
| `parseCoordString()` shared | Both stacks parse "lat,lng" strings identically |
| MapPage `Map/types.ts` becomes re-export | Zero breaking changes for existing imports |
| No Leaflet types in map-core | Keep map-core framework-agnostic for future native maps |

---

## Consequences

### Positive
- Single source of truth for map types (no more divergent `Point` types)
- Shared marker normalization eliminates duplicate bug-prone parsing
- Foundation for future shared popup/routing/clustering components
- Easier onboarding — one types file to learn

### Negative
- Migration effort for both stacks (mitigated by `legacyPointToMarker` bridge)
- Short-term: two representations coexist (legacy + new) until full migration

### Risks
- MapPage has 50+ files — must ensure no regressions during type migration
- Leaflet version coupling between stacks needs verification

---

## References

- `components/map-core/types.ts` — Unified types
- `docs/REFACTORING_PLAN.md` — Phase 2 (C1–C4)

