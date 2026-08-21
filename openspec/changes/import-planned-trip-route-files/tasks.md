## 1. Confirm the route-point boundary

- [x] 1.1 Snapshot a controlled authenticated test trip's current route, PUT a valid 50-point route, and record the HTTP response plus routed/approximate state and summary.
- [x] 1.2 PUT the corresponding 51-point route, record the same evidence, restore the exact original route, and verify the restored route through GET.
- [x] 1.3 Compare the 50/51 result with the design assumption; if 50 is not stably routed, stop and revise the proposal, spec, design, and task limit before product implementation.

Evidence (2026-08-20, production test trip 31): 50 points → HTTP 200, ORS, optimal, no fallback; 51 points → HTTP 200, ORS, optimal, no fallback; restore and verification GET → HTTP 200, zero original points restored exactly. The frontend budget remains a conservative 50 points, not a claimed API ceiling.

## 2. Build and test the import domain logic

- [ ] 2.1 Add minimal GPX/KML fixtures covering one route, multiple routes, named waypoints/Placemarks, endpoint-name overlap, empty geometry, malformed XML, unsafe declarations, and invalid coordinates in the existing ignored/test fixture locations.
- [ ] 2.2 Add bounded format/root/XML validation and named-point metadata extraction beside `parseRouteFilePreviews`, preserving that function's existing geometry behavior and tests.
- [ ] 2.3 Add a discriminated route-import result/error model that calls `parseRouteFilePreviews` for geometry and maps unsupported, too-large, damaged, empty, read, and capacity failures without leaking parser messages.
- [ ] 2.4 Implement pure Douglas–Peucker display simplification and target-bounded route-draft conversion with exact endpoints, traversal-ordered named anchors, coordinate/name deduplication, replace/append semantics, and a maximum of 50 complete route points.
- [ ] 2.5 Add unit tests proving parser reuse, distance/count metadata, multi-route selection data, all error codes, input immutability, 2,000-point display cap, 50-point draft cap, exact endpoints, waypoint preservation, equal-join deduplication, and mandatory-anchor capacity failure.

## 3. Add cross-platform file selection and preview UI

- [ ] 3.1 Implement the web adapter with a labelled hidden `<input type="file" accept=".gpx,.kml">`, local text reading, pre-read size rejection, cancellation, busy state, and stale-result protection.
- [ ] 3.2 Implement the native adapter with `expo-document-picker`, cache-backed local reading, temporary-copy cleanup, cancellation, busy state, and stale-result protection shared by Android and iPhone.
- [ ] 3.3 Implement the shared `TripRouteImportPanel` using project UI primitives and `ToolActionsRow`, including loading/error states, route selection, two-line `TravelMap` preview with text legend, distance/count/named-waypoint details, and explicit replace/append/cancel actions.
- [ ] 3.4 Add RU/BE/UK/PL/EN import strings with matching resource shape and tests for translated actions, statistics, status, every error, and RU fallback.
- [ ] 3.5 Add component tests for web and native chooser adapters, stale/cancelled reads, preview switching, accessible names/order/status text, responsive touch targets, and non-destructive error/cancel behavior.

## 4. Integrate with the planned-route draft

- [ ] 4.1 Mount the focused import panel beside the existing route export tools and pass current draft/routed geometry without moving file logic into `RouteBuilder`.
- [ ] 4.2 Apply replace/append results only through the existing local `route` state so `useTripRoutePreview` runs normally and no `useUpdateTripRoute` call occurs before the existing Save route action.
- [ ] 4.3 Add RouteBuilder integration tests proving preview-before-apply, replace, append, live preview after apply, no PUT before Save, existing PUT payload on Save, and unchanged export/manual-edit behavior.
- [ ] 4.4 Update `docs/features/trips.md` with the local import flow, 50-point confirmed boundary, explicit-save behavior, platform adapters, phase-2 exclusion, and validation commands.

## 5. Validate implementation and runtime behavior

- [ ] 5.1 Run the focused route parser/import/RouteBuilder Jest suites and `npm run test:i18n`; fix every in-scope failure.
- [ ] 5.2 Run `npm run guard:external-links`, `npm run governance:verify`, and the relevant UI/i18n guardrails; confirm the new flow adds no direct external link or untranslated key.
- [ ] 5.3 Run desktop and mobile-web browser checks with real GPX/KML fixtures: preview map/statistics, multiple-route selection, replace/append, no update request before Save, save/reload, cancellation, and all negative errors.
- [ ] 5.4 Run the native document-picker flow with real files on the connected Android device and in the iPhone Simulator; verify mobile parity, picker return/cancel, preview, replace/append, explicit save, cache cleanup, and runtime logs. Use a physical iPhone only if the selected external document-provider scenario cannot be represented in Simulator.
- [ ] 5.5 Run `npm run check:preflight` and the full trips test scope; fix every affected lint, type, test, build, or runtime failure.

## 6. Independent review and acceptance

- [ ] 6.1 Run the mandatory independent `$metravel-code-reviewer` review-and-fix over the complete task diff, with the board contract, task-owned paths, and all validation evidence; repair confirmed bugs, duplication, poor reuse, performance issues, and native/web regressions.
- [ ] 6.2 Re-review the repaired complete diff and rerun every focused check affected by review fixes plus `npm run check:preflight`.
- [ ] 6.3 On the explicitly authorized deployed candidate, complete the board Done gate on production with real GPX and KML, replace/append, save/reload, corrupt/empty/unsupported/too-large files, and provider-routed state within the confirmed point limit.
- [ ] 6.4 Validate this change with `openspec validate import-planned-trip-route-files --type change --strict` and `openspec validate --all`, then record the final code paths, commands, browser/device/API evidence, remaining risks, and phase-2 exclusions for handoff.
