## 1. Characterize

- [x] 1.1 Record five fresh mobile production baselines; withdraw the original invalid desktop series (article top 0) and replace it with five hit-tested full traversals on `4c829` (CLS 0.01994/0.01157 ×4), retaining raw point/bounds/node/rect/time evidence.
- [x] 1.2 Attribute upstream 710px growth and 198.6875px shrink independently from JavaScript scroll writes; confirm Nearby 217px contraction.
- [x] 1.3 Add the exact full-scroll regression and capture its failure against the pre-fix production revision (five visits: 0.0901/0.2071/0.0015/1.1418/0.1185; three violate CLS).
- [x] 1.4 Attribute `4c829` mobile failure with independent reveal/RO/scroll-write timeline: Excursions 160→1050+32 (+922), then +264, moves Map/Points before outer RO; native anchoring follows. Retain the failed five-run acceptance and causal raw artifacts.

## 2. Implement

- [x] 2.1 Apply existing measured child-frame transitions at the map composition slot and Nearby content boundary without changing map internals, data or loading policy.
- [x] 2.2 Add focused component/DOM coverage for both owners, signed growth/shrink, empty runtime and nested single correction; update only the Problem Memory causal delta.
- [ ] 2.3 Run targeted Jest, full lint and strict OpenSpec validation; hand the complete task diff to independent review and code-review-gate.
- [x] 2.4 Encode controlled zero-height/no-reserve flow in the existing shared module and use its typed owner for map, Nearby and related navigation, preserving loading/placeholder/keys/native behavior; exercise the actual configured owner in DOM tests.
- [ ] 2.5 Re-review the entire still-unaccepted task after the configured-owner delta, then confirm unchanged bundle budgets in the canonical candidate build; the isolated gzip proxy does not replace this gate.
- [x] 2.6 Reuse the measured-flow owner around the entire Excursions replacement in MapSection; retain the outer owner, 160px fallback, loaded UI, eligibility/refs/native/iframe/loading behavior and generic algorithm.
- [x] 2.7 Capture RED (2/2 failures, Points+922 before leaf RO) then GREEN for the real MapSection + Excursions composition, covering +922/+264/empty 0 with native and manual single compensation. Correct the production wheel driver without weakening cadence, bottom, runtime or CLS assertions.

## 3. Production acceptance after reviewed publication

- [ ] 3.1 Run the committed full-scroll regression and identical primary probe: CLS ≤0.1 in all five fresh visits at each viewport, real inner-owner bottom, resolved footer, no trailing reserve or console/page errors.
- [ ] 3.2 Confirm mobile Lighthouse ×5 median ≥60 and bilateral slider/performance evidence.
- [ ] 3.3 Check direct load/SPA, compact empty/error content and longest-label locale geometry mobile-first then desktop; record actual live revision and validate the completed change before archive.
