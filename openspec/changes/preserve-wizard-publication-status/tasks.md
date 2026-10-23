## 1. Canonical state and writes

- [x] 1.1 Extend shared status adapter and types; preserve canonical through empty form, hydration, normalization and cleanup; test canonical priority, legacy absence and invalid values.
- [x] 1.2 Route full/content/route saves through canonical validation and explicit commands; strip legacy flags and replay reason; preserve debounce and serialize commands/queued saves against confirmed state.
- [x] 1.3 Update existing publish UI for canonical chips, immediate role actions, explicit commands and visible localized unknown-state errors in RU/BE/UK/PL/EN without layout redesign.
- [x] 1.4 Correct save/moderation contract and record permanent problem-family control.

## 2. Source validation and review

- [x] 2.1 Add real mapper→form→serializer and persistence regression tests for four states, full/PATCH/route writes, commands, reason replay, errors and races; add adapter-bypass governance control.
- [x] 2.2 Run targeted Jest, relevant lint/tsc, test:i18n and required full lint/test baseline with shared quality operation coordination; verify the final Save-event repair with focused tests and static checks.
- [x] 2.3 Complete independent review-auditor repair pass and code-review-gate; explicit-path commit/push main and testing transition per assigned #2693 pipeline, including the production error-path repair.
- [x] 2.4 Handle reported save callback rejection at the common header event boundary and test rejection→retry in both responsive layouts without swallowing persistence or moderation-command failures.

## 3. Testing on production

- [ ] 3.1 Refresh/readiness-check local backend per operations §3.0, perform authorized standard frontend deployment and confirm production build SHA, including the reviewed Save-event repair.
- [x] 3.2 Verify author/admin UI at 1440/390 with screenshots/console and real PUT/PATCH→GET on owned draft/pending/approved/published articles for manual save, text autosave and route save.
- [ ] 3.3 Verify explicit submit/approve/reject, invalid reasons, error/retry and unknown-state controls; remove owned test data and record exact results in #2693.
- [ ] 3.4 After accepted Done gate, sync living spec, run openspec validate --all and archive the completed change.
