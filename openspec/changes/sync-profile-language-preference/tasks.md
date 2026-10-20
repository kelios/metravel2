## 1. Planning and Contracts

- [x] 1.1 Verify #2691, completed backend dependency #2687, Problem Memory and locale/auth/cache source evidence.
- [x] 1.2 Validate and independently review proposal, scenarios and design before executable changes.

## 2. Profile API and Cache Ownership

- [x] 2.1 Extend profile DTO/update typing with optional nullable supported language; cover API round-trip and payload omission/null.
- [x] 2.2 Add optional profile mutation-field masks and use them in settings/notifications/avatar commits; cover preservation of a newer cached language and existing full-replace/null behavior.

## 3. Preference Provenance and Synchronization

- [x] 3.1 Add valid persisted-preference reads and deliberate-write subscriptions while preserving fallback and native/web boot contracts; cover storage errors, ordering and stale reads.
- [x] 3.2 Guard web explicit selection against older catalog completion and allow deliberate same-language selection without changing control geometry.
- [x] 3.3 Implement a serial latest-choice coordinator with session invalidation, bounded retries, owner-cache field patches and stale-GET guards; cover all session/ordering/error scenarios.
- [x] 3.4 Mount the shared runtime inside existing providers, gate it on auth/hydration/provenance and prove guest/default/quest/catalog no-write behavior.
- [x] 3.5 Add common error copy in RU/BE/UK/PL/EN and existing toast handling; preserve the local preference on remote failure.

## 4. Code-Level Validation and Review

- [x] 4.1 Run focused storage/provider/native boot, coordinator/runtime, API/profile/settings/avatar and selector tests; fix real in-scope failures.
- [x] 4.2 Run test:i18n, lint/typecheck/guards and full Jest with shared quality-operation coordination; record actual results without treating skipped gates as pass.
- [x] 4.3 Complete independent review-auditor review-and-fix and final code-review-gate over the full task diff.
- [ ] 4.4 Commit explicit task paths, push main and enter testing with reviewed SHA under the authorized board-task pipeline.

## 5. Testing and Closure

- [ ] 5.1 Deploy reviewed final SHA through the canonical production script and verify production build-source.
- [ ] 5.2 At desktop1440/mobile390 prove real owner PUT/GET selection, reload/login persistence and supported system locale; capture screenshots and console.
- [ ] 5.3 Prove no guest/default/catalog/temporary-quest writes, delayed PL→EN latest state and current-language failure notification; restore any QA account/profile/preferences.
- [ ] 5.4 Record independent production acceptance and close #2691 only when its Done gate passes.
- [ ] 5.5 Validate this change strictly and inspect `openspec validate --all` without modifying unrelated changes; synchronize the canonical capability and archive accepted artifacts through task-scoped review/commit.

## Code-level validation evidence

- Focused final regression: 12 suites / 181 tests passed; the mobile retry follow-up passed 3 suites / 33 tests. `npm run test:i18n`: 32 suites / 539 tests passed.
- Shared final source at `d8927b0dd9874b72b06991c131ea6d8feae68678`: full lint, typecheck and audit:prompts passed; start/end source hashes were identical. Full `npm run test:run` completed with exit 1: 1880 suites / 21544 tests passed and two cases failed in the unrelated AppInstallBar test fixture. All task-owned suites passed. Raw results remain `.codex-temp/task2691/{shared-checks.json,shared-verification.json,final-test-run.log}`.
- The handoff owner repaired only `__tests__/components/AppInstallBar.goal.test.tsx` to drive real context updates through React.memo, retaining both behavior assertions. Nine unaffected targeted suites passed (171 tests); the final corrected fixture passed all seven tests, its ESLint check passed and full typecheck passed. The combined ten-suite / 178-test targeted evidence resolves both original failures without changing executable source. Independent review approved this fixture-only correction; the raw full-run exit is not reclassified as PASS. Evidence: `.codex-temp/mobile-app-handoff/{fixture-resolution.json,targeted-resolution.log,final-fixture.log}`.
- Independent review-auditor and final gate source review found no remaining actionable issues after fixing stale-route catalog completion, canceled initial profile loading, inherited locale keys and same-current mobile retry. All 38 task-owned files matched the shared-run snapshot before this evidence-only task update; unrelated executable hashes remained unchanged.
- Dependency #2687 was reaccepted after its concurrent-write recurrence fix: production implementation `d400ac806ed648e341f4e701795a7322b02e44e8`, reviewed/pushed archive `ac4f277fa7e1d2b8071e99d69b961dfc75e4349d`; board status done. Frontend commit/push, testing, deployment and browser acceptance remain pending.
