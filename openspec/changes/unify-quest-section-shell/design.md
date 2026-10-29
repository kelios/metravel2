## Context

See proposal.md. `QuestsScreen` owns the catalog lifecycle and an existing `QuestsSidebar`; scenario/country/map bypass this composition. Gameplay already has progress navigation and geographic provider selection. `AffiliateOffers` supports generic context and handles disclosure and safe external links.

## Goals / Non-Goals

Goals: one sidebar/drawer frame and one advertising placement; existing route controllers keep their behavior. Preserve the scenario's bounded readable column and wrapping labels.

Non-goals: rewrite the catalog controller or gameplay progression, change APIs/content, invent geographic context, alter provider configuration, or add a second reading scroll host.

## Decisions

- Extract `QuestSectionFrame` and its four layout styles from the catalog; keep the catalog's selection/controller and pass its sidebar slots. Informational/map pages use a small navigation adapter built from existing catalog selectors and the same sidebar renderer. Rejected wrapping pages in the entire catalog screen: it would run catalog return/review/geolocation lifecycle on informational routes.
- `QuestPageColumns` owns one advertising node inside each existing content scroll: inline below 1600 px and a right rail on wider screens. This leaves room for the existing left sidebar and gameplay's map/reading split. The shared breakpoint registry is emitted in critical CSS. Generic/contextual `AffiliateOffers` is the default; gameplay supplies its existing provider slot and disables its replaced mounts.
- Keep gameplay progress navigation and scroll/ref identities. Public pages use the catalog navigation; gameplay uses its contextual route navigation in the same sidebar/content/advertising composition.
- Reuse existing localized labels and provider disclosure; no locale resources change. Affiliate navigation remains in the existing external-link helper.

Affected paths: new quest frame/columns/navigation adapters and tests; `QuestsScreen`, `QuestsContentPanel`, `QuestsScreen.styles`, `QuestScenarioScreen`, country/map routes, gameplay advertising composition, critical CSS, and quest feature docs.

Data/API: existing quest query/cache and selectors; no new endpoints or server changes. Public navigation uses existing catalog handoff storage for non-city slices.

## Risks / Trade-offs

- Narrowing the catalog for an ad rail changes its measured grid width → retain the existing container-width measurement and test card sizing.
- SSR starts with narrow React geometry → retain the sidebar's existing first-frame selectors and register advertising breakpoints from one source.
- Duplicate advertising or gameplay remounts → replace old mounts in the same diff, keep the reading host/ref, and test single-provider rendering and a guest step.
- Drawer locks can conflict → move the catalog lock to the shared frame so it has one owner and restores prior values on close/unmount.

## Migration Plan

Implement adapters and shared primitives, integrate route consumers, run source checks and independent review, commit/push explicit task paths, deploy the reviewed SHA through the canonical frontend script, then accept mobile before desktop on production. Rollback is a revert of this task's commits and the same canonical deployment; no backend/config changes.

Validation: focused frame/navigation/advertising/gameplay regressions, lint/type/guards and the applicable repository baseline; production scenario/catalog/city/country/map and guest gameplay probes for navigation, one ad group, geometry, footer reachability and console. Native-specific code is unchanged; simulator/store gates are not introduced by shared visual composition.
