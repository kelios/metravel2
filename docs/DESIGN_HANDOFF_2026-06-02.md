# Design handoff — round-2 audit open polish tickets

Author: UI/UX Designer · Date: 2026-06-02 · Consumers: Ромик (Dev), reviewer (Андриуш)

Scope: the three items still open after the full-page round-2 live audit (Home, Search, Travel, Map, Places). Companion evidence and ticket bodies live in `docs/AGENT_WORKBOARD.md` (sections "Full-page UI/UX QA wave — round 2", "Round-2 continuation", "Round-2 populated capture").

Routing rule: travel surfaces via `travel-expert`, map surfaces via `map-expert`, guard violations via `guard-enforcer`. After each change run `npm run check:image-architecture` + `npm run guard:external-links` + `npm run check:fast`, then the mandatory verification rule (browser screenshot + sprint sign-off + reviewer).

Already closed by this audit (no work needed): `D-001` (hero `contain`+blur confirmed live), `D-014` (map/catalog consistent on live API), `D-011` (year filter is data-driven `2026`, not hardcoded), map-popup external links (route through `openExternalUrlInNewTab`, guard green).

---

## HANDOFF-1 — D-004 / D-013: cookie banner occludes bottom content & CTAs

**Do NOT redesign the banner — the mechanism already exists.**
`components/layout/ConsentBanner.tsx` already:
- docks above the bottom tab bar + safe-area via `bottomOffset` (line 24: `insets.bottom + tabBarHeight(56) + 8`);
- publishes a CSS variable `--mt-consent-h = bottomOffset + bannerH(124 mobile / 64 desktop) + 8` (lines 84–89) so scroll containers can reserve space below the floating banner.

**Reference implementation (correct, copy this):** `components/listTravel/RightColumn.tsx` and `components/auth/LoginForm.tsx` already consume `--mt-consent-h` as bottom padding.

**Fix = apply the same var on the surfaces that currently don't (where occlusion was observed):**

| Surface | File | Observed defect |
| --- | --- | --- |
| Places empty-state + catalog list | `app/(tabs)/places.tsx`, `components/places/PlaceListCard.tsx` | `Обновить` CTA fully hidden behind banner on mobile (**D-013**, severe) |
| Travel detail sticky actions | `components/travel/details/TravelStickyActions.tsx` | bottom action toolbar partly covered (desktop + mobile) |
| Home featured weekend card | `components/home/HomeWeekendRoutesSection.tsx` | bottom of the route card covered on mobile |

Apply `paddingBottom: var(--mt-consent-h, 0px)` (web) / equivalent inset (native) to each scroll/sticky container.

**Acceptance:** with cookie consent un-set, on mobile `390x844` and desktop `1440x900`, no primary CTA or last card row is covered by the banner on `/`, `/places`, `/search`, `/travels/{slug}`; banner stays dismissable; no layout shift after accept/decline.

**Validation:** Playwright mobile screenshot per route with banner visible + `npm run check:fast`.

---

## HANDOFF-2 — D-010: touch targets below 44px

Measured <44px hit areas:

| Control | File | Measured |
| --- | --- | --- |
| Travel-card favorite / add buttons | `components/ui/UnifiedTravelCard.tsx` | ~36px |
| Home weekend-carousel prev/next arrows | `components/home/HomeWeekendRoutesSection.tsx` | 32×32 |
| Cookie accept/decline buttons | `components/layout/ConsentBanner.tsx` | ~36px |
| Shared empty-state button | `components/ui/EmptyState.tsx` | <44px tall |

**Spec:** keep the visual size; expand the *hit area* to ≥44×44 via `hitSlop` (RN) + `minWidth/minHeight: 44` on web pressables. Do not enlarge icon glyphs. Travel-detail mobile gallery arrows are already ~56px — leave them.

**Acceptance:** every interactive control on `/`, `/search`, `/travels/{slug}` cards/carousels reports a ≥44×44 hit box on touch; desktop visuals unchanged (WCAG 2.1 AA 2.5.5).

**Validation:** bounding-box assert Playwright spec (reuse the existing `sort options have adequate touch targets (min 40px)` pattern in `e2e/filters-sorting-ux.spec.ts`) + `npm run check:fast`.

---

## HANDOFF-3 — D-002 follow-up (b): map PlacePopupCard layout on small viewports

Desktop PlacePopupCard verified good (`components/MapPage/Map/createMapPopupComponent.tsx`, `components/MapPage/Map/PlacePopupCard/index.tsx`); external nav links already safe (guard green). Open question only: the title row sits close to the top controls bar — confirm it is not clipped and the card does not cover the whole map on `390x844`.

**Acceptance:** on mobile the popup title is fully visible, map controls stay reachable, and `Открыть страницу` + the nav grid are tappable (≥44px).

**Status:** mobile re-shoot pending — blocked by a concurrent CI run repeatedly wiping/rebuilding `dist/`; spec ready for `map-expert` once the repo is quiet and a populated `/map` is capturable.
