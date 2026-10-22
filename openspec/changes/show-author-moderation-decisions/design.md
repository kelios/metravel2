## Context

See proposal.md for motivation. `docs/TRAVEL_SAVE_MODERATION_CONTRACT.md` defines canonical publication state and Save ≠ moderate. Its appended #2669 Design evidence is the normative state table and 1440/390 layout; this design does not redefine those rules.

Source evidence before implementation:

- `utils/travelPublicationStatus.ts:42` resolves canonical status, including invalid canonical; `:62` builds commands and excludes decision/reason, but not yet the optional decision date.
- `components/profile/travelNormalize.ts:104` starts a whitelist mapping; its returned record omits all three decision fields, so private list payload data cannot reach the UI. Its current nullish status normalization must not let an explicit invalid canonical become a fallback while adding feedback.
- `utils/travelFormUtils.ts:285` merges defined server fields into the editor, while `:305` preserves the canonical status. Historical fields must stay read-only across all merge/write paths.
- `components/travel/useTravelPublishModeration.ts:87` maps canonical state to the wizard label; `PublishStatusSummaryPanel.tsx:56` renders the current-status card without decision feedback; `TravelWizardStepPublish.tsx:187` supplies its props.
- `components/listTravel/TravelListItem.tsx:198` uses draft classification for navigation/filtering, `:677` displays only a generic draft badge, and `:486` already hoists actions out of the real web anchor. `ProfileTravelGrid.tsx:117` supplies the own-list renderer context.
- `components/listTravel/RenderTravelItem.tsx:21` has a memo comparator that omits publication/decision fields: a refetch can retain an old chip even after normalization is fixed. `hooks/useTravelFormPersistence.ts:79` owns the server-save response field allowlist; `components/travel/upsert/useUpsertTravelController.ts:310` preserves server publication state during draft recovery but needs the same explicit ownership for decision fields.
- Backend read-only BA evidence: `travels/services/moderation_service.py:49` preserves decisions for same-state saves, clears all three fields on transition to pending, records approval on published and explicit rejection on pending→draft; `:20` unpublish leaves historical approval. The travel serializer's owner/superuser filter removes private decision fields for other readers. Live delivery is a testing-stage check, not inferred from source.

## Goals / Non-Goals

One common interpretation and one reusable feedback presentation for the author list and wizard. Reuse publication commands, role checks, card slots, return navigation, Button/CardActionPressable, themed colors, and InfoSheet. Keep publication filters and URL behavior intact. No backend, auth, device-config, public UI, timeline, or media redesign.

## Decisions

### 1. Extend the publication adapter with a read-only feedback model

Add optional fields to Travel/TravelFormData and preserve safe types through author normalization/editor mapping. A common pure resolver beside `resolveTravelPublicationStatus` returns current canonical status plus `rejected` presentation only for `draft + rejected`, optional nonempty raw reason, and a valid optional date only for `draft + rejected` or `published + approved`. A historical approval never overrides draft/pending/approved. Unknown decisions produce no feedback; invalid canonical stays invalid. Callers use one result for label/feedback, while draft filtering and publication writing continue to use canonical state.

Rejected alternative: branch directly on decision in each chip. That produces false Published after unpublish, stale Rejected while pending, and two diverging display rules.

### 2. Compose one feature feedback component into existing slots

A small `components/travel/TravelModerationFeedback.tsx` (or an equivalently named existing feature extension if found) renders the reason/date/correction controls from the common model. The existing passive status-chip geometry is retained; no generic selectable Chip replacement or new card shell is needed. Use a two-line reason preview and existing InfoSheet for full plain text, with close→preview and focus return. The full reason must be keyboard, touch, and screenreader accessible. A consistent full-reason control for every nonempty reason is allowed; short reasons remain readable without opening it. Never gate the only full-text access behind a character threshold: line overflow varies by width/font/locale. No new measurement hook or threshold API is needed.

Wizard placement is in PublishStatusSummaryPanel's current-status card, above checklist/moderator controls. The correction callback uses existing `onStepSelect(1)`, without save or status selection. List placement uses a private feedback sibling inside RenderTravelItem's cell but outside the article anchor; actions retain existing edit/returnTo semantics. Extract/reuse the existing small passive status chip if needed, using an explicit presentation flag to suppress the duplicate generic draft badge, never changing `isDraft`, navigation, filters, or counters. Uniform collapsed card content height and unchanged media/column geometry are mandatory. Adapt the authored wrapper's existing height behavior only as necessary to contain the bounded footer. General catalogs retain their layout and confidentiality. Existing oversized files must not grow by blank-line pruning or unrelated refactoring.

Row stretching alone does not satisfy that minimum: profile rows are independent and mobile rows contain one card. The list feedback therefore reserves one common minimum derived from its real typography, two-line reason preview, date, existing control touch targets, gaps, and padding. Use a minimum rather than a fixed or maximum height so enlarged text can grow. Missing fields remain absent from the DOM; no placeholder content is rendered. Verify different states and independent rows, not only one card before and after disclosure.

Rejected alternative: inline full-length reasons in grid cards. Arbitrary moderator text stretches individual cards, causes layout shifts, and duplicates expansion UI. Existing InfoSheet keeps the full text available without reflowing the grid.

### 3. Use explicit visibility context, not field presence

Only authored profile tabs and `/metravel` callers explicitly opt in to feedback; viewer id must also match a record owner id. Neither general `canEdit` nor superuser alone enables it in a list. The editor already verifies owner/superuser edit access; retain that boundary. Public profiles/catalogs must not render private reasons even if a test or stray response includes them. Reset sheet/expansion state on article/context change and do not cache feedback separately. Add canonical status, legacy publish/moderation flags, and all three decision fields to the existing RenderTravelItem memo comparison, so old API fallback updates too. No extra requests or token/auth changes.

### 4. Historical data is read-only

Exclude `moderation_decision`, `moderation_decision_reason`, and `moderation_decided_at` from ordinary full/content saves. Only the existing explicit reject command supplies its new reason. Existing submit flow updates feedback only from a confirmed server response; save/autosave preserves its previous server decision. A full authoritative server read and local-draft recovery overwrite all three local metadata fields with current server values, including absent/null, so old snapshot decisions cannot revive. A genuinely partial content-save response without metadata retains the last confirmed server fields, while explicit null clears them. Test these distinct read/merge semantics through the actual mapper/persistence/recovery path.

The full/partial boundary is the known request path, not a guess based on object keys: `cleanAndSave` invokes full `saveFormData` (`hooks/useTravelFormPersistence.ts:438`), whereas `saveContentDelta` returns the separately typed `TravelContentSaveResponse` from `saveTravelContent` (`:459`, `api/misc.ts:340`). Full GET hydration/recovery and full-save response merging treat server decision metadata as authoritative, including explicit null. The existing `applyContentSavedData` branch (`hooks/useTravelFormPersistence.ts:706`) retains the preceding confirmed form snapshot and applies only its known partial response; its current `TravelContentSaveResponse` contract (`api/misc.ts:287`) contains text/slug fields, no decision metadata. Keep that response boundary rather than extending it speculatively. Do not infer response completeness from the presence of id/name/publication flags.

### 5. Localization and access

Use a common travel key family for rejected/reason/full reason/correction/date/a11y and reuse canonical existing labels. Add each new key to RU/BE/UK/PL/EN. Use reactive translation and `i18n/format.ts` only after validating the optional date. Never translate/sanitize into HTML the moderator's plain text. No SEO/canonical/SSG, external-link, analytics, auth storage or OS-specific changes; no new package or requests.

### 6. Card hover follows the DOM across portal boundaries

Production acceptance found a wrapper retaining its 1.02 hover transform after the reason Modal closed with the pointer outside the card; intrinsic layout stayed unchanged. The React enter/leave boundary includes logical portal descendants, so React hover state is unsuitable for this DOM-only effect. Keep the existing wrapper as the single lift owner for the article anchor, hoisted actions, and feedback, but use the canonical `dataSet` plus `app/global.css` hover channel for fine pointers. Supply the existing shared transform token through a CSS custom property rather than duplicating lift values. Native and mobile layouts retain their existing behavior.

Reject a reason-specific `onClose` reset: other portaled controls would retain the same failure mechanism. Reuse the existing global CSS channel instead of adding per-card listeners or observers. A DOM regression must exercise the actual React portal boundary and verify marker/token propagation; deployed browser evidence must additionally prove positive lift, action alignment, and automatic resting bounds after dismissal without a corrective enter/leave gesture.

## Affected files and ownership

Implementation: `types/types.ts`, `utils/travelPublicationStatus.ts`, `utils/travelFormUtils.ts`, `hooks/useTravelFormPersistence.ts`, `components/travel/upsert/useUpsertTravelController.ts`, `components/profile/travelNormalize.ts`, `components/listTravel/RenderTravelItem.tsx`, `components/travel/{useTravelPublishModeration,PublishStatusSummaryPanel,TravelWizardStepPublish,TravelModerationFeedback}.tsx/ts`, associated existing styles/types, `components/listTravel/TravelListItem.tsx`, its authored-context plumbing via ProfileTravelGrid/ProfileScreen and `/metravel`, travel i18n resources, and focused tests. Exact paths follow the source mechanism and avoid unrelated travel changes.

Planning: this change and the append-only #2669 section of `docs/TRAVEL_SAVE_MODERATION_CONTRACT.md`. Preserve the foreign #2693 task state and #2678 achievement/peer work. No edits to backend or protected configuration.

The acceptance repair additionally owns the wrapper hover rule in `app/global.css`, the existing shared card-token comment, and its focused DOM regression. It does not change the separate card-owned hover used by selectable cards.

## Risks / Trade-offs

- Historical decisions imply false current state → canonical × decision regression table, including draft+approved and pending+rejected.
- Full-replace echoes optional date/private fields → exclude all three fields centrally and assert the real outgoing payload.
- Partial save response drops feedback or explicit null fails to clear it → test both partial-preserve and explicit-clear semantics in the existing mapper/persistence path.
- Private response fields accidentally render in public cards → opt-in own-list context plus role check and negative public/catalog test with deliberately populated fields.
- Long/translated text disturbs grid or creates nested interactive HTML → bounded preview, existing sheet, fixed collapsed layout, hoisted controls, 390/1440 browser evidence.
- Portaled controls leave a card visually lifted with an outside pointer → DOM-owned hover, shared transform token, real portal regression and unmodified pointer-dismiss browser probe.
- Missing live list fields → real GET acceptance on a disposable author fixture; never synthesize approval/rejection from legacy flags.

## Validation matrix

| Layer | Coverage | Evidence |
| --- | --- | --- |
| Static/unit before runtime | Canonical×decision matrix; optional/malformed fields; profile/editor mapping; read-only write exclusion; save/submit preservation/clear; CTA no write; author/admin vs public; real portal ancestry, hover CSS reachability and token propagation | Focused Jest, selective lint/typecheck/guards, `npm run test:i18n`, full-task independent review-and-fix then code-review gate |
| Desktop web 1440 / mobile web 390 in testing | Both surfaces, rejected short/long/empty reason, valid/malformed date, approved/published, stale decision on draft/pending, missing fields, loading/network error; RU/BE/UK/PL/EN; light/dark; keyboard/touch/focus/sheet | Production browser screenshots, console and network; no horizontal overflow, no false Published, no private reason on public context |
| Real API in testing | Disposable author detail/list, QA-superuser approval/rejection, content/full Save, correction navigation with zero writes, explicit resubmit | Sanitized request/response evidence, UI readback after refresh, cleanup readback; no real author content |
| Android/iOS | Common code preserves responsive semantics; no platform-specific behavior changed | No additional device gate required for this scope |

Run only the narrowed code checks under the shared operation lock, after coordinating #2678 baseline. No browser/API runtime during code review. Production deployment/acceptance follows root's task pipeline after reviewed code is committed/pushed and status becomes testing.

## Migration Plan

No data migration: fields already exist, absence remains compatible. Revert only #2669 owned changes if needed; retain #2693 canonical persistence and backend decisions. A UI rollback hides new feedback without losing server decisions. Before archive, validate this change strictly; record existing unrelated global OpenSpec validation failures without rewriting foreign changes.

## Open Questions

Only deferrable runtime facts: actual owner-list payload visibility and suitable disposable QA fixture creation/cleanup on production. Both are explicit Done-gate checks; no new business rule is assumed.
