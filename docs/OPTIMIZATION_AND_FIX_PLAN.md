# Optimization And Fix Plan

## Status

- Created: 2026-04-01
- Source: repository audit from current workspace
- Goal: reduce active defects first, then lower maintenance cost and improve performance safely

## Already done

- Reviewed project rules and workflow:
  - `AGENTS.md`
  - `docs/README.md`
  - `docs/RULES.md`
  - `docs/TESTING.md`
- Audited repo structure, scripts, docs, and key app areas.
- Verified governance baseline:
  - direct `window.open(...)` violations not found outside approved chokepoints
  - direct `Linking.openURL(...)` violations not found outside `utils/externalLinks.ts`
  - skipped tests not found in app/test sources
- Ran baseline checks:
  - `npm run check-deps` ✅
  - `npm run guard:file-complexity` ⚠️ 27 files over 800 LOC
  - `npm run lint` ✅
  - `npm run typecheck` ❌

## Priority order

### P0. Restore green typecheck

Reason:
- This is the main active defect signal in the repo.
- It blocks safe refactoring and hides real regressions.

Current error clusters:
- `components/listTravel/*`
  - mixed `ViewStyle | TextStyle | ImageStyle` passed into `View`/`ScrollView`
- `components/MapPage/*`
  - route and geometry callbacks disagree on `number` vs `number | null`
- `hooks/usePdfExportRuntime.ts`
  - incomplete returns and invalid narrowed types
- `services/pdf-export/generators/v2/runtime/*`
  - renderer/runtime/theme contracts are out of sync
- `components/ui/IconButton.tsx`
  - invalid `Pressable` props for current RN typings

Planned result:
- `npm run typecheck` passes without suppressing real errors.

### P1. Reduce oversized module risk in product-critical areas

Reason:
- `guard:file-complexity` reports 27 oversized files.
- These files are expensive to change and hard to verify.

First targets:
- `components/travel/TravelWizardStepPublish.tsx`
- `screens/tabs/QuestsScreen.tsx`
- `components/home/HomeHero.tsx`
- `components/MapPage/Map/MapLogicComponent.tsx`
- `services/pdf-export/generators/v2/runtime/EnhancedPdfGeneratorBase.ts`

Approach:
- move orchestration to hooks
- move repeated UI sections to focused subcomponents
- isolate styles/constants/helpers
- keep behavior unchanged while shrinking edit surface

### P2. Normalize style typing and design-system usage

Reason:
- Several UI surfaces rely on broad style objects and `as any`.
- There are still hardcoded colors outside the main token path.

First targets:
- export/list travel UI
- quests UI
- older theme layer in `constants/theme.ts`

Approach:
- prefer `DESIGN_TOKENS` and current themed colors
- narrow style contracts at component boundaries
- remove avoidable `as any` in UI primitives

### P3. Stabilize map and PDF subsystems

Reason:
- Both subsystems are large, type-broken, and high-risk.

Map work:
- unify route callback contracts
- make `null` handling explicit
- remove geometry assumptions around optional coords

PDF work:
- sync generator/runtime/renderer interfaces
- remove stale preview/runtime assumptions
- add targeted validation after each fix block

### P4. Bundle and dependency audit

Reason:
- Baseline metrics flag several heavy dependencies.
- Some packages look weakly justified by current usage.

Candidates to review:
- `lucide-react`
- `lucide-react-native`
- `react-native-paper`
- PDF stack overlap

Approach:
- verify actual imports
- remove dead deps where safe
- re-measure bundle only after defect baseline is green

### P5. Tooling and docs cleanup

Reason:
- Internal tooling messages should match the repo.

Known cleanup:
- `npm run check-deps` references `TESTING_CHECKLIST.md`, which is not present in this repo.

## Execution log

### In progress

- none

### Next after current block

- start module decomposition for oversized files
- normalize remaining hardcoded colors to theme/design tokens
- review heavy dependencies after the defect baseline stays green

## Completed in this implementation pass

- Fixed `listTravel` typecheck cluster:
  - narrowed style contracts in export UI
  - removed invalid `Pressable` prop usage in `components/ui/IconButton.tsx`
  - decoupled `ListTravelExportControls` from incompatible parent style shape
- Fixed `MapPage` web typecheck cluster:
  - aligned `Map.web`, `MapWebCanvas`, `RoutingMachine`, and geometry contracts
  - made nullable route/radius values explicit
- Fixed `quests` typecheck cluster:
  - corrected `PointLike`/map step compatibility
  - removed unsafe `unknown` usage in conditional rendering
  - replaced outdated absolute-fill usage in animated overlay
- Fixed `PDF/export runtime` typecheck cluster:
  - made `usePdfExportRuntime` return paths explicit
  - removed dead preview-window placeholder logic
  - synchronized renderer/theme/runtime call sites
  - removed stale temporary preview test artifact from `tmp/`
- Reduced local UI debt in `QuestsScreen`:
  - removed remaining hardcoded hex colors in quest-card UI
  - switched affected surfaces to themed colors/tokens
- Reduced `TravelWizardStepPublish` coupling:
  - moved Instagram draft state, derived values, and reorder/edit handlers into `components/travel/useInstagramPublishDraft.ts`
  - kept the screen component focused on publish flow and UI wiring
  - extracted the Instagram publish UI into `components/travel/InstagramPublishPanel.tsx`
  - extracted moderation/admin actions into `components/travel/PublishModerationAdminPanel.tsx`
  - extracted status/current-state/quality summary UI into `components/travel/PublishStatusSummaryPanel.tsx`
  - reduced the size of `TravelWizardStepPublish.tsx` without changing publish behavior
- Reduced `HomeHero` coupling:
  - moved the book/slider hero layout into `components/home/HomeHeroBookLayout.tsx`
  - moved the mobile popular-routes section into `components/home/HomeHeroPopularSection.tsx`
  - centralized shared quick-filter types in `components/home/homeHeroShared.ts`
  - kept hero state, preload logic, animation state, analytics, and routing in `components/home/HomeHero.tsx`
  - reduced `components/home/HomeHero.tsx` below the file-complexity threshold without changing visible hero behavior
- Reduced `QuestsScreen` coupling:
  - moved sidebar/filter UI into `screens/tabs/QuestsSidebar.tsx`
  - moved quest-card UI and hover/media behavior into `screens/tabs/QuestCard.tsx`
  - moved the right content shell, map/list rendering, empty states, and skeletons into `screens/tabs/QuestsContentPanel.tsx`
  - centralized shared quest screen types/helpers in `screens/tabs/questsShared.ts`
  - kept derived data, geolocation, persistence, SEO, and map/list orchestration in `screens/tabs/QuestsScreen.tsx`
  - reduced `screens/tabs/QuestsScreen.tsx` without changing `/quests` behavior
- Reduced `MapLogicComponent` coupling:
  - moved debug overlay UI into `components/MapPage/Map/MapDebugPanel.tsx`
  - moved Leaflet/debug window registration into `components/MapPage/Map/mapDebugTools.ts`
  - kept map lifecycle, fitBounds logic, and route/radius behavior in `components/MapPage/Map/MapLogicComponent.tsx`
  - reduced `components/MapPage/Map/MapLogicComponent.tsx` below the file-complexity threshold without changing route visibility behavior
- Reduced `EnhancedPdfGeneratorBase` coupling:
  - moved HTML document shell, print styles, and page-number sync script into `services/pdf-export/generators/v2/runtime/pdfRuntimeMarkup.ts`
  - moved map location-card markup generation into `services/pdf-export/generators/v2/runtime/pdfRuntimeMarkup.ts`
  - moved separator-page markup generation into `services/pdf-export/generators/v2/runtime/pdfRuntimeMarkup.ts`
  - moved stats mini-card and running-header markup generation into `services/pdf-export/generators/v2/runtime/pdfRuntimeMarkup.ts`
  - moved inline-gallery markup generation into `services/pdf-export/generators/v2/runtime/pdfRuntimeMarkup.ts`
  - moved travel-content runtime prep (`descriptionHtml`, parsed blocks, gallery flags) into `services/pdf-export/generators/v2/runtime/pdfRuntimeMarkup.ts`
  - moved map-page runtime prep (route-file parsing, route info, snapshot fallbacks, location-card data assembly) into `services/pdf-export/generators/v2/runtime/pdfRuntimeMapData.ts`
  - removed stale forwarding helpers left behind in `services/pdf-export/generators/v2/runtime/EnhancedPdfGeneratorBase.ts` after the runtime extractions, while keeping the helper surface still covered by tests
  - moved helper-oriented assertions in `__tests__/services/EnhancedPdfGenerator.test.ts` onto extracted runtime modules where those helpers now actually live
  - kept orchestration, parser/renderer lifecycle, and runtime page assembly in `services/pdf-export/generators/v2/runtime/EnhancedPdfGeneratorBase.ts`
  - reduced `services/pdf-export/generators/v2/runtime/EnhancedPdfGeneratorBase.ts` from 1719 to 634 lines without changing PDF runtime behavior
- Restored green full test suite:
  - removed `ESLint` runtime API usage from `scripts/run-fast-scope-checks.js` to avoid flat-config dynamic-import failures under Jest
  - aligned `__tests__/scripts/run-fast-scope-checks.test.ts` with the script's synchronous contract
  - cleared the remaining full-suite failures in `__tests__/scripts/run-fast-scope-checks.test.ts` and `__tests__/components/home/HomeHero.test.tsx`

## Validation after implementation

- `npm run typecheck` ✅
- targeted ESLint on touched files ✅
- `npm run test:run -- __tests__/components/travel/TravelWizardStepPublish.test.tsx` ✅
- `npm run test:run -- __tests__/components/home/HomeHero.test.tsx` ✅
- `npx playwright test e2e/travel-wizard.spec.ts -g "должен показать предупреждения на шаге публикации"` ✅
- `npx playwright test e2e/ui-layout-regressions.spec.ts -g "Home hero:"` ✅
- targeted ESLint on `QuestsScreen` slice ✅
- `npx playwright test e2e/quest-video.spec.ts -g "should load quest page and check video in finale"` ✅
- targeted ESLint on `MapLogicComponent` slice ✅
- `npm run test:run -- __tests__/components/MapPage/MapLogicComponent.test.tsx __tests__/components/MapPage/MapLogicComponent.zoom-radius.test.tsx` ✅
- `npx playwright test e2e/map-page.spec.ts -g "desktop: route polyline is visible after entering start/end coordinates"` ✅
- targeted ESLint on `EnhancedPdfGeneratorBase` slice ✅
- `npm run test:run -- __tests__/services/EnhancedPdfGenerator.test.ts __tests__/services/pdf-v2/EnhancedPdfGeneratorEntrypoint.test.ts` ✅
- targeted ESLint on the follow-up `EnhancedPdfGeneratorBase` runtime-markup slice ✅
- `npm run test:run -- __tests__/services/EnhancedPdfGenerator.test.ts __tests__/services/pdf-v2/EnhancedPdfGeneratorEntrypoint.test.ts` after the follow-up runtime-markup extraction ✅
- targeted ESLint on the inline-gallery runtime-markup slice ✅
- `npm run test:run -- __tests__/services/EnhancedPdfGenerator.test.ts __tests__/services/pdf-v2/EnhancedPdfGeneratorEntrypoint.test.ts` after the inline-gallery extraction ✅
- targeted ESLint on the travel-content prep extraction ✅
- `npm run test:run -- __tests__/services/EnhancedPdfGenerator.test.ts __tests__/services/pdf-v2/EnhancedPdfGeneratorEntrypoint.test.ts` after the travel-content prep extraction ✅
- targeted ESLint on the map-runtime extraction ✅
- `npm run test:run -- __tests__/services/EnhancedPdfGenerator.test.ts __tests__/services/pdf-v2/EnhancedPdfGeneratorEntrypoint.test.ts __tests__/services/pdf-export/generators/v2/runtime/renderers/MapPageRenderer.test.ts` after the map-runtime extraction ✅
- targeted ESLint after stale runtime-wrapper cleanup ✅
- `npm run test:run -- __tests__/services/EnhancedPdfGenerator.test.ts __tests__/services/pdf-v2/EnhancedPdfGeneratorEntrypoint.test.ts __tests__/services/pdf-export/generators/v2/runtime/renderers/MapPageRenderer.test.ts` after stale runtime-wrapper cleanup ✅
- targeted ESLint after shifting helper assertions to extracted modules ✅
- `npm run test:run -- __tests__/services/EnhancedPdfGenerator.test.ts __tests__/services/pdf-v2/EnhancedPdfGeneratorEntrypoint.test.ts __tests__/services/pdf-export/generators/v2/runtime/renderers/MapPageRenderer.test.ts` after shifting helper assertions ✅
- `npm run test:run -- __tests__/scripts/run-fast-scope-checks.test.ts __tests__/components/home/HomeHero.test.tsx` ✅
- `npm run lint` ✅
- `npm run test:run` ✅
