## 1. Characterize

- [x] 1.1 Reproduce on production `c20949bff` with a scroll-write trace: `popular` 78 → −720 (desktop), 54 → −1321 (phone); `near` 78 → 455. Attribute the write to `correctMeasuredAnchor`, anchor «Комментарии», node `travel-details-related-navigation-transition`.
- [x] 1.2 Reproduce locally (Metro + production API proxy, static «Похожие» snapshot) with the same trace.

## 2. Implement

- [x] 2.1 Skip the following-frame capture when the change origin starts below the reading line (`startsBelowReadingLine`), reusing `utils/sectionScrollOffset`.
- [x] 2.2 DOM regressions: late block below the line (758/1393 px), boundary at the park line and at the reading line, production topology (leaf inside the sidebar aggregate). RED without the rule, GREEN with it.
- [x] 2.3 Problem Memory causal delta.
- [ ] 2.4 Independent review and code-review-gate on the full task diff.

## 3. Production acceptance

- [ ] 3.1 Same probe on production after publication, 1440×900 and 390×844: `popular`, `near`, `similar` stay within ±20 px of the park line for 3 s after the jump.
- [ ] 3.2 Sync the delta into the main spec and archive the change.
