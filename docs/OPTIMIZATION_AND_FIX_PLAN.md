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

## Validation after implementation

- `npm run typecheck` ✅
- targeted ESLint on touched files ✅
