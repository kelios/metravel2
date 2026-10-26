## 1. Implementation

- [x] 1.1 Implement owned source resolution and safe allowlist bootstrap.
- [x] 1.2 Add npm command, consumer diagnostics and operational documentation.
- [x] 1.3 Add regression fixtures for boundaries, force/idempotence and no secret output.
- [x] 1.4 Batch Git policy checks after real 138-font QA exposed subprocess fan-out; cover scale and negated/malformed records.

## 2. Code review

- [x] 2.1 Run focused tests, lint, guards, prompt audit and strict OpenSpec validation.
- [x] 2.2 Independent review-auditor repair pass, then code-review-gate.

## 3. Testing and integration

- [x] 3.1 Integrate only task-owned paths in main and push as authorized by task workflow.
- [x] 3.2 Prove fresh owned worktree and shared clone bootstrap without manual artifact copies.
- [x] 3.3 Execute bookRendererWorker, production web build and smoke e2e under operation locks; retain the actual results below.
- [x] 3.4 Record actual results and final strict validation; product/native UI unchanged.

## Acceptance evidence — 2026-10-26

- Source `5d7a4cda1422db0cfa48a2f06e957dd20d864130`: 37/37 focused tests, independent source reviews, lint and guards passed.
- Fresh linked worktree and owned shared clone: 7216 assertions passed, including keep/force, symlink and negated-ignore rejection before writes, unchanged source env and no secret output. Maximum bootstrap duration: 1087 ms.
- Book worker: 70/70 passed. Fresh production web build passed; exact source was deployed and verified. Later live source `9afdd3022` includes the task unchanged.
- Full Chromium smoke **failed**: 5 failed, 1 flaky, 94 passed; backend remained healthy for 68 probes. Auth entrypoints, authenticated favorites, search and catalog startup passed. No full-smoke green result is claimed.
- Independent acceptance passed the owned DX contract after source/environment comparison. Separate footer, stale smoke-premise, wizard-transition and cluster-flakiness findings are routed through linked board follow-ups; they are not represented as fixed by bootstrap.
