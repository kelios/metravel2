## Why

Authors cannot distinguish a rejected article from an ordinary draft or read the moderator's reason in the editor and their travel list. Backend #2665 and moderator UI #2685 now supply the decision; #2669 connects that private feedback to the author without treating a historical decision as current publication state.

## What Changes

- Preserve optional `moderation_decision`, `moderation_decision_reason`, and `moderation_decided_at` through author-list and editor reads.
- Present rejected feedback only for a current draft with a rejected decision. Published, approved, and pending-review states retain their canonical meaning. An unpublished article with an old approval remains a draft.
- Show the moderator's plain-text reason and correction action for rejected drafts; show a valid optional decision date for rejected drafts and published articles with an approved decision. Correction opens the editor without submitting; use the existing explicit submission after editing.
- Reuse the existing wizard summary and profile cards, with a bounded reason preview and an existing information sheet for the full reason.
- Preserve ordinary Save/autosave behavior, old API responses, role boundaries, and current publication filters.

## Capabilities

### New Capabilities

- `author-moderation-feedback`: Private decision feedback, correction navigation, and compatibility in the author's editor and travel list.

### Modified Capabilities

None. The adjacent in-flight `preserve-wizard-publication-status` change remains authoritative for publication commands and status persistence.

## Impact

Platform impact: shared. Desktop web 1440px and mobile web 390px are the acceptance surfaces; no platform-specific runtime or configuration changes are planned.

Localization impact: all current locales — RU/BE/UK/PL/EN. App labels and accessibility text use i18n; valid dates use locale formatting; moderator prose remains verbatim.

Dependencies: #2665 and #2685 are done. #2693 provides committed canonical status behavior (`0c583c042326e2a09b68bde00c03ddd9208264e1`) and is still in testing; this change preserves its invariants and does not claim to complete its independent acceptance.

Fallback/mock policy: optional absent/unknown decision values produce existing status behavior. Invalid canonical publication status retains the existing error and write block. Mocks are unit-test fixtures only; acceptance requires real owner-authorized production records and responses.

Data/API: read existing fields on authenticated author detail/list responses; exclude historical feedback from content/full writes. Backend is a read-only dependency. No endpoint or permission changes.

Affected frontend areas: travel types, profile normalization, existing publication adapter, editor mapping, wizard summary, own-profile travel cards, i18n resources, focused tests, and `docs/TRAVEL_SAVE_MODERATION_CONTRACT.md`.

Accessibility: full keyboard/touch access to the correction and full-reason actions, no nested buttons/links, readable wrapped labels, and sheet close/focus behavior.

Security: display feedback only in authorized author/superuser editor and own-list contexts; never expose it through public/catalog cards, even if stray fields exist. Render moderator text as text, not markup. No token/auth lifecycle changes.

Performance: no new requests, packages, media changes, or catalog-wide feedback. Keep card media geometry and uniform collapsed card height; full reasons open outside the grid layout.

SEO and external links: none; authenticated author UI has no route/canonical/SSG/sitemap changes. Analytics: none; no new measurement requirement.

Non-goals: backend/mail/push/notification-center changes, new moderation commands or rules, historical-decision timelines, reworking publication filters, public feedback, and a visual redesign.

Open questions: no material product ambiguity remains after the canonical-status/decision matrix in the normative design section. Production fixture availability and live owner-list field delivery still require testing-stage evidence; missing data is not a reason to invent a decision.
