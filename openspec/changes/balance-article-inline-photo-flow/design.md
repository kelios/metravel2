## Context

See proposal.md for the observed problem. This is an article geometry change, separate from the final-page palette and PDF typed-flow plans.

Current source:

- `StableContent.web.tsx:72` prepares safe HTML, then calls the existing render-only backward wrap. `TravelDescription.tsx:318` passes fullWidth for the unboxed article.
- `webStyles/base.ts:26–41` separates a full-width body from720px narrative blocks. `floats.ts:47` still resolves inline photo width against the full-width body at min(45%,420px). `typography.ts:16–26` correctly clears headings and semantic blocks.
- `richTextImageLayout.ts:505–553` has the existing backward association and previous-float ownership guard. The canonical editor/autosave transform is separate and must remain untouched.
- Article672 canonical backup contains H3 →313-character paragraph →right photo→H2. Owner screenshot4 already shows correct backward wrap but a height imbalance. No source-stage browser geometry PASS is claimed.
- Before-code mock: `docs/features/article-inline-photo-flow-mock.md`. Existing `article-image-text-wrap-mock.md` remains normative, including valid whitespace for short text.

## Goals / Non-Goals

**Goals:** one consistent narrative measure for eligible inline photo/text groups, real CSS flow beside/below full photos, safe deterministic render association, and unchanged first-frame content preparation.

**Non-Goals:** paragraph-height matching; filling all whitespace; pulling text across headings; canonical HTML migration; PDF renderer changes; new generic rich-text engine; native rendering/configuration changes; new UI copy or media.

## Decisions

### 1. Reuse the render-only pipeline and association ownership

Extend the existing focused render-only layout utilities or a narrowly scoped companion in `utils/richTextImageLayout*`, invoked after `prepareStableContentHtml` in `StableContent.web.tsx`. Keep backward-wrap ownership behavior and its interleaved tests authoritative. Add an association wrapper around one eligible photo and its adjacent unclaimed plain-text paragraph run. The wrapper exists only in presentation output and stops at headings, other photos/groups, tables and independent semantic blocks. Plain `p > img` and supported `figure`/caption forms preserve descendants.

Prefer existing HTML preparation/top-level block handling; add only a deterministic bounded scanner if needed, not a general parser framework. Malformed or unsupported structures remain unchanged. Grouping must recognize its own output so repeated preparation does not nest groups, steal paragraphs or alter side classes. No DOM measurements, observers, delayed effect mutation or data writes.

Alternative: merely add a lower image max-height. Rejected because it addresses one photo size, creates content-dependent tiny images, and does not reconcile narrative/media measures. Existing48vh source is not permission for a new arbitrary cap; preserve the current image height contract and do not redesign canonical70vh media authority.

### 2. Restrict associations, preserve explicit media breakout

Use a narrowly named render wrapper with width100%, max-width720px, box-sizing border-box and bounded float containment (flow-root). Within it, existing min(45%,420px) image width naturally resolves to at most324px at720px;16px gutter remains. Text stays normal block flow; it is not a two-column flex/grid row, so long copy returns to full width below the photo. Do not add padding or margins that create extra artificial gaps. Keep headings clear and retain existing photo/caption contain and lightbox nodes.

Do not limit the whole root to720px: wide single landscapes, groups and galleries retain breakout. Do not remove heading clears: the next topic cannot wrap beside an unrelated preceding photo. The wrapper owns the image/text group, not the surrounding section heading or unrelated blocks.

### 3. Preserve responsive and first-frame behavior

Reuse existing viewport≤768px and actual-container≤560px stacking rules; a common wrapper must not create a narrow side strip or widen the body. Preparation is deterministic from current safe HTML and does not wait for decode or font measurement. Pass serverSanitized and articleBodyMedia through unchanged. Content descendants and media sources are identical on the first prepared frame and hydration; existing deferred-body scheduling remains unchanged.

Image failure uses the existing fallback and sampling behavior. Keep one effective raster URL per slot and DOM image identity where lightbox/media enrichment relies on it. Native StableContent paths receive no imports or wrappers.

### 4. Focused ownership

Potential task-owned implementation paths: `components/travel/StableContent.web.tsx`, `components/travel/stableContent/webStyles/{base,floats,typography}.ts` only as required, existing render-only utility or focused companion under `utils/richTextImageLayout*`, corresponding utility/web style/StableContent preservation tests and focused browser geometry spec. Exact paths are recorded before apply edits. Do not edit unrelated travel sidebar work, home/quest/map train files, canonical form persistence, server configs, app.json or native renderers.

Data/API/auth: unchanged. SEO: URL/canonical/redirects/sitemap/robots/metadata/structured data unchanged; retain safe HTML preparation and prerender/first-frame content compatibility. Security: wrapper creation cannot resurrect excluded HTML, change unsafe URLs or bypass sanitization. Accessibility: keep heading ranks, link targets, image alt/caption relationships and lightbox keyboard focus/dismissal. Analytics: unchanged click/events, no instrumentation additions.

## Risks / Trade-offs

- [Short copy remains shorter than some photos] → accept legitimate residual space; bound the shared measure instead of inventing text. Record before/after narrative width and vertical imbalance, not a zero-gap promise.
- [Interleaved photos steal shared paragraphs] → preserve previous-float ownership; test exactly-once text/media counts and stop boundaries. Unsupported structures pass through unchanged.
- [A wrapper affects media/lightbox enrichment] → preserve original descendants, URLs, alt and captions; focused StableContent tests and actual keyboard/lightbox probes after review.
- [Float containment changes margins or breakouts] → verify both sides, long-text return below photo, gallery/landscape neighbors and narrow-column resize.
- [Extra preparation work regresses body performance] → single deterministic pass, no eager bundle/framework or network additions; capture baseline and actual before/after through mandatory bilateral gates.
- [First-frame and hydrated ordering differ] → perform grouping during preparation, not effects; assert identical prepared associations and actual first-frame geometry.

## Migration Plan

No data migration. Only after separate apply authorization: implement scoped source, focused checks, independent review-and-fix and separate project review gate. The root follows the already-authorized task pipeline for explicit-path commit/push, testing transition and canonical production deploy. Runtime browser/performance acceptance belongs to testing after reviewed SHA is deployed, not to source review.

Rollback reverts only the new render wrapper and related scoped styles. Article/API HTML, image URLs and editor persistence remain unchanged, so there is no content rollback or backend operation.

## Validation Matrix

| Surface/contract | Evidence after appropriate stage |
| --- | --- |
| Utility association | Focused tests for orphan backward and forward runs, left/right, interleaved ownership, captions, no text, empty placeholders, boundary blocks, malformed pass-through and repeat grouping; canonical input/content digests unchanged |
| StableContent consumers | Focused tests for server-sanitized preparation, first prepared output, media/alt/caption/link preservation, lightbox selectors and native boundary unaffected |
| Article672 desktop1280 and2048 | Before/after screenshots, actual group width≤720,16px gutter, full photo, reduced avoidable height imbalance, H2 below group; light/dark |
| Long/short adjacent-text fixtures | Actual line geometry beside photo and return to full width below; short text allowed residual space; both authored sides |
| Mobile390 and desktop column≤560 | One column, preserved reading behavior,0 horizontal overflow, no clipped photo or tiny text strip; resize across boundaries |
| Wide media and failures | Landscape/gallery breakout unchanged; image slow/error/offline retains text/fallback and section separation; no duplicate raster |
| RU/BE/UK/PL/EN | Existing locale switching and article body remain intact, no new translations or formatting; targeted locale regression rather than new copy work |
| Accessibility | Heading sequence, alt/caption, link keyboard operation and full-photo open/dismiss/focus return |
| Performance | Operation-gated `npm run verify:slider` AND `npm run verify:slider-perf` in testing; real before/after URL/bytes/console/Core Web Vitals evidence, no extra media requests |
| Done | Deployed reviewed SHA, production article observations, both required gates PASS, no skipped-lock PASS; strict OpenSpec validation before archive |
