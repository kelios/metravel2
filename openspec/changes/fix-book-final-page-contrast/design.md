## Context

See proposal.md and reopened #2368. `FinalPageRenderer.ts:87–91` only detects exact white; `themes/configs/dark.ts:50` uses #f9fafb. The final page independently paints #f7eee9→#e2efec, so inheriting cover ink is the mechanism. Preview window/document CSS has no final-page opacity override. `FinalPageRenderer.ts:163–174` carries legacy dark-page screen compositing and an exceptionally bright pastel glow. This is separate from #2275 alpha-gradient printing and #2407 photo-corner nondeterminism.

## Goals / Non-Goals

Goals: independent readable final-page palette and deterministic painting for the existing postcard; conserve summary/layout/typography. Non-goals: cover or article redesign, rich-text flow, worker protocol, native export enablement and authored content changes.

## Decisions

1. Use a focused semantic postcard palette, initially primary #334155 and secondary #475569 with current pale endpoints, independent of cover.text and theme identity. Route all final heading/statistic/quote/stamp/art colors through this palette. Reuse existing final art functions and theme typography. Test measured contrast >=4.5 against every possible chosen background endpoint; do not add theme-name or white-color whitelists. Theme typography remains variable, so matrix must also prove geometry.
2. Remove inherited screen-compositing background glow and screen rule ornament; replace them with opaque pale gradient colors in a layer behind content. Gradients have only opaque stops, retaining #2275 Safari/WebKit printing invariant. One background layer and existing art remain; no heavy rasterization, canvas or new media. Avoid a font-only patch leaving white decoration/compositing inconsistent with the page.
3. Preserve existing HTML escaping, fixed page/print footer dimensions, summary source, quote text and pinned date. Only explicit final-page changes enter golden fixtures; source/parser/media fixtures do not receive blanket regeneration.

## Affected Paths and Contracts

`services/pdf-export/generators/v2/runtime/renderers/FinalPageRenderer.ts`, narrowly necessary palette leaf/finalPageArt comments, `__tests__/services/pdf-export/finalPagePrintGradients.test.ts`, focused contrast tests, intentional final portions of web/native golden books and corresponding documentation. The same final renderer serves ordinary browser books and CanonicalPageRenderer final segments; source tests cover both consumers without worker protocol changes. No API, backend, authentication, settings or data migration. Native export restriction remains.

SEO/analytics: no changes; books are not indexed and events remain. Accessibility: all informational text >=4.5:1, existing semantics/alt retained, clipping checked. Security: reuse escaping, no unsafe source insertion. Performance: bounded final HTML, no new requests/assets/bundle eager imports. No slider change, so slider performance checks are unnecessary.

## Risks / Trade-offs

- [Legacy gradient expectations] → amend the exact obsolete screen assertion while retaining alpha-free gradient coverage and actual print evidence.
- [Typography/translation overflow] → all20themes × all5locales measured final-page matrix; physical-page checks and representative printed pages. Preserve emblems flexible shrink and text/stamp minimum size.
- [Contrast over decoration] → decoration behind content, pale stops bounded by the tested background palette; actual screenshots and PDF raster validate informational areas, not only color tokens.
- [Golden debt] → targeted final deltas documented; unrelated parser/media/order fixture differences remain failures requiring diagnosis.

## Validation Matrix

| Surface/variant | Evidence after independent review in testing |
| --- | --- |
| Desktop web normal article export, light and dark site themes | Actual final preview and printed A4 page for affected article672, contrast/readability and no text clipping |
| Every20PDFthemes × RU/BE/UK/PL/EN | Final markup/contrast tests plus browser geometry for all100 combinations; one physical page, readable labels and stamp |
| Mobile web390×844 | Ordinary export action opens preview; final content remains readable and the same physical print contract holds |
| Chromium and WebKit print | No alpha gradient stops, no blend-induced white glow; retain screenshots and printed PDF evidence |
| Empty/noquote/fourstats/pinnedyear | Summary/quote/year conservation and one-page layout |

Code-level: final-page gradient/contrast tests, EnhancedPdfGenerator, bookGolden web/native, bookRendererWorker, scoped lint and typecheck under root quality coordination. Independent review-auditor then code-review-gate, explicit owned paths commit/push and production acceptance follow existing task pipeline. No browser/API runtime in review.

## Recovery

No migration. Revert the final palette/rendering/test block together to the previous source revision; preserve unrelated active train files. Planning artifacts require a separate apply request before any implementation.
