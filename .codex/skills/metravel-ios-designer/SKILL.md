---
name: metravel-ios-designer
description: "Design or source-audit metravel iPhone/iPad UI against HIG, then hand simulator/device visual QA to testing. Covers adaptive windows, safe areas, touch targets, Dynamic Type, accessibility, app icon/launch, and mobile parity."
---

# Metravel iOS Designer

Use this skill for the visual and interaction layer of the active universal
iPhone/iPad release. It is the iOS-specialised layer over `$metravel-design-auditor`; use
that generic skill for cross-page web audits.

Implementation and `review` are code/design-artifact only. Do not capture a
simulator or physical-device screenshot there; define the exact visual matrix
for `$metravel-ios-tester` after code-review pass in `testing`.

`AGENTS.md` is inherited. Read the relevant UI/media heading, design tokens and
layout, the affected screen contract, and only the release-asset artifact when
App Store assets are in scope.

## Design contract — non-negotiable

- **One product, one hierarchy.** Mobile web, Android and iPhone keep identical
  information hierarchy, block order, key sizes, action order and touch
  semantics. Only engine, system permissions/insets and OS APIs may differ; a
  platform difference is never an excuse for a different UX. Desktop may add
  hover-only affordances. iPad adapts the same hierarchy to its available scene.
- **Tokens, not hex.** Themed surfaces use `useThemedColors()`; on native
  `DESIGN_TOKENS.colors.*` is a static light fallback, not a live theme.
- **Existing primitives.** `components/ui`, `ImageCardMedia` (contain + blur),
  `UnifiedTravelCard`, shared map/place cards. No local duplicate substitutes.
- **Photo dominance** on content cards; header ≤20% of the mobile viewport;
  static frost instead of live `backdrop-blur` on mobile.

## Apple mobile axes

- Safe areas: notch/Dynamic Island, home indicator, status bar, landscape
  insets; no content or tap target under system chrome; keyboard avoidance and
  scroll insets on forms.
- Touch: minimum 44×44 pt effective target including padding-driven hitboxes;
  no overlay that swallows taps.
- Type and motion: Dynamic Type at the largest supported sizes without clipped
  or overlapping text; reduced-motion honored; no text truncation caused by a
  `Text` without `flex` inside a row.
- Accessibility: VoiceOver labels/order, focus after navigation, contrast in
  light and dark, meaningful state for loading/empty/error/disabled.
- Native permission and system dialogs: purpose strings read as product copy in
  all five locales, and a denied optional permission still leaves unrelated
  browsing usable.

## Release assets

- App icon and launch screen are validated by `npm run ios:release:guard`
  (`IOS_APP_ICON_ASSET`, `IOS_APP_ICON_CATALOG`, `IOS_SPLASH_ASSETS`,
  `IOS_BRAND_ASSETS_EXPO`) — produce assets that pass the guard, do not
  weaken the guard.
- App Store screenshots: localized RU/BE/UK/PL/EN, captured from a real build on
  the required iPhone and iPad display sizes, showing the shipped UI without mock data,
  placeholder text or personal data. Keep captures in ignored folders.
- Raster icon/art generation follows the project icon-art pipeline; UI glyphs
  stay vector/icon-font, never emoji.

## Workflow

1. Fix the route set and the scenarios/locales in scope.
2. Define the Apple mobile layer required by each scenario (simulator for layout
   and windowing, physical device for safe-area/permission/keyboard reality).
3. Build the expected consistency matrix: axis × surface, route/state/locale,
   screenshot requirement, and expected result. The tester captures it in
   `testing` and classifies observable deviations.
4. Trace each confirmed symptom to code and to the token/component that should
   own it. Do not report taste preferences as defects.
5. In audit mode return findings only. When fixes are requested, keep them in
   task-owned styling scope, prefer a platform file over a shared-code rewrite,
   and never regress web — then complete code review before re-capture in
   `testing`.

## Boundaries

- Do not change `app.json`, `eas.json`, `plugins/**` or `scripts/**` unless the
  assigned task explicitly puts that configuration in scope; asset/icon config
  changes go through `$metravel-ios-developer`.
- Do not touch backend, Apple portal, TestFlight or App Store state.
- Do not claim device behavior from a simulator screenshot.

## Output

Expected consistency matrix, ordered source/design findings with likely owner
files, fixes applied (if any), code-level checks, and exact simulator/device
testing handoff. Runtime HIG/mobile-parity pass/fail belongs to testing.
