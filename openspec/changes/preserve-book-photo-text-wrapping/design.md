## Context

See proposal.md and #2410, linked to #1602/#1623 history. `ContentParser.ts:61–64,487–505` preserves img-float sides. `BlockRenderer.ts:235` formats/parses source; `renderBlocks:215` then emits unchanged paragraph→image→heading order. Float cannot affect preceding text. `htmlDocument.ts:230–253` correctly clears subsequent semantic headings. Web-only applyBackwardFloatWrap has a persisted-transform safety warning and is not a supported print integration point.

The browser HTML fallback path is `hooks/usePdfExportRuntime.ts:345` → BookHtmlExportService → `EnhancedPdfGeneratorBase.ts:332` → BlockRenderer.renderRichText. Guests use this client path directly; authenticated users first call `tryServerBookExport` and may receive a server PDF or HTML result before client generation. Acceptance must identify the actual ordinary action's route. Segmented `CanonicalPageRenderer.ts:69–89` instead inserts bounded source HTML directly and has original-source occurrence ledgers; do not change that path or its ledgers implicitly.

## Goals / Non-Goals

Goals: safe PDF display association, actual text wrapping and physical-page co-placement for ordinary browser export. Non-goals: source editing, web article flow changes without separately confirmed ownership/design, blanket heading clear removal, worker ledger or streaming protocol mutation, new backend export and final palette.

## Decisions

1. Add a focused pure typed display-flow resolver alongside BlockRenderer, consuming existing parsed blocks without mutation. Identify floated single image p/figure uniformly through existing ImageBlock layout. An orphan image lacking a following eligible paragraph may associate with the immediately preceding paragraph with at least60 visible characters, only if that paragraph is not already the forward target of an earlier float. Preserve image occurrence order, all paragraph HTML/text, links, captions, dimensions and alt; never cross semantic blocks. Forward image→paragraph remains unchanged. Test empty/interleaved/small blocks and repeated render idempotence. Reuse parser/renderer and authored side; do not call the web-only regex transform or alter applySmartImageLayout used by autosave.
2. Emit a focused display association with image before its actual wrap paragraph; preserve semantic heading order. The associated group contains its float and maintains a break opportunity before the pair. Actual ordinary article672 printing at revision983f77b8 showed that group `break-inside:auto` permits the Priluki paragraph on physical page8 while its float moves independently to page9; float keep-with-next alone is insufficient. Refine the containing group to advisory `break-inside:avoid` and `page-break-inside:avoid`, retaining `auto` on the paragraph and no fixed height, clipping or forced page boundary. A fitting pair should move together; an oversized group must retain internal text fragmentation when the print engine relaxes avoidance. This is not an unbreakable paragraph contract. Accept this refinement only after actual ordinary Priluki and near-bottom/multipage controls demonstrate co-placement and complete text continuation. Print CSS changes only these associations. Measure image+text line rectangles during actual printed pagination; a correct HTML order alone does not prove physical co-placement. The next semantic heading clears and begins after the pair, with no float leaking into the next topic.
3. Do not cap all photo heights, crop photos, replace side photos with full-width or remove all section clears to conceal gaps. Continue existing contain sizing/intrinsic ratio, current image URL processing and fallback. Unavoidable blank area beside a short paragraph and tall photo is not resolved by sacrificing section ownership; the first source-backed cases have eligible text and should show wrap-line overlap.
4. Keep the existing segmented-worker source/occurrence contract intact. Capture actual production export-path identity in testing; if ordinary affected action is routed through the segmented worker rather than the confirmed browser service, stop claiming this bounded patch fixes that route. Record the precise unsupported route and design a separately approved bounded association/ledger extension. No whole-field buffering, fabricated source order, ledger suppression or mock parity. Shared BlockRenderer consumers receive the new display flow, direct source-fragment consumers do not.

## Affected Paths and Contracts

`services/pdf-export/renderers/BlockRenderer.ts`, new narrow `renderers/blockRenderer` flow helper, `generators/v2/runtime/pdfRuntimeMarkup/htmlDocument.ts` only for association CSS, focused BlockRenderer/printPageBreaks/flow tests, intentional affected content golden deltas and PDF feature documentation. Parser/save hooks/editor formatting remain unchanged; do not increase files above800LOC (BlockRenderer currently below threshold). No backend/API/auth changes. No source writes or locale translation of editorial content. New UI copy is unnecessary.

SEO/analytics: unchanged. Security: existing rich-text sanitization, escaping and safe-image processing retained. Accessibility: alt/captions/headings and link content preserved. Performance: one linear display pass over already parsed blocks, no fetches or full-field worker reads. No native-specific effect or slider code change.

## Risks / Trade-offs

- [Paragraph theft or adjacent-float regrouping] → pure display-only data derivation, prior ownership and semantic boundary tests, source checksum before/after identical.
- [Physical image-only split] → keep-with-following-text and contained pair, measured printed line/photo geometry near page bottom. Do not pass based solely on visible DOM or order assertions.
- [Oversized paragraph] → paragraph fragmentation remains enabled; nearpage and multipage actualPDF tests prevent unbreakable overflow.
- [Worker path divergence] → explicit path identity gate and separate source conservation evidence; no worker fixed claim from legacy-only tests.
- [Snapshot churn] → only justified display-flow changes, exact text/link/media occurrence conservation and intentional fixture deltas reviewed independently.

## Validation Matrix

| Surface/variant | Evidence after review in testing |
| --- | --- |
| Desktop normal production article672export | Preview + printedPDF text/photo geometry for supplied Rakov and Priluki examples; wrapped lines overlap photo vertical range without covering it; next heading clears |
| Both left/right × p/figure × minimal/dark/illustrated | Caption/alt/image ratio maintained, source image order unchanged, no cropped or lost content |
| Pair near A4bottom and paragraph longer than a page | RealPDF retains actual wrap text with photo; text continues fully and in order; no image-only split/blank side caused by breaking association |
| Mobile web390×844 | Ordinary export reaches same preview/print path, no new app overflow |
| RU/BE/UK/PL/EN surrounding book UI | Unchanged existing labels and editorial content, no clipping of neighboring section labels |
| Forward/claimedinterleaving/gallery/list/table/fullwidth/empty/slowimageerror | Existing forward ownership and boundaries intact; fallback does not erase text/alt/caption |
| Worker source-fragment consumer | Source/read-only invariants unchanged; explicitly reported as unaffected unless independent source-backed coverage is added |

Code-level: typed helper and BlockRenderer tests, existing printPageBreaks, heading levels, image sizes/fallbacks and exact golden content deltas, focused generator/worker source-conservation tests, scoped lint/typecheck. Root coordinates quality window. Independent review-auditor followed by code-review-gate; ordinary task pipeline commits/pushes owned paths, then production deploy and actual acceptance. No runtime in review.

## Recovery

Revert flow helper/BlockRenderer/associationCSS/intentionalfixtures as one block. No data migration or saved source restoration is required because display transformation never writes source. Separate owner apply request remains required before coding.
