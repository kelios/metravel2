## Context

See [proposal.md](./proposal.md) for motivation and [planned-trip-route-import/spec.md](./specs/planned-trip-route-import/spec.md) for observable behavior. The permanent Task Contract is board task #1492; the supplied “Route Planner 2.0” mockup remains the visual reference: https://claude.ai/code/artifact/bbdfa4d6-b1d3-4cca-8161-58701255c5e6.

The planned-route draft is local state in `components/trips/planning/RouteBuilder.tsx`. Coordinate edits already drive `useTripRoutePreview`; only the existing save action calls `useUpdateTripRoute` and replaces the ordered backend point list. `utils/routeFileParser.ts` already returns one or more geometry previews through `parseRouteFilePreviews`, but does not retain GPX `<wpt><name>` or named KML point Placemarks. `TravelMap.web.tsx` and `TravelMap.native.tsx` already render multiple colored `routeLines`, so they can show current and pending geometry without extending either planner map engine.

The read-only backend contract has no serializer point-count validator, but it sends the complete route point list to OpenRouteService and falls back to an approximate direct line when routing fails. A controlled production probe on 2026-08-20 showed both 50 and 51 points returning HTTP 200 with `provider=ors`, `is_optimal=true`, no fallback, and the original test route restored exactly. Therefore an HTTP 200 response alone remains insufficient evidence, but 50 is a conservative frontend processing budget confirmed to route successfully rather than a claimed hard backend maximum.

## Goals / Non-Goals

**Goals:**

- Keep `RouteBuilder` as the owner of the route draft while moving file lifecycle, preview state, and conversion into focused modules.
- Reuse the established geometry parser and multi-line map implementation.
- Make file selection platform-specific but keep parsing, preview, apply semantics, errors, and visual hierarchy shared.
- Bound XML work and rendered geometry, preserve route meaning, and prevent stale asynchronous reads from overwriting newer selections.

**Non-Goals:**

- Do not add a route-file backend endpoint or persist the source XML.
- Do not change the internal track/route extraction behavior of `parseRouteFilePreviews`.
- Do not add another routing request or save pathway; applied points enter the existing preview and save path.
- Do not refactor the 1,000+ line `RouteBuilder` beyond the small integration seam required for this feature.

## Decisions

### 1. Add a focused import controller with platform file adapters

Create a shared `TripRouteImportPanel` under `components/trips/planning/` that owns the finite UI state `idle | reading | preview | error` and receives the current route/geometry plus an `onApply(RoutePoint[])` callback. Small `.web` and native platform adapters provide a normalized selected document (`name`, `size`, `text`):

- web uses a visually hidden `<input type="file" accept=".gpx,.kml">` and `File.text()`;
- native uses `expo-document-picker` with `copyToCacheDirectory: true`, reads through `expo-file-system/legacy`, and removes only the temporary cache copy after reading.

Each selection increments a request token; completion from an older read is ignored. Cancel is a no-op. The primary import trigger uses `ToolActionsRow` so desktop shows icon plus label and the mobile surfaces retain a single 44+ dp tool action.

**Alternative considered:** embed `Platform.OS` and both browser/native APIs in `RouteBuilder`. Rejected because it enlarges an existing god component and risks pulling native-only modules into web behavior.

### 2. Preserve `parseRouteFilePreviews` as the geometry source of truth

Add a narrow metadata helper beside `routeFileParser` that extracts only valid named GPX `<wpt>` nodes and named KML Point Placemarks. The import orchestration calls `parseRouteFilePreviews(text, extension)` for all track/route coordinates and calls the metadata helper for names; it does not copy or fork track parsing logic. XML safety validation runs before both operations: extension, encoded/file size, `DOCTYPE`/`ENTITY`, parser error, and matching root element.

Errors are normalized to a discriminated import error code (`unsupported`, `tooLarge`, `damaged`, `empty`, `capacity`, `read`) and translated only at the UI boundary. Parser/library text is never shown directly.

When `parseRouteFilePreviews` returns multiple routes, the first is selected initially and a compact existing selection primitive lets the user choose another. Named file-level waypoints stay visible and are included with whichever route is applied because GPX waypoints are not structurally owned by a `<trk>` or `<rte>`.

**Alternative considered:** extend or replace `parseRouteFilePreviews` with a new combined parser. Rejected by the Task Contract and because it would create a second geometry interpretation used only by trips.

### 3. Render a bounded pending preview with the existing multi-line travel map

`TripRouteImportPanel` renders `TravelMap` in compact mode with `travelData=[]`, `showRouteLine`, and two `routeLines` converted from stored `[lng, lat]` into the map's `[lat, lng]` contract:

1. current routed geometry (or current draft points) in the muted route color;
2. the pending imported geometry in the accent color.

A text legend identifies both lines so meaning does not depend on color. Bounds come from both lines through the existing map implementation. Statistics use the selected parser result before route-point conversion: calculated distance, original coordinate count, and the named-waypoint list.

To prevent a large valid file from freezing Leaflet/WebView, the display-only pending polyline is Douglas–Peucker reduced to at most 2,000 vertices. Its statistics remain based on the complete parsed preview. This 2,000-point display cap is not persisted and does not implement phase-2 source-file storage.

**Alternative considered:** add a second line to both `TripPlanRouteMap` implementations. Rejected because the native planner map's WebView message contract currently carries one route line, while `TravelMap` already has the needed cross-platform multi-line contract.

### 4. Convert to a maximum of 50 route points with mandatory anchors

Implement a pure `buildImportedRouteDraft` utility with inputs `{existingRoute, parsedRoute, namedWaypoints, mode, maxPoints: 50}`. It performs these steps:

1. sanitize geometry and retain the exact first and last coordinates as mandatory anchors;
2. trim names, discard invalid named coordinates, deduplicate equal coordinates, and merge a waypoint name onto a matching endpoint;
3. project remaining named waypoints to the closest position along the selected polyline and sort them by route traversal position;
4. compute the imported budget: 50 for replace, or `50 - existingRoute.length`, adding one slot back when the append join is an equal coordinate;
5. fail with `capacity` if mandatory imported anchors cannot fit;
6. use Douglas–Peucker on only the non-mandatory track vertices, increasing epsilon with a bounded binary search until the merged result fits the budget;
7. merge mandatory waypoints back in traversal order and assert the complete result is at most 50 points.

The utility never mutates either input. Existing point objects and order are retained for append. At an equal join, one point is kept and a non-empty name is preserved. All imported ordinary vertices use the normal planned-route point shape, so no backend schema change is required.

The 50-point decision is a conservative processing budget for predictable client and routing cost. The controlled authenticated test-trip probe saved and inspected 50 and 51 points, restored the original route, and recorded both HTTP and routing state: both probes were routed optimally by ORS, so 50 is confirmed safe but is not presented as the backend ceiling. Any future increase requires its own performance/provider evidence; an approximate fallback never counts as success.

**Alternatives considered:**

- Fixed sampling every Nth point: rejected because it loses bends non-uniformly.
- Simplify first and then append names: rejected because it can overflow capacity or reorder/drop named anchors.
- Let the backend/provider decide: rejected because provider failure degrades to an approximate line and would make ordinary imports unreliable.

### 5. Applying changes only local draft state

Replace and append actions call `onApply` with the fully processed route. `RouteBuilder` sets its existing `route` state and clears the import preview; that coordinate change naturally drives the established `useTripRoutePreview` flow from #1490. No mutation hook is called from the import panel. The existing “Save route” action remains the only call to `useUpdateTripRoute`.

If parsing, capacity calculation, or async reading fails, `onApply` is never called. Choosing another file replaces only pending import state. This creates a single rollback boundary: dismissing the preview returns to the untouched route draft.

**Alternative considered:** apply and immediately PUT from the panel. Rejected because it violates the explicit-save contract and bypasses the normal live preview/error state.

### 6. Localize at the component boundary and preserve project UI contracts

Add import copy to the existing trips planning namespaces for RU, BE, UK, PL, and EN, with matching key structure and RU fallback. Reuse `Button`, `Chip`/selection primitives, `ToolActionsRow`, feedback/status components, design tokens, and themed colors. The hidden web input is labelled by its visible tool action; native and web controls expose role, label, disabled/busy state, and logical focus order. Error and legend semantics always include text.

No analytics event is introduced because current route tools have no stable analytics contract. No direct external link is added. The authenticated planner has no SEO impact.

## Affected Paths and Contracts

- `components/trips/planning/RouteBuilder.tsx`: mount the focused panel and apply its resulting route to existing local state.
- `components/trips/planning/TripRouteImportPanel*`: shared preview/controller and platform selection adapters.
- `components/trips/planning/tripRouteImport.ts` (or equivalent focused utility): error normalization, metadata merge, simplification, capacity, and coordinate conversion.
- `utils/routeFileParser.ts`: additive named-waypoint extraction only; existing `parseRouteFilePreviews` behavior remains unchanged.
- `i18n/*` resource modules: identical new key set in all five current locales.
- trips unit/component/e2e suites: fixtures and behavior coverage.
- API remains `PUT /trips/planned/{id}/route/ { points: RoutePoint[] }`; backend source and schema are read-only dependencies.

## Risks / Trade-offs

- **[20 MiB XML can block the JavaScript thread]** → reject by metadata size before reading where possible, validate again after reading, cap display vertices, and expose a busy state that prevents duplicate actions.
- **[GPX waypoints are file-level and may sit away from the chosen track]** → order them by closest projected path position, show all names before apply, and retain exact waypoint coordinates.
- **[A pending read may finish after a newer choice or unmount]** → use a monotonically increasing request token and ignore stale completion.
- **[Douglas–Peucker plus mandatory anchors can exceed capacity]** → reserve mandatory anchors first, fail visibly when they alone exceed the budget, and assert the final result before applying.
- **[Backend HTTP 200 may hide routing-provider rejection]** → inspect routing state/summary in the 50/51 probe and in end-to-end acceptance, not status code alone.
- **[A second embedded map adds load cost]** → mount it only in preview state, use existing lazy web/native map implementations, and unmount on cancel/apply.
- **[Platform pickers return different URI/size metadata]** → normalize them behind platform files and cover both adapters with mocks plus runtime device evidence.

## Migration Plan

1. Run the controlled 50/51 test-trip probe and restore the original test route. Completed 2026-08-20: both were optimal ORS routes and restoration matched exactly.
2. Add pure parsing/metadata/simplification utilities and tests.
3. Add platform file adapters and shared preview UI with locale resources.
4. Integrate the panel into `RouteBuilder` without changing save semantics.
5. Run scoped unit/component/i18n checks, then repository preflight and cross-surface runtime validation.
6. After an explicitly authorized deployment, run the Task Contract's production GPX/KML, negative, replace/append, save, and native-picker acceptance.

Rollback removes the import panel integration and its additive helpers/translations. There is no database migration, source-file storage, or new saved data type to reverse; routes already explicitly saved remain ordinary planned-route points and continue to work.

## Validation Matrix

| Surface | Required evidence |
| --- | --- |
| Desktop web | Real GPX and KML through file input; two-line preview and statistics; route selector for multi-route fixture; replace/append; no PUT before Save; save and reload; corrupt/empty/unsupported/too-large errors; keyboard flow. |
| Mobile web | Same hierarchy/actions at a narrow viewport; file input; 44+ px targets; preview map fit/scroll; replace/append and save. |
| Android | Real document picker on the connected device; local read; preview; replace/append; save; cancel; damaged file; app remains stable after picker return. |
| iPhone | Simulator document picker and runtime flow for the shared native implementation; physical iPhone evidence only if the selected external document provider cannot be represented in Simulator. |
| RU/BE/UK/PL/EN | Key parity automated for all locales; component assertions for error/stat/action copy; runtime spot checks with no raw key or clipping. |
| API/provider | Controlled test trip completed at 50 and 51 points with the original route restored exactly; both returned optimal ORS routing. Acceptance still imports/saves/reloads within the conservative 50-point frontend budget. |
