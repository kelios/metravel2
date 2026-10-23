## Context

See proposal.md. The current wizard uses <600px for compact route navigation, <768px for screen-row ownership, >=1280px for its sidebar, and <840px high only on compact phones for flow placement. These independent predicates leave tablet/landscape with two site/quest identity rows. The existing placement hook already protects scroll anchors, drafts, focus and open sheets.

## Technical Design

Scope: one quest-detail top-shell presentation contract.
Existing code to reuse: HeaderContextBar, ScreenHeaderBarActions, useQuestScreenHeader, QuestCompactSidebar, QuestHeaderPanel and useQuestHeaderPlacement.
Affected paths: components/layout/{questHeaderPresentation,customHeaderModel,CustomHeader,HeaderContextBar,headerLayoutContract}; app/(tabs)/_layout; utils/criticalCSSBuilder; components/quests/hooks/useQuestWizardResponsiveModel; nearest regression tests.
Data/API impact: none. Platform impact: desktop web | mobile web. Localization impact: all current locales (layout only). External-link impact: none.
Task Contract: one title/action owner; <=20% combined pinned TOP chrome at the seven specified viewports; all existing actions reachable; no draft/scroll/sheet identity loss.

## Decisions

- A pure quest presentation policy owns screen-row mode, short-height placement, 600px route disclosure and 1280px sidebar boundary. It explicitly preserves native ownership while web uses one screen row below 1280px; wide desktop retains its brand row and sidebar identity/actions. Native already has its own safe-area/Stack owner, so widening web composition must not replace native tablet navigation.
- Recognize only two-segment quest detail paths, including supported locale prefixes; catalog/city/country routes stay under current shell rules.
- Reserve 52px context row plus the existing 2px shell borders as an isolated `quest-screen` variant/cache key. Critical CSS consumes the same geometry, including lazy fallback. The route marker lets critical CSS hide the static brand row below 1280px before first paint, while wide desktop keeps its existing 78px brand row. The quest breadcrumb fallback is hidden on wide desktop because the sidebar owns identity.
- At height <840 and below the sidebar boundary move the existing quest panel into its existing reading ScrollView. At wider widths keep the existing sidebar title, metadata, actions and navigation; the global quest context row is omitted there.
- Keep the same reading ScrollView and main-content parent through the 1280px sidebar boundary. The existing interaction guard defers desktop panel handoff as well as route disclosure/flow placement, preserving an open route sheet and restoring focus to the sidebar's current point. On a return to compact width the live screen row owns title/actions immediately while the same reading host retains the draft and focus.
- Retain 44px targets, existing heading semantics, JSON-LD, keyboard focus and passive content-language notices.
- Reject one-off padding reductions: they do not remove the stacked ownership and cannot satisfy a 390px-high landscape window. Reject a fake mobile-width predicate for the whole app: other routes and desktop sidebar would change.

## Risks / Trade-offs

- [First-frame reservation differs from runtime] → shared geometry, dedicated fallback marker and hydration/source regression checks; browser measure after reviewed rollout.
- [Resize interrupts reading] → reuse the existing interaction-aware placement hook and mounted draft/sheet/scroll regressions.
- [Desktop duplicates identity] → wide quest context bar is omitted; existing sidebar stays the sole quest title/action owner.
- [Compact global brand is absent] → existing dock and More controller already run below the same 1280px breakpoint (useResponsive.isDesktop), retaining site navigation and LanguageOptionList; wide desktop retains its brand controls.
SEO: URLs, canonical, redirects, sitemap/robots, metadata and structured data are unchanged; one H1 stays with the screen-row/sidebar owner selected by the viewport. Performance: no new network/media/deferrals; header reservation must match first paint. Security/analytics: unchanged existing helpers/events; no new inputs, credentials or links.

## Validation Plan

Source: route/policy matrix (including reserved country/theme routes), header model, critical CSS, hydrated context row, responsive-model and mounted wizard interaction tests, including unfocused drafts, focused input and an open route sheet across 1279/1280 and tablet portrait/landscape; scoped lint/typecheck. RU/BE/UK/PL/EN layout with existing i18n validation under the shared quality owner.
Testing after independent review: screenshots and console at all seven viewports, light/dark, RU/translated/fallback locale, intro/step; measure combined pinned top bounds, open info/offline/overflow and route sheet, preserve draft/focus/scroll through resize, retain desktop sidebar. Loading/error/offline remain reachable. No device gate is introduced for unchanged native behavior.

## Migration Plan

No data migration. Parent session handles independent review, explicit-path commit/push and shared deploy operation gate; browser acceptance uses the exact deployed SHA. Rollback reverts this task's presentation diff and restores the prior shell without touching progress or quest content.
