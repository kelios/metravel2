## 1. Implement and verify task #3437

- [x] 1.1 Read the existing contract and capture real production request baseline.
- [x] 1.2 Apply the canonical resource fix and focused regression tests.
- [x] 1.3 Pass focused unit/static checks and independent review-and-fix, plus code-review-gate.

## 2. Testing and delivery

- [x] 2.1 Commit explicit task paths, push main and record the SHA in the existing board task.
- [x] 2.2 Deploy through the normal frontend operator and verify the published revision.
- [x] 2.3 Verify real mobile/desktop request limits, adjacent controls and screenshot evidence; update the task, synchronize and archive the accepted change.

## Accepted evidence — 2026-11-15

Published application: `103277f61e6d06a932c8f00e5ff395b6bb05244b`; test source: `1b5fe18fea977c21a187c395d16da679d2ea7a43`. Independent review and normal commit/push hooks passed. Production media and real SSR tests: 20/20; local slider performance: 37/37; slider controls: 2/2. Bundle: 556.8KB within 558KB. Board task is done; main specs synchronized and verified before archival. Evidence: `.codex-temp/s35-media/final-production-smoke.log`, `final-production-results/`, `final-slider-perf.log`, and `.codex-temp/deploy/prod-103277f61-20261115T202953Z.log`.
