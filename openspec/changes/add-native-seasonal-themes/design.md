## Context

See `proposal.md` for the request. Source evidence:

- `components/screens/settings/SettingsScreen.tsx:159` creates an empty native seasonal options list; `:377` hides the card.
- `components/layout/SeasonalThemeToggle.tsx:31` and `SeasonalThemeStatus.tsx:19` return null on native.
- `hooks/useTheme.ts:85–96` and `:113–116` already restore/write both preferences through AsyncStorage.
- `hooks/useTheme.ts:334–336` ignores season when resolving colors; `constants/designSystem.ts:103–113` uses literal native colors versus web CSS variables.
- Calendar refresh in `hooks/useTheme.ts:199` excludes native.
- `docs/features/seasonal-theme.md:9–14` explicitly describes the current web-only visual contract.

This is a platform-contract extension, not just removing an obsolete condition. Apply is authorized by the owner on 13.10.2026. Ownership: theme_engine — palette/provider/core tests; theme_ui — existing controls/header/static motifs/UI tests; root — launch readiness, theme docs, integration and validation; workflow_rules — the separately requested proposal-to-apply policy correction. Existing unrelated main-checkout edits must be preserved.

## Goals / Non-Goals

**Goals:** reuse one preference/calendar/UI contract; make native theme choices visibly effective; mechanically prevent palette drift between CSS and native; preserve platform-safe rendering and startup.

**Non-Goals:** global mutation of static design tokens; replacing the app theme provider or menu hierarchy; new themes, backend persistence or changes to auth/navigation/SEO/release configs.

## Decisions

### 1. Palette resolution at the existing design-system boundary

Add a typed five-theme × light/dark palette table (proposed `constants/seasonalThemePalettes.ts`) matching the existing seasonal CSS colors. Extend the existing color resolver with an optional active season; pass it from `useThemedColors` and include season in memo dependencies. Web continues to emit live CSS variables; native receives resolved literal colors. Derive alpha variants, aliases and native gradients from the chosen values. Preserve success/warning/danger semantics and existing no-season callers.

Use a parity test against seasonal CSS blocks to reject missing themes, mismatched colors and drift, rather than hand-maintained unrelated Android/iOS tables. Retain existing CSS boot and decorative data-URIs; no runtime CSS parsing or new dependency.

Rejected alternatives: only exposing options produces a nonfunctional control; mutating static `DESIGN_TOKENS` breaks import-time styles and React updates; separate Android/iOS theme contexts duplicate state and calendar logic.

### 2. Reuse the existing controls and storage

Remove native exclusions from settings, `SeasonalThemeToggle` and `SeasonalThemeStatus` only after native colors/decor work. Keep `ThemeSection`, `ThemeOptionGroup`, `RadioPressable` and localized option registry. Guest access remains through existing header menus; authenticated settings retain their access contract.

Keep preference keys/enum values. Track whether each preference has been explicitly changed while async restore is pending, so an old read cannot overwrite a new selection. Guard unmount and rejected storage operations. Use the existing native startup boundary for hydration; if necessary defer the themed shell until reading settles, without blanking web SSR or changing boot attributes. Validate its integration before choosing the exact readiness plumbing.

### 3. One date-refresh algorithm with platform lifecycle subscriptions

Retain the civil-midnight calculation from `utils/seasonalThemeClock.ts`. Web keeps focus/visibility/pageshow; native subscribes to AppState foreground transitions and refreshes/rearms one midnight timer. Recompute on foreground including time-zone changes; clear timers/listeners on cleanup and suspend the native timer while backgrounded. Manual/off remain explicit overrides.

### 4. Static native header decoration

Use existing `react-native-svg` for a small, shared native `SeasonalThemeDecoration.native.tsx`; web counterpart returns null because existing CSS owns web decoration. Integrate inside the existing `CustomHeader` brand row (`components/layout/CustomHeader.tsx:157`) with absolute layout, pointerEvents none and accessibility-hidden semantics. Five motifs mirror mobile web: branches, Easter eggs, copper leaves, moon/lanterns, evergreen/gold lights. Keep bird/logo, row height, content/safe-area geometry and all 44dp targets. Read scene colors from the theme registry, not per-screen literals. No animation, fetch or overlay over article/map content.

### Affected paths and consumers

Implementation scope: `constants/designSystem.ts`, new palette module, `hooks/useTheme.ts`, three existing seasonal controls/settings, native/web decoration pair, `CustomHeader.tsx`; app/_layout.tsx, stores/launchReadinessStore.ts and launch readiness tests: the existing launch gate declares a theme condition, the themed shell waits for themeReady and retains the shared failsafe. Existing `useThemedColors` consumers (settings, Paper provider, navigation surfaces, header, articles, map chrome) receive the resolved palette. Audit direct/static palette consumers in these visible surfaces; repair only necessary seasonal-contract leaks, never broaden to unrelated refactors. Update base/seasonal theme docs and targeted tests.

### Other contracts

API/data: local enums only, no migration, backend edits or API writes. Localization: existing RU/BE/UK/PL/EN labels and `i18n/format`; no new prose. Accessibility: selected radio, focus, ≥44dp targets, ≥4.5:1 normal text, decorative SVG excluded from accessibility tree. Security: validate stored values, no secrets, links, auth or WebView changes. SEO: unchanged routes/canonical/metadata/SSG/robots/sitemap; regression-check web first frame/print. Analytics: retain current events. Performance: no added external requests/polling/animation; static bounded SVG and one active native timer. No slider/hero geometry changes.

## Risks / Trade-offs

- [Duplicated JS/CSS palette] → typed coverage and parity tests; colors remain centralized at the design-system boundary.
- [Static token consumers do not update] → audit representative visible consumers and add regression checks for actual themed surfaces; do not mutate globals.
- [Async restore flashes or overwrites taps] → deterministic storage-delay tests, startup readiness and native restart evidence.
- [Decor changes geometry or contrast] → absolute bounded layer, scene/text composition contrast checks and screenshots on both platforms.
- [Shared regressions] → preserve no-season resolver and web boot tests; independent full-diff review before runtime QA.

## Migration Plan

No storage migration. Apply follows the existing owner implementation request; repeat confirmation is not required. Existing choices become effective on native after the new app version is installed. Rollback: revert only task-owned source changes, preserving keys and preferences; native returns to its previous ordinary appearance. Store build/upload/submit/release remain separately authorized operations; no production or board state is mutated by this plan.

## Validation matrix

| Surface | Code-level validation | Testing after review |
| --- | --- | --- |
| Shared | Palette coverage/CSS parity/alpha aliases/contrast, auto/off/manual, slow/error restore, lifecycle/DST/cleanup, i18n | Neighbor settings/header/Paper/navigation/article/map chrome smoke |
| Desktop web | Existing useTheme, boot script, seasonal/base CSS and radio tests | 1440px light/dark, seven choices, first frame, keyboard, print, screenshots and console |
| Mobile web | Same shared tests; no geometry changes | 390px light/dark, wrapped labels/menu, touch targets, screenshots and console |
| Android | Platform-specific palette, storage and AppState tests | Local USB build/install after review and operation gate; seven choices, guest/auth, restart, foreground, screenshots/logcat |
| iPhone | Same native cases parameterized iOS | Simulator seven choices/light/dark, restart/background, safe areas, screenshots/runtime errors |
| iPad | Shared/native cases | Simulator portrait/landscape and resizable window: header/decor/labels within viewport |
| RU/BE/UK/PL/EN | `npm run test:i18n`, existing option/date labels | Native localized settings/menu/status; longest labels on narrow width |

Backend-dependent runtime probes use the synchronized local backend and owned test account; offline appearance also receives a direct no-network test. Hardware-specific features are not changed, so physical iPhone/TestFlight is not required for source acceptance. Uploaded store versions require their separate release gates.
