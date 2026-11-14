## Why

Task #3396: on a production article (build `25233041c`, re-measured on `c20949bff`) a menu jump to «Популярные маршруты» parks the section at the reading line and about 0.7 s later the reader is scrolled away from it: section top `78 → −720` at 1440×900 and `54 → −1321` at 390×844. The jump to «Рядом можно посмотреть» drifts the same way (`78 → 455`).

The cause is our own anchor correction, not browser scroll anchoring: `correctMeasuredAnchor` (`components/travel/details/TravelDetailsDeferredTransition.tsx`) wrote `scrollTop 56226 → 56983.6` when the `travel-details-related-navigation-transition` leaf grew `0 → 758 px` («Похожие статьи», #3292). The transaction holds the first visible following frame («Комментарии»), which is correct when the change enters the flow above the viewport and wrong when it enters below the section the reader is on.

## What Changes

- A measured height change that starts below the scrollspy reading line no longer holds a lower visible frame: the section under the reading line keeps its position and the following content takes the change.
- Changes that start at or above the reading line keep the existing behaviour (first visible following frame is preserved).
- The origin of the change is the leaf transition; for a first measurement inside a fresh ancestor payload it is that ancestor.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `travel-deferred-flow-stability`: the «stable following content» requirement gets the reading-line boundary and a scenario for a late block growing below the opened section.

## Impact

- Paths: `components/travel/details/TravelDetailsDeferredTransition.tsx`, its DOM test, `docs/PROBLEM_MEMORY.md`.
- Platform impact: desktop web and mobile web. Native renders children directly and is unchanged.
- Localization impact: none.
- No data/API change; no new reserve or fixed height.
