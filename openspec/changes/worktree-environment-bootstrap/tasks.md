## 1. Implementation

- [x] 1.1 Implement owned source resolution and safe allowlist bootstrap.
- [x] 1.2 Add npm command, consumer diagnostics and operational documentation.
- [x] 1.3 Add regression fixtures for boundaries, force/idempotence and no secret output.

## 2. Code review

- [x] 2.1 Run focused tests, lint, guards, prompt audit and strict OpenSpec validation.
- [x] 2.2 Independent review-auditor repair pass, then code-review-gate.

## 3. Testing and integration

- [ ] 3.1 Integrate only task-owned paths in main and push as authorized by task workflow.
- [ ] 3.2 Prove fresh owned worktree and shared clone bootstrap without manual artifact copies.
- [ ] 3.3 Validate bookRendererWorker, production web build and smoke e2e under operation locks.
- [ ] 3.4 Record actual results and final strict validation; product/native UI unchanged.
