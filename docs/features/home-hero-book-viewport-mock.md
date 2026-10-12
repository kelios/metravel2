# Home book viewport schematic v1

Task #2405, approved OpenSpec `fix-home-book-viewport-geometry`, 2026-10-11.

The existing spread remains the visual anchor. Both pages use the same positive
book height: artwork ratio limited by viewport height minus 180px of shell/chrome.
Width caps remain 1200/1360/1520px. Vertical paper insets use book height, rather
than CSS percentage padding (which resolves against width).

All paper insets derive from the inner page frame drawn on the artwork
(`HOME_BOOK_ARTWORK_FRAME` in `components/home/homeBookGeometry.js`, both
themes share one drawing) plus a fixed gap: content, search and page numbers
never sit on a frame line. Horizontal left-page padding is a share of the whole
book width — flex-item `%` resolves against the book row, while the SSG grid item
spells it as `calc(var(--home-book-width) * share)`. The artwork is cut out with
alpha around the book, so seasonal page backgrounds show no rectangle behind it;
its URL carries a `?v=` token because `/assets/images` is served `immutable`.

```text
Healthy desktop                       Wide, short desktop
┌──────────── book artwork ─────────┐  ┌────────── book artwork ──────────┐
│ top paper inset                  │  │ top paper inset                 │
│ ┌─ left content ─┐ ┌─ photo ───┐ │  │ ┌─ left scroll frame ─┐ ┌photo┐ │
│ │ chapter/title  │ │ existing │ │  │ │ chapter/title       │ │     │ │
│ │ description    │ │ ratio    │ │  │ │ description         │ │same │ │
│ │ search ≥44px   │ │ media    │ │  │ │ search ≥44px         │ │ratio│ │
│ │ action ≥44px   │ │          │ │  │ │ action ≥44px ↕       │ │     │ │
│ └────────────────┘ └──────────┘ │  │ └─────────────────────┘ └─────┘ │
│ bottom inset / page number      │  │ bottom inset / page number      │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

The complete left content scrolls as one unit when necessary. Text remains
natural-height and may wrap in RU/BE/UK/PL/EN; nothing is truncated. Title stays
at least 24px and description at least 12px. Search and action never shrink below
44px. Keyboard focus brings each control into the paper viewport. The scroll
area contains horizontal overflow and retains ordinary wheel/touch boundary
behavior. Decorations and page number remain outside scrolling content.

At extremely short heights the book retains a positive minimum height and the
document can scroll. Below the desktop spread breakpoint, existing tablet/mobile
normal flow remains. Cold SSG applies the same height, width caps, insets and
typography model before application loading.

Acceptance screenshots: 2048×900, 2560×640, healthy 1440×900 and mobile 390×844;
height-only resize at width 2048; both themes and seasonal off/christmas in all
five locales. Measure clipping ancestors after ordinary reveal, exercise actual
clicks and keyboard focus, retain console evidence and compare cold/loaded bounds.

Chosen: height-aware spread with complete left-page scrolling. Rejected:
unbounded overflow outside artwork and unconditional stacked desktop. Risk:
nested scrolling; mitigation is natural focus/wheel behavior and preserved outer
page scrolling. Rollback: revert shared geometry/runtime/SSG changes together.
