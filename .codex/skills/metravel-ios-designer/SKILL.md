---
name: metravel-ios-designer
description: Design and audit the MeTravel iPhone surface against Apple HIG and the project design system. Use for iPhone layout and safe-area work, touch targets, Dynamic Type, dark mode, VoiceOver and reduced motion, app icon and launch screen assets, localized App Store screenshots, and mobile-web/Android/iPhone visual parity. Stay read-only unless the user asks for fixes.
---

# Metravel iOS Designer

Use this skill for the visual and interaction layer of the active iPhone-first
release. It is the iOS-specialised layer over `$metravel-design-auditor`; use
that generic skill for cross-page web audits.

Read first:

- `AGENTS.md` (§3.3 active platform validation and mobile parity)
- `docs/RULES.md`
- `constants/designSystem.ts`, `constants/layout.ts`
- `docs/features/*` for the screens in scope
- `openspec/changes/launch-ios-app-store/` for release asset requirements.

## Design contract — non-negotiable

- **One product, one hierarchy.** Mobile web, Android and iPhone keep identical
  information hierarchy, block order, key sizes, action order and touch
  semantics. Only engine, system permissions/insets and OS APIs may differ; a
  platform difference is never an excuse for a different UX. Desktop may add
  hover-only affordances. iPadOS is out of scope for v1.
- **Tokens, not hex.** Themed surfaces use `useThemedColors()`; on native
  `DESIGN_TOKENS.colors.*` is a static light fallback, not a live theme.
- **Existing primitives.** `components/ui`, `ImageCardMedia` (contain + blur),
  `UnifiedTravelCard`, shared map/place cards. No local duplicate substitutes.
- **Photo dominance** on content cards; header ≤20% of the mobile viewport;
  static frost instead of live `backdrop-blur` on mobile.

## iPhone-specific axes

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
  the required iPhone display sizes, showing the shipped UI without mock data,
  placeholder text or personal data. Keep captures in ignored folders.
- Raster icon/art generation follows the project icon-art pipeline; UI glyphs
  stay vector/icon-font, never emoji.

## Workflow

1. Fix the route set and the scenarios/locales in scope.
2. Capture the scenario on the iPhone layer required by the iOS-specific task
   (simulator for layout, physical iPhone for safe-area/permission/keyboard
   reality). Add mobile-web or Android comparison only when the assigned task
   explicitly owns a cross-platform parity investigation.
3. Build a consistency matrix: axis × surface, with screenshot evidence for each
   deviation. Classify P1 blocking/broken, P2 visible drift, P3 polish.
4. Trace each confirmed symptom to code and to the token/component that should
   own it. Do not report taste preferences as defects.
5. In audit mode return findings only. When fixes are requested, keep them in
   task-owned styling scope, prefer a platform file over a shared-code rewrite,
   and never regress web — then re-capture evidence.

## Boundaries

- Do not change `app.json`, `eas.json`, `plugins/**` or `scripts/**` unless the
  assigned task explicitly puts that configuration in scope; asset/icon config
  changes go through `$metravel-ios-developer`.
- Do not touch backend, Apple portal, TestFlight or App Store state.
- Do not claim device behavior from a simulator screenshot.

## Output

Consistency matrix, ordered findings with evidence and likely owner files, the
surfaces actually captured, fixes applied (if any), and a clear pass/fail
verdict for HIG compliance and mobile parity.
