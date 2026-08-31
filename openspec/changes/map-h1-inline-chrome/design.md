## Context

See `proposal.md` → Why for motivation, and `specs/map-page-heading/spec.md` for
the behaviour contract. This section records only the state of the map chrome
that constrains the approach.

**The web map has ten render states, and no chrome node survives all of them.**
Branching runs on three independent axes: hydration readiness, resolution of two
lazy chunks, and `isMobile = width < 768` (`hooks/map/useMapPanelState.ts:302`).

| State | Mounted chrome |
| --- | --- |
| S0 `hydrationReady === false` | `MapHydrationFallback` (`app/(tabs)/map.web.tsx:47`) — empty `View`. Static `#ssg-skeleton` on top |
| S1 hydrated, `MapScreen` chunk unresolved | `Suspense fallback={<MapPageSkeleton/>}` (`:213`). No chrome |
| S2 desktop + `mapError` | `MapScreenError` **instead of** `MapScreenShell` (`screens/tabs/MapScreen.tsx:497`). No shell, no map host, no chrome |
| S3 desktop, panel expanded | `MapScreenDesktopChrome` incl. `MapPanelHeader` (`MapScreenParts/MapScreenDesktop.tsx:201`) |
| S4 desktop, panel collapsed | **only** `collapsedPanel` (`:116`). `MapPanelHeader` absent from the DOM |
| S5 tablet 768–1279 | same chrome as S3/S4, different height reserve (120 px) plus a fixed `BottomDock` |
| S6 mobile, `MapMobileLayout` chunk unresolved | `Suspense fallback` only (`MapScreenParts/MapScreenMobile.tsx:102`) |
| S7 mobile, sheet collapsed/quarter/half | `MapMobileTopOverlay` + `MapBottomSheet` (`MapMobileLayout.tsx:790`) |
| S8 mobile, sheet `full` | `MapMobileTopOverlay` **unmounted** (`:804`) |
| S9 mobile, place card open | `MapMobileTopOverlay` **unmounted**, `MapPlaceBottomCard` instead |
| S10 `mapReady === false` | `MAP_PANEL_PLACEHOLDER` inside `MapCanvas.tsx:183` |

Two consequences drive every decision below. First, `MapPanelHeader` exists only
in S3/S5-expanded, and the mobile overlay only in S7 — neither can be the sole
home of the heading. Second, `MapMobileLayout`, `TravelListPanel` and
`ActiveFiltersBar` are `React.lazy` (`screens/tabs/mapDeferred.web.tsx:3`), so
anything placed inside them is absent for two network round-trips after
hydration, and absent forever if the chunk 404s.

**The existing handoff cannot absorb that gap.** The static heading is removed on
`hydrationReady` alone (`app/(tabs)/map.web.tsx:66`) without checking that a
runtime heading exists. That is the single mechanism standing between the page
and a zero-`<h1>` document.

**Layout facts.** The map container declares `flex: 1` with `height` and
`maxHeight` of `calc(var(--metravel-map-vh, 100svh) - <reserve>)`
(`screens/tabs/map.styles.ts:42,51`); reserves are 56 (mobile), 120 (tablet),
88 (desktop, `WEB_HEADER_RESERVED_HEIGHT`). Because the current heading declares
`flexShrink: 0` (`app/(tabs)/map.web.tsx:20`), that `calc` behaves as a ceiling
and the band is subtracted from the map rather than added to the page.

**Reusable material already in the repository.** `radiusPill`
(`screens/tabs/map.styles.ts:587`) and `locationQualityPill` (`:617`) establish
the floating-capsule pattern over the map — pill radius, hairline border, soft
shadow. `DESIGN_TOKENS.typography.scale` (`constants/designSystem.ts:347`)
supplies `h3` 17/22/-0.2/700 and `bodyStrong` 15/22/0/700. `getMapSeoTitle()`
(`constants/mapSeo.ts:3`) already supplies the localized string.

## Goals / Non-Goals

**Goals:**

- Make the one-visible-heading invariant structural rather than timing-dependent,
  so that a future move of the heading into any part of the chrome cannot
  silently produce a zero-heading document.
- Give the heading a home in each chrome layout that reads as part of that
  layout, using the panel header on desktop and the established over-map capsule
  pattern elsewhere.
- Return the vertical space the band takes from the map, on every web width.

**Non-Goals:**

- Redesigning the panel header, the mobile overlay or the map controls. The
  heading is inserted into them; their existing composition is untouched.
- Changing the height reserves (`WEB_HEADER_RESERVED_HEIGHT`,
  `WEB_MOBILE_FOOTER_RESERVE_HEIGHT`) or the shell constants that mirror them.
  `__tests__/scripts/ssg-skeletons.test.ts:603` couples the two; leaving both
  alone keeps that coupling intact.
- Any edit under `scripts/`. See "Deferred: shell realignment".

## Decisions

### D1. One heading component, two anchors, one mounted at a time

`MapPageHeading` takes `anchor: 'panel-head' | 'map-corner'` and is rendered from
two mutually exclusive call sites selected by a single predicate:
`anchor === 'panel-head'` iff `!isMobile && !isDesktopCollapsed`.

*Why:* the anchors live in different subtrees (`MapPanelHeader` vs. the shell),
so a single JSX position cannot serve both. Two call sites governed by one
boolean are safe because React unmounts the old node and mounts the new one
inside a single commit: DOM mutations within a commit are synchronous and never
yield, so no external observer can sample a document holding two headings.

*Rejected — one always-mounted capsule, no panel anchor.* Simpler, and it needs
no state plumbing, but on desktop it puts a permanent sticker over the map while
a natural, already-designed heading slot sits empty in the panel header. Desktop
is also the layout a rendering crawler sees, so it is the worst place to trade
presentation away for implementation convenience.

*Rejected — heading inside `chrome` for both cases.* `chrome` is rendered from
two different slots in `MapScreenShell` (`:90` before the map host and `:92`
after it), so the heading would unmount and remount on every breakpoint flip
even when its anchor is unchanged, and on mobile it would land inside a lazy
chunk.

### D2. Mount-driven handoff, owned by the heading

Remove the `hydrationReady`-keyed cleanup from the route. `MapPageHeading` runs a
`useLayoutEffect` on mount that removes every `h1[data-ssg-travel-h1]` from the
document, and does not restore it on unmount.

*Why:* it inverts the dependency. Today the route asserts "the runtime heading
must already exist because it is my sibling", which is true only for as long as
nobody moves it — an invariant with no enforcement. With the effect owned by the
heading, the static node survives exactly until a runtime heading exists, in
every state including S0–S2, S6 and a failed chunk load. `useLayoutEffect` (not
`useEffect`) keeps the removal in the same commit as the insertion, so the
"exactly one" window is never observable.

*Why not restore on unmount:* the only unmounts are anchor switches, which
re-mount within the same commit, and full route teardown, where the document is
being replaced anyway. Restoring would reintroduce a two-heading window.

*Rejected — `MutationObserver` waiting for the runtime heading.* Equivalent
outcome, one more moving part, and it observes asynchronously, which reopens the
very window the layout effect closes.

### D3. Heading in the desktop error branch

`MapScreenError` (S2) replaces `MapScreenShell` entirely, so neither anchor
mounts there. Render `MapPageHeading` with `anchor="map-corner"` inside it.

*Why:* D2 alone keeps the count correct in S2 — the static heading simply
survives — but that heading is clipped to 1×1, so the error page would have a
heading that no sighted user can see, and
`e2e/map-page.spec.ts:770` requires `toBeVisible`. The cost is one line.

### D4. Anchor placement, typography and geometry

**`panel-head`** — a heading row inside `tabsContainer`
(`screens/tabs/map.styles.ts:185`), above the tab segment, sharing the panel
surface and its single hairline bottom border.

- `DESIGN_TOKENS.typography.scale.h3` (17/22/-0.2/700), `colors.text`.
  `h1` scale (24/30) is rejected: in a 320–360 px column the 49-character title
  takes three lines and ~90 px, which recreates the band rotated 90°.
- Left-aligned on the same edge as the tab row. Centring is the defining visual
  tell of the current band.
- `paddingHorizontal: spacing.sm`, `marginBottom: spacing.xs`, no extra divider.
- Wraps freely; no `numberOfLines`, no ellipsis. The longest single word
  ("достопримечательностей") is ~198 px at 17 px, so a 320 px column cannot
  overflow horizontally in any supported locale.
- The panel grows ~64 px in its own column. The map is a sibling column, so its
  height is unaffected — this is the whole point of the anchor choice.

**`map-corner`** — absolute capsule inside the map area.

- Geometry follows `radiusPill`: `borderRadius: radii.pill`,
  `paddingVertical: spacing.xs`, `paddingHorizontal: spacing.sm`. Desktop-
  collapsed inset `spacing.md`; mobile inset `spacing.sm`, vertically aligned
  with the existing top control row with a gap of at least `spacing.xs` so no
  44 dp target loses area.
- `DESIGN_TOKENS.typography.scale.bodyStrong` (15/22/0/700), wrapping to at most
  two lines, `maxWidth` reserving room for the map controls.
- **Opaque `colors.surface` with a hairline border — not `surfaceAlpha40` plus
  `backdropFilter`.** 40 % alpha over arbitrary OSM or satellite tiles does not
  guarantee 4.5:1, and the project has already replaced live blur with a static
  frost on the mobile map for GPU reasons (`screens/tabs/map.styles.ts:196`).
- `pointerEvents: 'none'`, z-index below the map controls and above the tiles.

*Rejected — a slim heading row in a breadcrumb strip.* `/map` has no breadcrumbs
at all, so this means introducing a navigation element the screen never asked for
and replacing a 46 px full-width band with a 24–28 px full-width band. The map
keeps losing height in all four layouts.

### D5. Copy is not changed

The visible heading keeps `getMapSeoTitle()` minus the ` | Metravel` suffix.

*Why:* AGENTS.md §4 puts titles and SEO text behind a separate explicit owner
confirmation. A one-line variant ("Карта маршрутов Беларуси", 24 characters)
would let the capsule hold one line at 320 px and would read better there; it is
recorded here as an **option for the owner**, not as part of this change. If the
owner declines it, the capsule wraps to two lines, which is why D4 specifies
wrapping rather than truncation.

*Constraint if the option is ever taken:* the same visible string must be used in
both anchors. A long heading in the panel and a short one in the capsule would
mean two different visible headings on one route, which is worse than either.

### D6. Placement relative to the #217 map-node contract

`MapScreenShell` guarantees the map node is rendered once at a fixed tree
position and is never re-parented across a breakpoint flip (`:12-27, 87-93`).

Safe hosts, all used by this design: a fixed slot inside `MapScreenShell` for the
`map-corner` anchor, and `MapPanelHeader` for `panel-head`. Adding a slot shifts
the map host's sibling index once at authoring time, not per flip, so Leaflet is
not remounted.

Forbidden and not used: any wrapper of the form
`<View><h1/>{mapComponent}</View>`, which re-parents the Leaflet node and forces
a full tile reload.

*Follow-up noted, not fixed here:* `MapScreenShell:47` dispatches
`metravel:map-layout-invalidate` only when `isMobile` changes, and the
`ResizeObserver` in `components/MapPage/Map/useMapWebLayoutEffects.ts:43` watches
width only. Neither anchor changes the map container's height, so this design
does not depend on it — but a future heading whose height affects the map area
would need a height signal too.

## Risks / Trade-offs

- **The anchor switch is sampled mid-transition and reports two headings.** →
  One component, one boolean, single-commit swap (D1). Add a Jest assertion that
  counts `document.querySelectorAll('h1')` immediately after a rerender across
  the predicate, not only after `waitFor`.
- **The heading is later moved into a lazy chunk and the invariant silently
  regresses.** → D2 makes the static heading survive until a runtime heading
  mounts, so the failure mode becomes "two headings for a frame" rather than
  "zero headings forever". Add a test that mounts the route with the map screen
  unresolved and asserts one heading.
- **`e2e/map-mobile-panel-content.spec.ts:232` is red before the change and its
  result is misread as caused by this work.** → Run it and record the result
  **before** editing anything. It asserts `|sheet bottom − dock top| ≤ 2`, was
  written 2026-07-16, and the band shipped 2026-08-30; the model predicts it is
  already failing by ~10 px. Capturing the before-state converts the arithmetic
  in `proposal.md` into a measurement.
- **Absolute Y coordinates in map e2e shift when the band disappears.** →
  `e2e/map-mobile-route-toolbar.spec.ts:238,304` uses `boundingBox` assertions
  that move by the band height. Expected and intended; update them with the
  measured values rather than loosening the tolerances.
- **The capsule steals taps from markers.** → `pointerEvents: 'none'` is
  mandatory, verified by an interaction check over the capsule's rect, not by
  code reading. The project has a prior incident of an overlay swallowing map
  touches.
- **The shell keeps drawing the sidebar on the wrong side, so the heading jumps
  across the screen at handoff.** → Accepted for this change; see below.

## Deferred: shell realignment (needs owner authorization)

`scripts/ssg-skeletons.js` places `.ssg-map-canvas` first and
`.ssg-map-sidebar-shell` second in a flex row with `border-left` (`:240`,
markup `:638` and `:667`), i.e. the pre-hydration sidebar is on the **right**,
while `MapScreenShell` renders chrome before the map host, i.e. the runtime panel
is on the **left**. The mismatch predates this change and is invisible today
because the heading is centred; after `panel-head` ships, the heading moves
across the viewport at the hydration handoff.

The fix is confined to `scripts/ssg-skeletons.js`: move the sidebar into the left
column and restyle `.ssg-map-panel-title` from 28/1.15/700 to the same `h3` step.
`scripts/` is a protected path under AGENTS.md §3 and requires a separate
explicit owner request, exactly like the `/quests` half of #1640. This change is
correct and shippable without it; the shell mismatch is not introduced here and
is not made worse in kind.

**Explicitly out of bounds even with that authorization:** promoting
`.ssg-map-panel-title` from `<div>` to `<h1>`. The raw HTML already carries one
injected `h1[data-ssg-travel-h1]` (`scripts/generate-seo-pages.js:1544`, config
`:3067`), and a second would fail `page.h1.count` in
`scripts/post-deploy-seo-check.js:482`. Making the shell heading semantic would
require replacing the injected node, not adding to it — a separate change.

## Validation matrix

| Surface / locale | Check | Where |
| --- | --- | --- |
| desktop web ≥1280 | one visible `<h1>` in panel header; map height `= V − 88`; heading rect not full-width, not centred | browser, `testing` |
| tablet web 768–1279 | one visible `<h1>`; map bottom edge meets dock top | browser + `e2e/map-mobile-panel-content.spec.ts` |
| mobile web <768 | one visible `<h1>` in capsule; page height `= V − 56`; no horizontal overflow; tap over capsule reaches the map | browser, `testing` |
| desktop, panel collapsed | anchor switches to capsule; still exactly one `<h1>` | browser, `testing` |
| desktop, `mapError` | one visible `<h1>` on the error screen | Jest + browser |
| raw HTML | exactly one `<h1>` on `/map`, unchanged text | `curl -A Googlebot`, `npm run test:seo:prod` |
| RU/BE/UK/PL/EN | heading text complete, wraps, never truncated | `npm run test:i18n` + narrow-viewport browser pass |
| Android / iPhone | not applicable — `<h1>` is web-only; native route re-exports the screen without it | — |
| backend | not applicable — no API, data or backend dependency | — |
