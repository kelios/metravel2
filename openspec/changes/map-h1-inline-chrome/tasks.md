## 1. Baseline evidence (before any edit)

- [x] 1.1 Record the current heading rect and the map-area rect on `/map` at 1440, 1024 and 390 px widths in a real browser; keep the numbers as the before-state for the geometry claims in `proposal.md`.
- [x] 1.2 Run `e2e/map-mobile-panel-content.spec.ts` unchanged and record the result verbatim. The model in `design.md` predicts it is already red by ~10 px on `|sheet bottom − dock top| ≤ 2`; a red result here is pre-existing evidence, not a regression introduced by this change. Use `E2E_NO_WEBSERVER=1` against an already-running dev server so a peer session's server is not killed.
- [x] 1.3 Record `curl -A Googlebot https://metravel.by/map | grep -c '<h1'` as the raw-HTML baseline.

## 2. Heading component

- [x] 2.1 Add `components/MapPage/MapPageHeading.tsx` exposing `anchor: 'panel-head' | 'map-corner'`, rendering a real `<h1>` on web with the text from `getMapSeoTitle()` minus the ` | Metravel` suffix.
- [x] 2.2 Implement the mount-driven handoff inside it: a `useLayoutEffect` that removes every `h1[data-ssg-travel-h1]` from the document on mount, with no restore on unmount (design D2).
- [x] 2.3 Add both anchor style sets to `screens/tabs/map.styles.ts`: `panel-head` on the `h3` token scale, left-aligned, wrapping, no ellipsis; `map-corner` on the `bodyStrong` scale, opaque `colors.surface`, hairline border, pill radius, `pointerEvents: 'none'` (design D4).
- [x] 2.4 Verify no new i18n key is introduced and the existing `map:constants.mapSeo.title` is the only source of the string.

## 3. Wire the anchors

- [x] 3.1 Render `MapPageHeading anchor="panel-head"` inside `components/MapPage/MapPanelHeader.tsx`, above the tab segment, inside the existing `tabsContainer`, guarded by `!isMobile && !isDesktopCollapsed`.
- [x] 3.2 Render `MapPageHeading anchor="map-corner"` from a fixed slot in `components/MapPage/MapScreenParts/MapScreenShell.tsx` for the complementary condition, at a position that does not re-parent the map host (design D6).
- [x] 3.3 Thread `isDesktopCollapsed` (and any other predicate input) from `screens/tabs/MapScreen.tsx` through `MapScreenParts/MapScreenDesktop.tsx` to the panel header without duplicating the predicate — one source of truth for which anchor is active.
- [x] 3.4 Render `MapPageHeading anchor="map-corner"` inside `components/MapPage/MapScreenParts/MapScreenError.tsx` so the desktop error branch keeps a visible heading (design D3).

## 4. Remove the band

- [x] 4.1 Delete `getMapPageTitleStyle` and the in-flow `<h1>` from `app/(tabs)/map.web.tsx`.
- [x] 4.2 Delete the `hydrationReady`-keyed SSG-heading cleanup effect from `app/(tabs)/map.web.tsx`; ownership now belongs to `MapPageHeading`.
- [x] 4.3 Confirm no other route or component imported `getMapPageTitleStyle`, and that `/articles` and `/contact` are untouched.

## 5. Tests

- [x] 5.1 Replace the band-geometry assertions in `__tests__/app/map-screen.web.test.tsx:147-152` with assertions on the new presentation: heading present, visible, not full-width, not centred.
- [x] 5.2 Keep and strengthen the count assertions: exactly one `<h1>` before hydration, exactly one after, and the static node gone once the runtime heading mounts.
- [x] 5.3 Add a case that renders the route with the map screen chunk unresolved and asserts exactly one `<h1>` — this is the regression guard for the lazy-chunk gap and must fail if the handoff is reverted to `hydrationReady`.
- [x] 5.4 Add a case that rerenders across the anchor predicate and counts `document.querySelectorAll('h1')` immediately after the rerender, without `waitFor`, asserting one node.
- [x] 5.5 Add a case for the `mapError` branch asserting one visible `<h1>`.
- [ ] 5.6 Update the absolute `boundingBox` expectations in `e2e/map-mobile-route-toolbar.spec.ts:238,304` with the measured post-change values; do not widen the tolerances.

## 6. Code-level validation

- [ ] 6.1 Targeted Jest on the touched suites.
- [x] 6.2 Targeted ESLint on the touched paths.
- [ ] 6.3 `npm run test:i18n`.
- [ ] 6.4 `npm run check:fast`; if a peer session holds the quality gate, record that as coordination evidence and request the result rather than reporting a pass.
- [x] 6.5 `git diff --check`.

## 7. Independent code review

- [ ] 7.1 Run `review-auditor` over the full task diff; the reviewer fixes confirmed findings, re-reads the final diff and repeats the code-level checks.
- [ ] 7.2 Run the `code-review-gate` before the ticket moves to `testing`.

## 8. Browser evidence (testing stage only)

- [x] 8.1 Desktop ≥1280: exactly one visible `<h1>` in the panel header; map area height equals `V − 88`; heading rect is neither full-width nor centred. Screenshot plus computed rects.
- [x] 8.2 Collapse the panel: anchor switches to the capsule, still exactly one visible `<h1>`, no overlap with the collapsed strip.
- [ ] 8.3 Tablet 768–1279: map bottom edge meets the dock top; re-run `e2e/map-mobile-panel-content.spec.ts` and compare with the 1.2 baseline.
- [x] 8.4 Mobile <768: exactly one visible `<h1>`; page height equals `V − 56`; no horizontal overflow; a tap over the capsule rect reaches the map rather than being swallowed.
- [ ] 8.5 Narrow-viewport pass in each of RU/BE/UK/PL/EN confirming the heading wraps and is never truncated.
- [ ] 8.6 Console clean on every viewport above.

## 9. SEO regression

- [ ] 9.1 `npm run test:seo:prod` — `/map` still reports `h1Count: 1`.
- [ ] 9.2 Re-run the 1.3 raw-HTML probe and confirm the count and text are unchanged.
- [ ] 9.3 Confirm `<title>`, meta description, canonical, robots, `og:*` and structured data on `/map` are byte-identical to the pre-change values.

## 10. Close-out

- [ ] 10.1 `openspec validate map-h1-inline-chrome --strict`.
- [ ] 10.2 Write the outcome, the measured before/after geometry and the residual risk into board task #1640 (verdict `reuse`; this change closes its unverified "без побочных изменений layout" clause for `/map`).
- [ ] 10.3 Record the deferred shell realignment (`scripts/ssg-skeletons.js`, sidebar column side and `.ssg-map-panel-title` typography) as a separate item awaiting explicit owner authorization for `scripts/`, per design "Deferred: shell realignment".
