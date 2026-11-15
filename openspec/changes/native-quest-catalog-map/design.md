## Context

The route passes `mode="radius"` plus `radius="2000"`. `Map.ios.tsx` enables
`useMapClusters` for `radius && !pointsOnly`; `Map.android.tsx` reexports that
same renderer. Its existing points-only branch fits the supplied marker bounds,
and its coordinate parser reads the first value as latitude without a centroid hint.
The native base floor still clamps a phone to z2, which clips a global dataset
even when `fitBounds` is called. Leaflet's `getBoundsZoom` is itself clamped by
the current minimum, so the old floor must be removed before measuring the target.

## Goals / Non-Goals

**Goals:** catalogue-owned markers, loading/error/empty states, one native Back
action, unchanged marker navigation and main-map radius behavior.

**Non-Goals:** new native map engine, clustering, coordinate/data edits, new copy,
main-map behavior, package/configuration or release changes.

## Decisions

- Set `pointsOnly` and `showRadiusCircle={false}` at the native route; remove the
  fake radius. Rejected: increasing the radius because it retains the wrong data owner.
- Reuse `QuestLandingLoadError` for failed reads and retry activity, narrowing
  its style input to the only style key it consumes. Keep stale successful data visible.
- Share a compact state body and preserve the web `QuestMapWebFrame`; native
  uses the header's Back control instead of the floating duplicate.
- Store the current catalogue fit bounds in the native tile controller. Lower
  the public map minimum to zero before measuring its exact fit zoom, then use
  the lower of that fit and the existing base floor. Resize reapplies the
  point target without animation; leaving pointsOnly restores the radius floor.
  Rejected: directly reusing `mapFitFloor.getWorldCoverZoom`, whose height-based
  floor also yields z2 and clips the same points. Base tile layers have no
  independent minZoom cap. Existing wrapped tile identity/lifecycle stays intact.
- Task paths: route, error-component prop type, native layers/tile controller,
  route/native-script regressions, tracked Maestro suite and map/quest docs.
- Design evidence: `docs/design/quest-map-native-states.md` fixes the four existing states and header-owned Back action.
- API/auth/data stay unchanged; existing sanitized quest URLs and raw coordinate ordering are preserved.
- Accessibility reuses existing text/roles and gives the native marker DOM an
  explicit name from its already projected `categoryName` (including DivIcon,
  which does not use `img.alt`). Category changes already invalidate marker
  identity through the existing signature. SEO and analytics stay unchanged.

## Risks / Trade-offs

World-scale points can overlap. QA inspects that they are quest markers and can
open a quest; clustering is a separate requirement. A complete global catalogue
can show empty bands above/below the world at low zoom: all points take precedence
over the radius map's height-fill rule. The radius floor is restored when the
catalogue target clears. Rollback is a task-only revert.

## Validation

Nearest checks are route contract/state/navigation unit tests, existing native
map fit/coordinate regressions, native governance, focused lint and typecheck.
The real Leaflet test covers the minZoom clamp, all distant points in bounds,
lower-zoom tile delivery, resize and restoration of the unchanged radius floor.
`e2e/maestro/quest-catalog-map.yaml` is registered in its own guest Android suite
and source-validated with `npm run e2e:native:check`; runtime is a later gate.
After review/commit/push in `testing`, Android emulator verifies the distinct
native renderer/bridge, distant coordinates, tap navigation and `/map` control.
iOS runtime is omitted under the validation selection gate: changed code has
no OS-specific branch and Android reexports the identical renderer. An iOS
renderer/bridge/OS-integration change invalidates that reuse decision. A single
web control covers retained route-state framing. No physical capability is changed.
