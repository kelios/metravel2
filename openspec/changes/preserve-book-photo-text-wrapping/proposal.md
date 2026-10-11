## Why

The owner supplied PDF examples from article 672 where a paragraph stays full-width above its side photo, leaving a large empty column. Parsed PDF display order is paragraph → float → heading: CSS cannot wrap preceding text, and the next semantic heading correctly clears the float. Web has a separate backward-wrap display transform; PDF does not. Historical #1602 covered forward wrapping and #1623 explicitly excluded print, so this is linked corrective ticket #2410 (related #1602/#1623).

## What Changes

- Associate an orphan side photo with an eligible preceding paragraph during PDF display only, preserving saved source, text, links, media order and authored float side.
- Keep actual wrapping text with its associated photo during measured pagination, while retaining long-text page continuation and clear separation at the next semantic heading.
- Verify the production single-article export path, including p/figure shapes and interleaved image ownership; record segmented worker coverage honestly.

## Capabilities

### New Capabilities

- `book-photo-text-flow`: PDF render-only side-photo association, pagination and source conservation.

### Modified Capabilities

None: canonical OpenSpec has no existing bounded rich-text photo-flow capability.

## Impact

Platform impact: desktop web and mobile web browser PDF export/preview/print. Native gates remain unchanged.
Localization impact: all current locales RU/BE/UK/PL/EN control surrounding book UI; authored article content remains unchanged and is not translated.
Affected frontend: typed PDF render-flow helper, BlockRenderer, any strictly necessary print-flow CSS and focused PDF tests/docs.
User-visible result: text wraps side photos in the book instead of remaining above an orphan float.
Data/API: no source writes, API schema, auth or settings changes. SEO: none for generated book. Accessibility: image alt, caption, heading semantics and links preserved. Performance: linear bounded display pass over already parsed content; no new fetches, full-field worker buffering or eager imports. Security: existing sanitization/escaping and safe image URLs retained. Analytics: no changes.
Dependencies: production article 672 and the actual browser export path for acceptance; no mock-only geometry pass. Worker segmented content bypasses BlockRenderer and has original-source occurrence ledgers: do not claim worker parity without separately proved coverage. Preserve forward wrapping, galleries, figure captions, image occurrence order, text/link bytes and semantic section boundaries. Out of scope: final-page palette, authored article correction, global heading-clear removal, worker planning/ledger changes, native/store changes and new export backends. Open questions: production runtime export-path identity must be captured during testing before claiming parity; source confirms the single-travel browser HTML path uses BlockRenderer. Planning only; apply requires a separate owner request.
