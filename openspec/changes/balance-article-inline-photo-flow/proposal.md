## Why

The owner’s 11 October 2026 screenshot of article 672 shows a short paragraph beside a tall portrait and a large unused area before the next section. Wrapping already occurs, but the portrait resolves against a wide media lane while narrative text has a separate readable width; this makes a short paragraph finish far above its associated photograph.

## What Changes

- Give an eligible single photograph and adjacent narrative paragraphs the same existing readable measure, preserving actual text flow beside and below the photo.
- Keep section boundaries, authored image sides, complete uncropped photos and captions; retain wide-media breakout and mobile one-column behavior.
- Use one render-only association policy for all affected article descriptions, preserving canonical source HTML and first-frame preparation.
- Add a before-code design mock and browser acceptance for short/long/interleaved content, including the reported article.

## Capabilities

### New Capabilities

- `article-inline-photo-composition`: bounded narrative/photo associations with real text wrapping, content preservation and responsive section boundaries.

### Modified Capabilities

None: no current canonical capability describes this narrative-width association contract. The existing image/text-wrap mock remains normative for semantic boundaries and content preservation.

## Impact

Platform impact: desktop web; mobile web preserves the current stacked presentation. Android/iOS renderers and native configuration remain unchanged. Localization impact: none, because no app copy or authored prose changes; RU/BE/UK/PL/EN pages remain regression surfaces.

User-visible result: single portrait photos align within the narrative column and avoid the excess height imbalance caused by unrelated wide-media geometry. Some remaining space is valid when a photograph is taller than its short text; the goal does not promise elimination of all whitespace.

Frontend scope: existing description HTML preparation/render-only association utilities, StableContent web styles and focused preservation/geometry tests. Data/API: no writes or contract changes; article HTML, image URLs, content order, alt and captions remain canonical. SEO: existing URL, canonical, metadata and structured data unchanged; preparation must retain server-sanitized HTML and first-paint/SSR compatibility. Accessibility: retain headings, links, alt, caption association and keyboard/lightbox access. Performance: no added fetches/media rasters; bounded deterministic preparation, stable image slots and bilateral slider/performance acceptance. Security: preserve sanitization, link validation and escaping. Analytics: no new or removed events.

Dependencies: independent review and real production browser access after the project pipeline. No backend implementation. Fallback/mock policy: unchanged safe HTML and image-error fallback; fixtures establish preservation rules but cannot replace actual article acceptance. Existing behavior: landscape/gallery breakout, article lightbox, authored sides, section clear, mobile reading behavior and editor/autosave output are retained.

Out of scope: PDF final-page palette; PDF typed pagination/wrap; prose repairs or creative edits; media uploads/cropping; hero/gallery redesign; global typography changes; adding text to fill blanks; backend/store operations. Open questions: none for the bounded narrative-width approach. These artifacts authorize planning only; implementation requires a separate apply request.
