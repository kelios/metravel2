## 1. Planning and mechanism

- [x] 1.1 Confirm the authored-float mechanism from production baseline and API markup; refine the group hypothesis.
- [x] 1.2 Define shared slot policy, scope, risks and runtime controls.

## 2. Implementation

- [x] 2.1 Add parser-derived image ancestor classes without a heavy eager dependency.
- [x] 2.2 Apply the shared float slot to full and inert body source construction.
- [x] 2.3 Cover narrow floats, wide/mobile controls and server/full source equality.

## 3. Validation and delivery

- [x] 3.1 Run focused source tests/lint and independent review.
- [x] 3.2 Root verifies release bundle cap and publishes the reviewed revision.
- [x] 3.3 Root repeats production mobile/desktop probes and records accepted evidence on #3438.

## Accepted evidence — 2026-11-15

Published application: `103277f61e6d06a932c8f00e5ff395b6bb05244b`; test source: `1b5fe18fea977c21a187c395d16da679d2ea7a43`. Independent review and normal commit/push hooks passed. Production media and real SSR tests: 20/20; local slider performance: 37/37; slider controls: 2/2. Bundle: 556.8KB within 558KB. Board task is done; main specs synchronized and verified before archival. Evidence: `.codex-temp/s35-media/final-production-smoke.log`, `final-production-results/`, `final-slider-perf.log`, and `.codex-temp/deploy/prod-103277f61-20261115T202953Z.log`.
