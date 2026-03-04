# Architecture Remediation Plan

> **Project:** `metravel2`  
> **Date:** 2026-03-04  
> **Purpose:** Practical architecture-level plan of fixes required to stabilize quality, delivery speed, and maintainability.

---


### P0-2. Image architecture policy violation

**Symptoms**
- `npm run check:image-architecture` fails because:
  - `components/travel/FullscreenGallery.tsx` imports `expo-image` directly.

**Required fixes**
1. Replace direct `expo-image` usage in feature layer with approved UI abstraction.
2. Re-run image architecture checker in CI and local workflow.

**Definition of Done**
- `npm run check:image-architecture` passes.

---

### P0-3. TypeScript contract is not enforceable

**Symptoms**
- `392` TS errors in `60` files.
- Largest error concentration:
  - `screens/tabs/MapScreen.tsx` (`67`)
  - `screens/tabs/QuestsScreen.tsx` (`50`)
  - `hooks/useScrollNavigation.ts` (`38`)
  - `hooks/useTravelFormData.ts` (`26`)
- Dominant error codes:
  - `TS2339`, `TS18046`, `TS2769`, `TS2322`, `TS2571`

**Required fixes**
1. Add mandatory `typecheck` step (`tsc --noEmit`) in CI quality gate.
2. Fix errors in map + quests + shared hooks first (max blast-radius area).
3. Remove stale suppressions (`@ts-expect-error` without real error).

**Definition of Done**
- `npx tsc --noEmit` passes for main branch.

---

## 3) Priority P1 (architecture debt that slows delivery)

### P1-1. Oversized modules (god files)

`24` files exceed `800 LOC`; top offenders:

- `services/pdf-export/generators/EnhancedPdfGenerator.ts` (`2236`)
- `components/UserPoints/UserPointsMap.tsx` (`1902`)
- `components/article/ArticleEditor.web.tsx` (`1676`)
- `components/travel/PointList.tsx` (`1372`)
- `components/quests/QuestWizard.tsx` (`1347`)
- `components/MapPage/Map.web.tsx` (`1305`)

**Required fixes**
1. Split by responsibility: `view`, `model`, `adapters`, `styles`, `hooks`.
2. Keep feature behavior unchanged while extracting.
3. Add a hard gate for file complexity in CI (not warning-only).

**Target**
- Phase 1: no file above `1200 LOC`.
- Phase 2: no file above `800 LOC`.

---

### P1-2. Layering violations (hooks depending on components)

**Symptoms**
- Hooks import component-layer modules, e.g.:
  - `hooks/useMapScreenController.ts`
  - `hooks/useMapMarkers.ts`

This violates the ownership rule in `docs/MODULE_OWNERS.md` and complicates reuse/testability.

**Required fixes**
1. Move shared types/contracts to neutral layer (`types/` or `components/map-core` contracts only).
2. Move non-visual business logic out of component directories.
3. Ensure hooks import from `api/`, `stores/`, `utils/`, `context/`, `types/`.

---

### P1-3. ADR drift in map stack

**Symptoms**
- `docs/ADR_MAP_ARCHITECTURE.md` states migration completion.
- TS errors and duplicated point representations show migration is partial.

**Required fixes**
1. Mark ADR status as partial/in-progress until type unification is complete.
2. Finish migration from legacy map point shapes to single contract.
3. Add regression tests for map-core adapters.

---

## 4) Priority P2 (quality discipline improvements)

### P2-1. Reduce unsafe typing and suppressions

Current app-level signals (excluding tests/e2e/scripts/docs):

- `any`: ~`2899` occurrences
- `@ts-ignore`: `77`
- `@ts-expect-error`: `4`

**Required fixes**
1. Forbid new unsafes without explicit justification.
2. Remove unsafes in top hotspots first (map, user points, list travel).
3. Track weekly delta in CI report.

---

### P2-2. Remove hardcoded UI colors

Current scan shows ~`99` hex usages in app/components/hooks/screens.

**Required fixes**
1. Migrate UI hex values to `DESIGN_TOKENS` / theme colors.
2. Add guard script for newly introduced hex values in UI layer.

---

### P2-3. Improve web bundle boundaries

Large web chunks remain:

- `__common` ~`2.35MB`
- `entry` ~`1.98MB`
- `MapScreen` ~`559KB`
- `quill` ~`494KB`

**Required fixes**
1. Strengthen lazy boundaries for editor/PDF/map-heavy modules.
2. Keep home/search/map critical path free from editor/export dependencies.
3. Re-check Lighthouse on production build artifact.

---

## 5) Recommended execution plan

### Sprint A (1-2 days): Stabilize quality gates

1. Fix image architecture violation (P0-2).
2. Make `typecheck` part of CI gate.

**Exit criteria**
- `lint`, `test:run`, `check:image-architecture`, `typecheck` are green.

---

### Sprint B (3-5 days): Type debt burn-down (high-impact modules)

1.Remove invalid suppressions.
2.Add strict typing for key boundaries (map points, filter values, router params).

**Exit criteria**
- TS errors reduced by at least `50%` from baseline.

---

### Sprint C (1-2 weeks): Structural decomposition

1. Refactor top oversized files into focused modules.
2. Enforce complexity gate in blocking mode.
3. Validate no behavior regressions with targeted tests.

**Exit criteria**
- Files above `800 LOC` reduced from `24` to `<= 10`.

---

### Sprint D (parallel): Performance hardening

1. Move heavy optional features behind lazy imports.
2. Validate bundle and Lighthouse deltas after each optimization.

**Exit criteria**
- Reduced critical route JS size and stable Lighthouse scores on production artifact.

---

## 6) Non-negotiable governance constraints

All remediation work must preserve project policies from `docs/RULES.md`:

1. No direct `window.open` in feature code.
2. No direct `Linking.openURL` outside `utils/externalLinks.ts`.
3. Use design tokens instead of hardcoded UI colors.
4. Keep web release model without service-worker runtime cache workarounds.

---

## 7) Tracking metrics (weekly)

Track these objective KPIs every week:

1. `test:run` failures count.
2. `tsc` error count (total and by module).
3. Files above `800 LOC`.
4. New `any` and `@ts-ignore` delta.
5. Policy violations (`check:image-architecture`, external-links guards).
6. Key web chunk sizes (`entry`, `__common`, map/editor chunks).

This document should be updated incrementally as fixes are delivered.
