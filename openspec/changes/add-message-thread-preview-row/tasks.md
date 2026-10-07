## 1. Preparation and API contract

- [x] 1.1 Receive a separate explicit apply request for this proposal; verify main/status/task ownership and dependencies #2264/#2265 done.
- [x] 1.2 Add optional preview type to MessageThread and test JSON→fetch→hook field preservation without adding a per-thread request.

## 2. Shared row implementation

- [x] 2.1 Implement own/other/deleted/null/absent preview states; ensure deleted nonempty text is never rendered or announced.
- [x] 2.2 Extend the existing second meta line with one-line preview, preserve name-first layout, stable row callbacks, selected/unread/delete and name search.
- [x] 2.3 Localize app-owned labels/a11y for RU/BE/UK/PL/EN using reactive translations; preserve API message content unchanged.

## 3. Code-level validation and independent review

- [x] 3.1 Add Jest coverage for all preview states, similar names, language switch and unchanged adjacent actions; run relevant API/hook/ThreadList tests.
- [x] 3.2 Add e2e regression cases for 200-character ellipsis, height delta <= 1 px and no horizontal overflow on 320/390/1440; prepare desktop/mobile screenshots and console/network expectations.
- [x] 3.3 Run i18n, scoped eslint, tsc and e2e typecheck through operation gates; record actual pass rather than SKIPPED.
- [x] 3.4 Run independent review-and-fix of the complete task diff, reread fixes and rerun relevant code-level checks before testing.

## 4. Testing and completion after review

- [ ] 4.1 Parent pipeline commits exact task paths, pushes main and deploys the reviewed SHA under the already authorized todo/deploy/test request, then conducts production acceptance in testing.
- [ ] 4.2 Run real production e2e-account probes without mocks: different previews for similar names, own/other/deleted/empty, 320/390/1440, light/dark and RU/BE/UK/PL/EN; no ordinary private message reads.
- [ ] 4.3 Attach rendered screenshots, measured row heights, console/network results and deployed SHA; clean only authorized test fixtures and close #2266 only when its Done gate passes.
- [ ] 4.4 Validate this change strictly and all specs before archive; preserve unresolved actual gates in the task record rather than calling mock coverage production pass.
