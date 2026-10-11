## Context

See proposal.md for scope and specs/holiday-{calendar,appearance}/spec.md for observable requirements.

Evidence: `constants/seasonalThemes.ts:47–61` defines two fixed annual windows; `:79` selects the first match. `hooks/useTheme.ts:184–201` holds the date but refreshes only on visibility. `utils/seasonalThemeBootScript.ts:10–27` serializes fixed windows and duplicates selection in ES5. `__tests__/constants/seasonalThemes.test.ts:15` tests only days 1–28. These observations concern source behavior; no new runtime acceptance is claimed.

Existing visual mechanism (`app/global.css:1047–1097`) already has canopy/header/edge/logo variables. Reuse it and `SeasonalThemeToggle`, `ThemeOptionGroup`, `getSeasonalThemeOptions`, `ThemeSection`, `useTheme`, locale date helpers and typed Feather icons. Independent design/architecture review by seasonal_design supports this direction.

## Goals / Non-Goals

**Goals:** one calendar contract for first-frame/runtime/status, predictable local-date transitions, richer static visuals and three new themes with a small frontend-only diff.

**Non-Goals:** a general holiday CMS or recurrence engine, network date lookups, geo/religion inference, native palettes, forced migration of manual preferences. Other boundaries are in proposal.

## Decisions

### Registry and calendar core

Extend the registry with discriminated `fixedAnnual` and `easterRelative` rules, explicit priority and all five IDs. Spring/autumn priorities 10, Halloween/Christmas 20, Easter 30. A theme can contain two Easter rules, using Western Gregorian and Orthodox Julian calculations converted to civil Gregorian dates. Select the highest priority; reject ambiguous equal-priority overlaps between different IDs in registry verification. Merge overlapping/adjacent ranges within one theme; retain disjoint ranges for status and next-period calculations. Compare date-only civil values without interpreting localized strings or using UTC dates as visitor dates.

Add one narrowly scoped, pure, self-contained calendar core (candidate `utils/seasonalCalendarCore.ts`) taking serializable rules and explicit civil date values. It returns active ID and resolved annual windows; the registry adapter remains in `constants/seasonalThemes.ts`. The core must contain all required calculations and no imported closure dependencies, DOM, storage, locale, network or runtime eval. Its emitted self-contained function is embedded by the existing boot-script builder with serialized registry data. Use ES5-compatible constructs in the emitted boot payload and test the actual generated script, not a substitute mock. Ensure type-only annotations/transpilation do not introduce external helpers; an isolated VM execution is the acceptance gate for serialization.

For current/upcoming status resolve previous/current/next-year windows so January Christmas and next-year upcoming periods are correct. Easter behavior is computed annually rather than using a finite date table. Validate representative known dates and complete daily selection parity for 2000–2099, plus 2100 Gregorian/Julian conversion regression. Western/Orthodox methods are documented by [dateutil](https://dateutil.readthedocs.io/en/2.8.2/easter.html); Western observance reference: [US Naval Observatory](https://aa.usno.navy.mil/data/christian_observances). Do not copy dependency code or install dateutil in the app; these are references for independent fixtures and algorithm verification.

Rejected: annual handwritten Easter date tables (expire), duplicate calendar algorithms in boot/runtime (diverge), language-dependent holiday choice (language is not religion), array-order priority (hidden behavior).

### Local midnight lifecycle

Keep `useTheme` as owner of preferences and active appearance. Keep midnight delay in a tiny pure `utils/seasonalThemeClock.ts` helper, with independent process timezone tests for Warsaw/New York/UTC. On web, arm a single timeout for the next local midnight using `new Date(year, month, day + 1)` rather than adding 86400000ms. On timeout recompute from a fresh Date and rearm. Focus, visible `visibilitychange` and `pageshow` also recompute/rearm, covering browser throttling/suspension/BFCache. Clean up timeout and listeners on unmount; do not add timers to native. Preference auto/off/manual remains independent of date refresh. Recompute derived status together with the active theme.

Rejected: minute/second polling (ongoing wakeups), fixed 24-hour timeout (DST errors), visibility-only update (current gap).

### Controls and localized status

Reuse the existing radio options for auto/off/five IDs (seven choices); add copy keys in the five static locale resources and Feather sun/gift/feather for spring/Easter/autumn unless existing glyph validation requires another valid name. Keep functional navigation icons unchanged. Add compact automatic status beneath the seasonal group; settings consume the same calendar status/copy instead of separate date calculations. Use `i18n/format.ts` to format actual current/next ranges, with year when necessary. Do not imply one continuous Easter period when windows are disjoint. Ensure wrapped labels and vertically scrollable mobile menu reveal all options. Auto never overwrites manual/off storage, including pre-existing choices.

### Visual art direction

Use existing seasonal tokens; no new image generation is needed. Keep a maximum 160px upper-edge glow (100px mobile), current header geometry and unchanged bird sources/preload/32px/26px frame. Compose SVG canopy at modest density, with the brightest points away from navigation labels and controls. Tiny logo emblem plus halo remains secondary to recognizable bird. Retain pointer-events:none, no animation/filter blur loops and print suppression.

| Theme | Palette and motifs | Logo accent |
| --- | --- | --- |
| Spring | Cream/pale rose day, muted garden night; flowering sprigs, soft green/rose upper glow | Small blossom/petal with soft halo |
| Easter | Warm pastel day, deep blue/teal night; small decorated eggs and flowering branches | Small egg/flower accent |
| Autumn | Warm parchment day, copper/brown night; leaf clusters and amber points of light | Copper leaf |
| Halloween | Lavender parchment day, plum night; clearer crescent/star groups and amber lanterns | Crescent and warm halo |
| Christmas | Ivory day, evergreen night; fuller fir swags, warm bulbs, red/gold ornaments | Star and gold halo |

Keep successful/error semantic colors meaningful; seasonal wordmark accents remain local. Adjust only the theme tokens, not card/page layout or article imagery. Normal text contrast >=4.5:1, large text/icons/focus >=3:1; no decorative layer should reduce that contrast. Richer detail is concentrated above content, without full-screen tiled assets or flying objects.

## Ownership and contracts

Implementation-owned candidates: `constants/seasonalThemes.ts`, new `utils/seasonalCalendarCore.ts`, `utils/seasonalThemeBootScript.ts`, `utils/seasonalThemeClock.ts`, `hooks/useTheme.ts`, `app/global.css`, `components/layout/{SeasonalThemeToggle,seasonalThemeOptions}.tsx`, `components/layout/SeasonalThemeStatus.tsx`, existing settings integration in `components/screens/settings/SettingsScreen.tsx` / settings components only as needed for status, `i18n/locales/{ru,be,uk,pl,en}/static/navigation_static.ts`, `utils/questThemes.ts` adapter to the same calendar (existing quest IDs unchanged), targeted calendar/boot/provider/clock/status/CSS/options/quest tests and `docs/features/seasonal-theme.md`.

`data-season` and `seasonal-theme` key remain unchanged; add spring/easter/autumn values. No API/backend/auth contract, route/canonical/SSG content, analytics event or external-link changes. Boot derives live year on the client, never the build year. Unknown IDs follow auto; unavailable storage is caught. A stale pre-update client seeing a new ID may fall back to auto, not crash; no destructive preference migration.

## Risks / Trade-offs

- [Julian/Gregorian date conversion and leap years] → independently sourced fixtures, civil-date arithmetic and 2100 regression; avoid hardcoded +13 days.
- [Boot serialization/transpiler helpers] → self-contained core and actual generated-script VM tests in isolation; no duplicated fallback algorithm.
- [Clock changes/DST/browser sleep] → next local midnight, fresh-Date lifecycle recompute; normal visible-tab limit two seconds does not claim execution while suspended.
- [Menu overflow in PL/long dates] → wrapped labels/status and 390px keyboard/touch browser evidence for all locales.
- [Decor reduces contrast] → bounded motif placement and screenshot/contrast validation in both schemes.
- [Bundle/resource growth] → no additional requests, no raster art or calendar dependencies, one timer, bounded SVG layers; compare header dimensions and request behavior with existing production design.

## Validation Matrix

| Surface/scope | Required proof |
| --- | --- |
| Pure calendar | Inclusive start/end±1; full real dates including 29–31, leap years, cross-year Christmas; both Easter traditions coincident/disjoint; priority stable under reordered registry; next/current ranges |
| Generated boot vs runtime | Daily parity 2000–2099 and selected 2100 dates; every manual ID/auto/off/invalid; blocked storage; first-frame attribute parity |
| Web lifecycle | Fake clock visible midnight starts/ends; focus/visibility/pageshow catch-up; 23h/25h day and cleanup; manual/off unchanged |
| RU/BE/UK/PL/EN | Static keys, test:i18n, labels/date formatting/status for current/next and separate Easter windows |
| Desktop/mobile testing | Widths 1440/1280/1279/767/390; all themes light/dark; logo/menu/settings; no overflow/console errors; screenshots, keyboard/focus, print/reduced-motion, no new seasonal network requests |
| Adjacent consumers | Guest/account/mobile/settings agree; theme auto vs dark/light unaffected; travel text/map controls unobstructed |
| Native | Source boundary/typechecks prove no native timer or seasonal UI; no device gate because platform behavior unchanged |

Before runtime testing: focused calendar/boot/provider/options/CSS Jest, scoped ESLint, TypeScript noEmit, web-style/i18n checks, independent review-auditor then code-review-gate. Runtime testing begins only after review. Required production pipeline then follows existing AGENTS operation gates when apply is requested; planning itself performs no deploy.

## Migration Plan

No data migration. Ship registry/calendar/boot/visual/copy together after review. Existing IDs and storage key remain valid. Roll back the frontend task commit and its assets through the canonical release process if date or legibility acceptance fails; retain preferences and existing content. New IDs on an old version safely resolve through its existing unknown-value auto fallback. All implementation and release operations remain deferred to the separate apply request.
