## 1. Source implementation

- [x] 1.1 Preserve and validate the optional article count; share the early reserve between deferred map and route-profile frames.
- [x] 1.2 Bind preview completion to current article/files; keep reserve through parsing and chart Suspense, release through existing measured shrink.
- [x] 1.3 Restore article 544 route-block CLS accounting and document the causal delta in Problem Memory.

## 2. Source evidence and review

- [x] 2.1 Add/run focused normalization, readiness, first-frame/Suspense and DOM surplus-release regressions via the quality wrapper.
- [x] 2.2 Run scoped lint/type/guards and OpenSpec strict validation; obtain independent review-auditor and code-review-gate verdicts.

Source evidence: `.codex-temp/sprint35-frontend/source-review.md`. Both independent reviews PASS after the earliest-placeholder fix. Full source and scoped CLS types pass; full e2e types report six errors in three unchanged specs (`e2e-typecheck.log`) and are not claimed green.

## 3. Coordinator delivery and acceptance

- [ ] 3.1 Coordinator commits explicit paths, pushes reviewed source, enters testing, deploys and verifies the published revision.
- [ ] 3.2 Run the contracted real-production 544/470 CLS matrix, slow-reader and zero-count controls with screenshots/console/network; record evidence and close only on pass.
