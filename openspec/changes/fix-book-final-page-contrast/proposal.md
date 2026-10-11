## Why

The owner supplied an almost unreadable final PDF page on 11 October 2026. The fixed pastel postcard incorrectly inherits near-white cover text from themes such as dark; only exact #ffffff receives the current contrast correction. This reopens the all-theme readability invariant of #2368, independently of #2275 WebKit gradients and #2407 photo-corner nondeterminism.

## What Changes

- Give the fixed pastel final postcard a readable, theme-independent foreground palette for heading, quote, statistics, stamp and decorative lines.
- Replace obsolete dark-page screen compositing with predictable opaque pastel decoration, preserving the WebKit no-alpha-gradient contract.
- Add all-theme/all-locale contrast and actual preview/printed-PDF acceptance, preserving current final content and one-page layout.

## Capabilities

### New Capabilities

- `book-final-page-readability`: readable final postcard and print-stable decorative colors independent of cover palette.

### Modified Capabilities

None: no existing canonical OpenSpec capability describes this bounded final-page contract.

## Impact

Platform impact: desktop web and mobile web PDF preview/export/print. Native device/export behavior unchanged.
Localization impact: all current locales RU/BE/UK/PL/EN are acceptance surfaces; existing text and pluralization retained, no new copy.
Affected frontend: final-page renderer/art, focused final-page tests and intentional final-page golden deltas only.
User-visible result: final heading, statistics, quote and stamp are readable in every theme.
Data/API: none; summary, date, quote, authentication and export settings unchanged. SEO: none, generated book is not indexed. Accessibility: foreground/background contrast and no text clipping. Performance: bounded final-page HTML only, no new network, media or eager bundle imports. Security: retain escaping and existing safe URLs. Analytics: no event changes.
Dependencies: reviewed frontend source and production print/browser access; no backend implementation or mock-only acceptance. Existing typography, artwork, final summary and physical A4/page footer are preserved. Out of scope: rich-text wrapping, article prose, #2407, cover redesign, worker planning protocol and native store operations. Open questions: none for this bounded palette correction. This proposal authorizes planning only; apply requires a separate owner request.
