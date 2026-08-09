## 1. Board and Scope Handoff

- [x] 1.1 Create or reuse one `area=front` task linked to backend task #1321, persist this OpenSpec path and the complete Task Contract, and keep backend implementation/nightly restart outside the frontend task. Created #1365.
- [x] 1.2 When implementation actually starts, mark only the linked frontend task `in_progress`; keep #1321 in its backend/ops workflow with `Platform impact: shared` and `Localization impact: none`.

## 2. Safe Frontend Deploy Lifecycle

- [x] 2.1 Replace the frontend deploy's app/Nginx hard-restart branch with one Compose-compatible Nginx validation and graceful-reload path that never restarts or recreates `app`.
- [x] 2.2 Retain `static/dist.old` after the atomic swap and implement a focused failure path that restores it and gracefully reloads Nginx when validation, reload, or readiness fails.
- [x] 2.3 Add a bounded public `/health` HTTP-200 probe with a 30-second total window before final rollback cleanup and before local post-deploy acceptance checks can start.
- [x] 2.4 Preserve the existing quest fallback, tracked-path protections, root-in-container static cleanup, Expo asset overlap, and build/deploy locks without adding a second deploy abstraction.

## 3. Regression Coverage and Documentation

- [x] 3.1 Extend the existing deploy source-contract Jest suite to extract the real remote payload and assert no app restart/recreate, Nginx validation-before-reload, readiness-before-old-tree-cleanup, and valid Bash syntax.
- [x] 3.2 Add negative source fixtures or focused assertions proving the regression test fails when an app restart or unsafe ordering is reintroduced; do not mock the canonical deploy primitive under test.
- [x] 3.3 Update `docs/RELEASE.md` and directly contradictory canonical deploy wording to state that frontend-only releases preserve the app process, use graceful Nginx activation, and fail closed with static rollback.

## 4. Local Validation and Review

- [x] 4.1 Check the operation gate and resolve deploy-contract validation. The regression suite was implemented without skips; automated Jest execution was explicitly waived by the owner for this rollout and recorded instead of being reported as passed.
- [x] 4.2 Resolve the changed-scope/release validation plan. Standalone checks were explicitly waived by the owner; the canonical production build/deploy completed successfully as the authorized acceptance run.
- [x] 4.3 Run the mandatory independent `metravel-code-reviewer` review-and-fix pass over the complete task-owned diff, then re-read the full diff and rerun all affected checks.
- [x] 4.4 Run `openspec validate prevent-frontend-deploy-app-restart --type change --strict` and `openspec validate --all`, resolving any artifact/code-contract mismatch.

## 5. Authorized Production Acceptance

- [x] 5.1 Before the explicitly authorized rollout, verify production checkout cleanliness under the documented exceptions and record app container ID, `StartedAt`, restart count, and the 38-client-502/44-second baseline.
- [x] 5.2 Run a continuous public GET probe while the canonical frontend deploy publishes the release, then verify the app container ID and `StartedAt` are unchanged, public `/health` is 200 before acceptance gates, and client-facing 5xx count is 0.
- [x] 5.3 Confirm post-deploy SEO/media checks run after readiness, review the corresponding Nginx window for deploy-correlated 5xx, and append evidence to the linked frontend task without claiming that #1321's backend image-rollout contract is complete.
