## 1. Characterize

- [x] 1.1 Record five fresh production full-scroll baselines at 390×844 and 1440×900, including node/class/rect/time attribution.
- [x] 1.2 Attribute upstream 710px growth and 198.6875px shrink independently from JavaScript scroll writes; confirm Nearby 217px contraction.
- [x] 1.3 Add the exact full-scroll regression and capture its failure against the pre-fix production revision (five visits: 0.0901/0.2071/0.0015/1.1418/0.1185; three violate CLS).

## 2. Implement

- [x] 2.1 Apply existing measured child-frame transitions at the map composition slot and Nearby content boundary without changing map internals, data or loading policy.
- [x] 2.2 Add focused component/DOM coverage for both owners, signed growth/shrink, empty runtime and nested single correction; update only the Problem Memory causal delta.
- [ ] 2.3 Run targeted Jest, full lint and strict OpenSpec validation; hand the complete task diff to independent review and code-review-gate.

## 3. Production acceptance after reviewed publication

- [ ] 3.1 Run the committed full-scroll regression and identical primary probe: CLS ≤0.1 in all five fresh visits at each viewport, real inner-owner bottom, resolved footer, no trailing reserve or console/page errors.
- [ ] 3.2 Confirm mobile Lighthouse ×5 median ≥60 and bilateral slider/performance evidence.
- [ ] 3.3 Check direct load/SPA, compact empty/error content and longest-label locale geometry mobile-first then desktop; record actual live revision and validate the completed change before archive.
