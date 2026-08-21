## Why

Phase 1 planned-trip import converts GPX/KML geometry into at most 50 ordinary route points, so a detailed source track cannot survive as exact planner geometry and the selected file is lost after the picker closes. Backend task #1493 has now deployed an owner-only zero-or-one route-file contract, so frontend task #1496 can retain the original bytes, render the complete source geometry, and let the owner download that original again.

## What Changes

- Upload the same selected GPX/KML source to the planned-trip route-file endpoint while applying a valid import, without re-encoding its bytes.
- Query the trip's stored route-file metadata through TanStack Query, download it through the authenticated client, and expose one localized “download original” action in the existing export surface.
- Parse the stored file for display and render its complete original geometry as a distinct planner-map layer while keeping simplified route points as the editable/savable route model.
- Replace the stored file when a later import is applied and invalidate the route-file query after upload.
- Preserve phase-1 validation, preview, replace/append, explicit route-save boundary, current route export, and owner access rules.
- Add focused API, orchestration, rendering, download-byte, localization, and regression tests plus the factual planned-trips feature contract.

### Goal

After importing a supported route file, the owner sees the exact source track on the planned-trip map and can download the unchanged original file later, including after reload.

### User-visible result

The planner distinguishes the stored original track from editable route points, reports the stored filename, and offers “Download original” in the export tools. Re-importing replaces that single stored original.

### Existing behavior to preserve

- Applying phase-1 import changes only the local route-point draft; the existing Save route action remains the only `PUT .../route/` boundary.
- Manual point editing, live route preview, generated GPX/KML export, navigation links, and cancel/error behavior remain available.
- Mobile web, Android, and iPhone retain the same action hierarchy and meaning.

### Non-goals

- Backend model, endpoint, permission, storage, or migration changes.
- More than one stored original file per planned trip, route-file history, or file deletion UI.
- Editing the dense original geometry or converting it into more than the phase-1 route-point budget.
- Production deployment or store publication.

### Dependencies and fallback policy

- Backend task #1493 is complete. The required contract is owner-only `GET/POST /api/trips/planned/{trip_id}/routes/`, `GET .../routes/{route_id}/download/`, and `DELETE .../routes/{route_id}/`, with zero-or-one metadata `{id, original_name, ext, size, download_url, created_at, updated_at}`; POST creates with 201 or replaces with 200 and download returns exact uploaded bytes.
- Phase 1 task #1492 supplies selection, validation, parsing, preview, and replace/append behavior. This change builds compatibly on its in-progress files and does not duplicate its parser.
- No mock-only or generated-route fallback may claim that an original is stored. If upload fails, the local import draft is not applied and the user sees a localized error; if stored-file fetch or parse fails, the editable route remains usable but the original layer/action exposes the error rather than substituting simplified geometry.

## Capabilities

### New Capabilities

- `planned-trip-original-route-file`: Owner-side persistence, exact-geometry display, and byte-preserving download of the single original GPX/KML file associated with a planned trip.

### Modified Capabilities

- `planned-trip-route-import`: Applying a valid route import now persists the same selected source file before the local route-point draft is changed.

## Impact

- **Platform impact — shared:** desktop web, mobile web, Android, and iPhone use common API/query and planner behavior; picker/download adapters preserve platform-specific file representations without changing UX. Common visible UI requires desktop and mobile-web browser evidence; native device evidence is required only for the native file/persistence/download adapters touched by this change.
- **Localization impact — all current locales:** stored-file state, upload/download actions, and errors are added to RU/BE/UK/PL/EN with RU fallback.
- **User-visible:** exact stored line on the planner map, filename/status text, upload failure feedback, and one original-download action.
- **Code:** planned-trip API/query modules, phase-1 picker/import panel seam, planner map props/layers, export menu, i18n resources, tests, and `docs/features/trips.md`.
- **API/data:** consumes the deployed route-file endpoints and metadata; does not change backend schema. Server state belongs to TanStack Query.
- **SEO:** not applicable; the authenticated planner and file download are not indexable content.
- **Accessibility:** new status/error text and actions require accessible names, disabled/busy state, keyboard activation on web, and project touch targets.
- **Performance:** adds one zero-or-one metadata query and one authenticated file download only when an original must be rendered or explicitly downloaded; parsed geometry is memoized/cached and does not add a routing request.
- **Security:** owner authorization remains enforced server-side; frontend accepts only the validated GPX/KML picker result, never injects XML, never exposes tokens, and uses authenticated API helpers rather than a raw unauthenticated URL.
- **Analytics:** no new event is added because planned-route original-file actions have no approved analytics contract.

### Open questions

None. The deployed API shape, single-file replacement rule, exact-byte download requirement, and phase-1 integration boundary are fixed by tasks #1493/#1496.
