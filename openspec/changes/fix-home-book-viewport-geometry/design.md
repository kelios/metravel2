## Context

See proposal.md and board #2405. `HomeHero.tsx:177–181` calculates bookHeight from width and a viewport-height snapshot, but the memo depends only on wrapper width. `useHomeViewport.ts:29` already provides reactive height. `homeHeroStyles.ts:45–55` enlarges typography by viewport width; `:76–107` uses percentage top/bottom padding which CSS resolves against width. `shellStyles.ts:67/75/155/159/180/187` caps and clips nested book/page frames. At 2560×640 only 125.61px remains in the left frame. `ssg-skeletons.js:254` separately fixes 1200px/max-height and narrower typography; its model also diverges at wide sizes.

## Goals / Non-Goals

Share actual page capacity between shell/typography/controls/static frame. Preserve artwork, photo ratio, controls and mobile/tablet branch. No hidden search/CTA, viewport-only font growth or overflow outside the paper.

## Decisions

1. Extract focused book geometry constants/resolver, importable by runtime and SSG tooling without React/i18n. Preserve width caps (1200/1360/1520) and artwork ratio 1040:765, but compute a positive book height from reactive viewport height and declared shell/chrome reserve. Use the existing viewport hook rather than another resize listener. The layout measurement of wrapper width refines the estimate; height changes are a memo dependency. Consolidate duplicated 180px reserve and compact thresholds.
2. Define paper top/bottom insets from book height, never percentage padding resolving against width. Horizontal inset remains tied to page width/artwork. Derive usable frame height as bookHeight minus vertical insets; fonts/line heights/gaps use bounded width-and-height constraints (minimum readable title 24px and description 12px). Do not reduce controls below 44px or shorten translations. Remove conflicting independent nested height calculations, keeping `minHeight:0` in constrained flex chains.
3. Make the full left-page frame a normal vertical scroll area (`overflow-y:auto`, horizontal containment) while its inner content preserves natural minimum size, order and controls. This applies gracefully when translated content exceeds capacity, including zoom, without moving title outside the scroll area or hiding mandatory elements. Native/tablet/mobile branches retain normal document flow. Keep page decorations and page number outside scrolling content. A local scroll area preserves the book on a short screen; an `overflow:visible` patch would paint outside the artwork and is rejected. An unconditional stacked desktop layout would lose the requested spread and is rejected.
4. Feed the same geometry expressions/thresholds into SSG CSS. Preserve first-frame content order and search/action dimensions; CSS calculates static viewport geometry before JS, runtime consumes equivalent values. Verify the static intro and loaded page rather than only comparing stylesheet tokens.
5. Add a versioned schematic in `docs/features/home-hero-book-viewport-mock.md` before implementation: paper inset/scroll boundaries, long-label wrapping, focus target and healthy/short book cases. This is geometry design evidence, not new imagery.

## Risks / Trade-offs

- [Nested scroll behavior] → scroll only the whole left content, preserve wheel/touch/keyboard and allow surrounding page scrolling at boundaries; focus scrolls actions into view.
- [Extreme short height] → retain positive minimum frame capacity and ordinary page scrolling for the book as necessary; never shrink actions or content to zero.
- [Height-only resize and observer feedback] → use the existing viewport snapshot, stabilize only wrapper width, no content-size-driven resize loop.
- [SSG mismatch] → common leaf model plus measured cold-start bounds before/after hydration.
- [Wide/long translated titles] → bound typography by usable height and test all current locales; scroll remains the safety mechanism, not text removal.

## Compatibility and Recovery

Keep `HeroStyleParams`, callbacks, loading states and media sources intact; any new derived context values are internal. No backend/config/storage migration. Revert the runtime/shared-model/SSG/test block together. Preserve current semantic palettes and seasonal artistic CSS.

## Impact and Validation Matrix

| Surface | Required evidence after review in testing |
| --- | --- |
| Desktop 2048×900, 2560×640 | Title, subtitle, field, CTA fully scroll reachable; clipped area after normal reveal 0%; ordinary clicks without force, targets ≥44px |
| Controls 1440×900, 1280×900, 1279×900, mobile 390×844 | Current order/media ratio, no overlap with chrome, `scrollWidth≤clientWidth+1px`, no new horizontal scroll |
| Height-only resize 2048×900→2048×640→900 | Frame/font/scroll capacity updates without reload; all controls stay reachable |
| RU/BE/UK/PL/EN × light/dark × off/christmas | Existing copy wraps, all mandatory elements stay inside paper; screenshots and console retained |
| Cold SSG then loaded app | Same book model, content order and action dimensions; no layout switch due to divergent static geometry |

Code-level: focused geometry tests, `HomeHero.test.tsx`, `homeHeroMediaLetterbox.test.ts`, `ssg-skeletons.test.ts`, scoped ESLint and `tsc --noEmit`. Add `e2e/home-hero-book-viewport.spec.ts` with clipping-ancestor intersection, ordinary reveal/scroll and real click, failing on the current 2560×640 defect. `toBeVisible()` alone is insufficient. Include `yarn verify:slider` and `yarn verify:slider-perf` under the proper operation gate because hero geometry changes; media geometry remains an invariant. Browser/production/performance evidence belongs only to testing after independent code review. No native device gate. SEO headings/metadata, security input handling, network/media bytes and analytics contracts remain unchanged.
