## 1. Characterize

- [x] 1.1 Reproduce on production `c20949bff` with a scroll-write trace: `popular` 78 → −720 (desktop), 54 → −1321 (phone); `near` 78 → 455. Attribute the write to `correctMeasuredAnchor`, anchor «Комментарии», node `travel-details-related-navigation-transition`.
- [x] 1.2 Reproduce locally (Metro + production API proxy, static «Похожие» snapshot) with the same trace.

## 2. Implement

- [x] 2.1 Skip the following-frame capture when the change origin starts below the reading line (`startsBelowReadingLine`), reusing `utils/sectionScrollOffset`.
- [x] 2.2 DOM regressions: late block below the line (758/1393 px), boundary at the park line and at the reading line, production topology (leaf inside the sidebar aggregate). RED without the rule, GREEN with it.
- [x] 2.3 Problem Memory causal delta.
- [x] 2.4 Independent code-review-gate on the full task diff: pass, one P3 (scope «Nearby resolves empty» to the reading line) applied to the delta; commit `659e3dfdf`.

## 3. Production acceptance

- [x] 3.1 Production `659e3dfdf`, 1440×900 and 390×844: `popular`, `near`, `similar` at the park line (78 / 54 px) 3 s after the jump, deviation 0 px; before: `popular` −720 / −1321, `near` off by 377. Controls: fresh article stays at scrollTop 0; read-only full-scroll CLS ×3 per viewport 0.0015–0.0095 (390×844) and 0.0116–0.0199 (1440×900), budget 0.1.
- [x] 3.2 Sync the delta into the main spec and archive the change.
