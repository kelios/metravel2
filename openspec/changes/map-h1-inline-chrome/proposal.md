## Why

Task #1640 required "exactly one *visible* `<h1>`" on `/map`. The implementation
that shipped in `c9bb1b6e3` (2026-08-30) satisfied the count but broke the
second half of its own stated requirement — "`/map`: раскрыть существующий
видимый H1 **без побочных изменений layout**". The acceptance pass on
2026-08-31 measured only the node (`1265×46`) and never checked the layout
footprint, so the card was recorded as closed for `/map` while the regression
stands in production.

What shipped is a full-bleed band above the map: an in-flow `<h1>` with
`width: 100%`, `textAlign: center` and `backgroundColor: colors.surface`
(`app/(tabs)/map.web.tsx:14`, rendered at `:208`). Three separate defects follow
from it:

1. **It eats map height, it does not merely sit above it.** The heading declares
   `flexShrink: 0` while the map container declares `flex: 1`
   (`screens/tabs/map.styles.ts:42`), so `height: calc(var(--metravel-map-vh,
   100svh) - <reserve>)` (`:51`) acts as a *ceiling* rather than the actual
   height. The band takes 36 px of map on ≥1280 and pushes the bottom 46 px of
   the map under the fixed bottom dock on 768–1279.

2. **On mobile it is worse than measured.** At 24 px the 49-character title does
   not fit one line below roughly 600 px width, so the band is ~76 px, not 46 px.
   The site header returns `null` below 768 px (`app/(tabs)/_layout.tsx:146`),
   which makes that band the entire top of a phone screen, and the page overflows
   its own viewport reserve by ~20 px.

3. **It contradicts the pre-hydration shell.** `scripts/ssg-skeletons.js` draws
   no heading row at all and reserves the same 88 px, so the top edge of the map
   jumps 56 → 124 px at the hydration handoff on desktop.

Separately, the mechanism that guarantees the invariant is timing-dependent
rather than structural. The static `h1[data-ssg-travel-h1]` is removed on
`hydrationReady` alone (`app/(tabs)/map.web.tsx:66`), without waiting for the
runtime heading to exist. Today that is safe only because the runtime heading
sits in the route file itself; it silently forbids ever moving the heading into
any lazily loaded part of the map chrome, and hides a real hazard — if the
runtime heading fails to mount, the page ends with zero `<h1>`.

## What Changes

- Remove the full-bleed heading band from `/map`: delete `getMapPageTitleStyle`
  and the in-flow `<h1>` from `app/(tabs)/map.web.tsx`. The map reclaims the
  vertical space on every web width.
- Introduce a single `MapPageHeading` component that renders the page `<h1>` in
  one of two anchors inside the existing map chrome, selected by the same state
  that already selects the chrome:
  - `panel-head` — a heading line in the left panel header above the tab row,
    used on desktop web while the panel is expanded;
  - `map-corner` — an opaque, non-interactive capsule pinned inside the map
    area, used when the desktop panel is collapsed and on mobile web.
  Exactly one anchor is mounted at a time, and the switch happens inside a
  single React commit, so no observable DOM state contains two `<h1>` nodes.
- **Change the SSG→runtime heading handoff from time-driven to mount-driven.**
  The static `h1[data-ssg-travel-h1]` is removed by a layout effect owned by
  `MapPageHeading` at the moment the runtime heading mounts, instead of by a
  route-level effect keyed on `hydrationReady`. This keeps exactly one `<h1>`
  in the document across the hydration gap, the lazy-chunk gap, the desktop
  error state and a failed chunk load.
- Render the heading in the desktop error screen (`MapScreenError`) so the
  `mapError` branch, which replaces `MapScreenShell` entirely, still presents a
  visible page heading.
- Update the tests that pin the current band geometry
  (`__tests__/app/map-screen.web.test.tsx:147-152` assert `fontSize: 24px`,
  `lineHeight: 30px`, `paddingTop: 8px`, `paddingRight: 16px`, `flexGrow: 0`,
  `flexBasis: auto`) and strengthen the same suite so it fails if the heading
  ever moves into a lazily loaded chunk.

**Non-goals.**

- The visible heading copy is not changed. "Карта маршрутов и
  достопримечательностей Беларуси" stays as-is; per AGENTS.md §4 a title change
  needs separate owner confirmation. The design records a shorter one-line
  variant as an option only.
- `<title>`, `meta description`, `og:*`, canonical and structured data are not
  touched. `getMapSeoTitle()` / `getMapSeoDescription()` keep their current
  values.
- `/contact` and `/articles`, which received the same band in the same commit,
  are out of scope. There the band is an ordinary content-page title, not a
  full-bleed viewport.
- The pre-hydration shell (`scripts/ssg-skeletons.js`) is **not** modified by
  this change. `scripts/` is a protected path under AGENTS.md §3 and needs a
  separate explicit owner request; the shell realignment is recorded as a
  follow-up dependency, not as work performed here.
- No `<h1>` is added to the shell. The raw HTML already carries exactly one
  injected `h1[data-ssg-travel-h1]`, and a second one would fail the
  `page.h1.count` gate in `scripts/post-deploy-seo-check.js`.

**Dependencies.** None blocking. The shell-side realignment described in
`design.md` requires a separate owner authorization for `scripts/` before it can
be scheduled; this change is correct and shippable without it.

**Fallback/mock policy.** Acceptance is measured on the hydrated DOM in a real
browser and on real raw HTML (`curl -A Googlebot`). Jest assertions on inline
styles are code-level evidence only and do not substitute for the browser
measurement of the heading rect or of the map's reclaimed height.

## Capabilities

### New Capabilities
- `map-page-heading`: where the page-level `<h1>` of the map route lives in each
  render state of the web map chrome, how ownership passes from the static
  pre-hydration heading to the runtime heading, and what the heading may and may
  not cost in layout.

### Modified Capabilities
<!-- None. openspec/specs/ currently holds no published capability whose
     requirements this change alters; the map heading has no existing spec. -->

## Impact

**Affected code.**

- `app/(tabs)/map.web.tsx` — remove `getMapPageTitleStyle` (`:14`), the in-flow
  `<h1>` (`:208`) and the `hydrationReady`-keyed SSG-heading cleanup (`:66`).
- `components/MapPage/MapPageHeading.tsx` — new component, owns both anchors and
  the mount-driven handoff.
- `components/MapPage/MapPanelHeader.tsx` — host for the `panel-head` anchor.
- `components/MapPage/MapScreenParts/MapScreenShell.tsx` — host for the
  `map-corner` anchor, at a fixed slot that never re-parents the map node.
- `components/MapPage/MapScreenParts/MapScreenError.tsx` — heading in the
  desktop error branch.
- `screens/tabs/MapScreen.tsx`, `components/MapPage/MapScreenParts/MapScreenDesktop.tsx`
  — pass the anchor-selecting state through.
- `screens/tabs/map.styles.ts` — styles for both anchors.
- `__tests__/app/map-screen.web.test.tsx` — replace band-geometry assertions.

**SEO.** The raw-HTML contract is unchanged: one injected
`h1[data-ssg-travel-h1]` on `/map`. `validateCorePageH1`
(`scripts/post-deploy-seo-check.js:482`) and `h1Count: 1`
(`scripts/test-seo-prod.js:457`) stay green without modification. The hydrated
DOM keeps exactly one visible `<h1>` with unchanged text.

**Accessibility.** The heading stays a real `<h1>` and stays visible, so
`e2e/map-page.spec.ts:770` (`getByRole('heading', { level: 1 })` +
`toBeVisible`) keeps passing. The `map-corner` anchor is opaque `colors.surface`
rather than a translucent pill, so contrast does not depend on the tiles beneath
it, and it is `pointerEvents: 'none'` so it creates no dead zone over markers.

**Performance / layout.** Net positive and measurable: the map regains 36 px on
≥1280, stops running under the bottom dock on 768–1279, and stops overflowing
the viewport reserve on mobile. `e2e/map-mobile-panel-content.spec.ts:232`
(`|sheet bottom − dock top| ≤ 2`) predates the band and is expected to be red
today; it is the primary regression detector for this change and must be
recorded before and after.

**Platform impact.** desktop web + mobile web + tablet web. Android and iPhone
are unaffected: `<h1>` is a DOM/SEO concept, the native route
(`app/(tabs)/map.tsx`) re-exports the screen without it, and no shared component
gains a `.web`/`.native` layout fork.

**Localization impact.** RU/BE/UK/PL/EN, no new strings. The heading reuses the
existing key `map:constants.mapSeo.title` via `getMapSeoTitle()`, with the same
` | Metravel` suffix trim. Longer translations are handled by wrapping, not by
truncation, so no locale can lose heading text. `npm run test:i18n` applies.

**Analytics / security.** None. No events, no network calls, no user input.
