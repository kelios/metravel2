## Context

See proposal.md for the independent production baseline. The recorded query cache contains the selected starter-list query as pending/idle while restoration blocks subscriptions. The URL effect commits starter categories before restoration finishes. `usePlacesCatalogController.ts:242` equates initial loading with `isLoading`, which requires fetching; its empty branch causes `PlacesScreen.tsx:267–316` to remove grid56 before request start and remount grid75 afterward.

The observed locale stays RU, only one selected-list GET starts, and the API response arrives after the main shift. These facts rule out locale remount, duplicate requests and response data as initiators of this collapse. The separate temporary header width/title shifts remain measured supporting observations, not grounds for a speculative style patch.

## Goals / Non-Goals

**Goals:** close the unresolved-result state gap in the existing controller and preserve grid identity until the first request can run. Cover actual restoration blocking and route application, then verify real published CLS.

**Non-Goals:** change provider restoration scheduling, default/URL category semantics, filters, API/data, header typography, banner geometry or unrelated consumers.

## Decisions

- Reuse the query's pending-result status instead of fetching-only loading. The controller owns presentation status; a query without data is unresolved even while idle. Preserve explicit route readiness and existing error/list/refresh precedence.
- Reject timers, artificial reveal delays, hiding content and larger CLS budgets: they leave the wrong state model intact. Reject changing restoration scheduling globally because the defect belongs to this consumer's interpretation of pending state.
- Add a real QueryClient/IsRestoringProvider regression to the existing hydration suite. Hold restoration, record intermediate frames and grid identity, release restoration and a deferred response, and exercise success/empty/error. Do not mock query status booleans.
- Add a cold-browser DOM/geometry regression in the existing places suite: observer starts before hydration, records any grid absence before catalog readiness and full CLS; deterministic transport may hold the initial result. Live five-run acceptance uses real API data.
- Owned paths: controller, the two focused test files and this OpenSpec change. No new abstraction or dependency is needed.

## Risks / Trade-offs

- Pending can include paused/offline fetching → keeping the existing loading state is accurate until the existing transport returns data or a terminal error; do not suppress terminal errors. Test both terminal outcomes and retained data.
- Shared controller affects native source consumers → focused state tests cover the common branch once; no native-specific runtime path changes, so no device run is justified by this diff.
- Small independent header shifts may remain → retain all CLS sources and judge the actual full-page budget after deploy; any remaining failure needs attribution before expanding source scope.
- Runtime regression may depend on startup scheduling → deterministic restoration test is the primary state invariant, browser identity/geometry and live metrics prove integration.

## Migration Plan

No data migration or API change. Independent review-and-fix and gate precede commit/push and production deploy coordinated by the parent session. Rollback reverts this bounded task diff. Targeted Jest/static checks precede review; browser execution only follows review/testing. Exact published SHA and five fresh mobile390 measurements are mandatory for production claims.

## Validation Matrix

- Mobile390: first diagnostic reproduced CLS0.3924; after deploy five cold full CLS≤0.1, grid continuity, screenshots, console/network and actual filters.
- Desktop1280: changed shared status transition and responsive geometry control after deploy.
- RU representative runtime; no localization resources changed. Existing terminal empty/error and refresh tests preserve semantics.
- Native source: same status behavior, no changed native boundary; no build/device gate.
- SEO/a11y/security/analytics: no new routes, semantics, input handling, links, secrets or events; no separate checks beyond focused static validation.
