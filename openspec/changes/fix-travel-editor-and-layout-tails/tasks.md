## 1. Source and regressions

- [x] 1.1 Reproduce real Quill history/clipboard provenance leaks and preserve authored alt.
- [x] 1.2 Reproduce owner/viewport-only retained-height changes and reuse safe release.
- [x] 1.3 Remove unconsumed prefetchResource; retain real preload/idle consumers.
- [x] 1.4 Clarify hook-test contract and assess native placeholder premise at its branch.
- [x] 1.5 Reproduce the late-banner first-visible viewport race (desktop RED,320 healthy) and use the existing clientOnly contract; focused GREEN is source evidence.
- [x] 1.6 Validate empty-scaffold repair with real Quill delete-all/Undo: old helper1FAIL/healthy1PASS, repaired suites32PASS; scoped source checks passed.

## 2. Review and release

- [x] 2.1 Run selected red/green tests, scoped lint, TypeScript and strict OpenSpec.
- [ ] 2.2 Complete independent review-and-fix and formal gate; explicit-path commit/push.
- [ ] 2.3 Enter testing and canonically deploy a containing SHA under unchanged budgets.

## 3. Acceptance and disposition

- [ ] 3.1 Mobile then desktop loading/resize/console measurements; 12 loads per desktop historical case.
- [ ] 3.2 Resolve cookie/footer/author and console items by actual cause or documented disposition.
- [ ] 3.3 Create and verify the private QA104 image draft and run actual editor persistence acceptance.
- [ ] 3.4 Record each item а–к, sync/archive the accepted spec and complete the Done gate.

## Execution checkpoint

Source18 iteration2f66 was reviewed/pushed/canonically published. Production QA
stopped at TMB470 case2 cookie CLS0.08803 (1PASS/1FAIL of24); remaining runtime
and private fixture/editor checks are NOTRUN. New cookie source review, normal
publication/canonical release and full accepted runtime remain required for2.2–3.4.
The separate mandatory LOCAL slider/slider-perf pair is also not yet accepted.

Cookie release22f69 later passed canonical gates and24/24 desktop loads; mobile
resize/rotation passed, held-gap coverage remains NOT TESTED. Private973 initial
images/no-alt persistence and native HTML copy passed, then cut/Undo timed out.
The same private technical body was restored under a fresh hash/version fence.
Empty-scaffold history repair passed its separate scoped source checks. Final
independent gate, containing release and remaining editor acceptance are pending.
