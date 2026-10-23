## 1. Design and implementation

- [x] 1.1 Record evidence, chosen shared policy, rejected alternatives, native boundary and rollback before code.
- [x] 1.2 Apply shared detail-route and presentation policy to header rendering, first-frame reservation and wizard placement.
- [x] 1.3 Preserve desktop brand/language/navigation and sidebar identity/actions while omitting the duplicate wide breadcrumb row.
- [x] 1.4 Add source regressions for localized route scope, header geometry and tablet/landscape draft/sheet/scroll continuity.

## 2. Code review and validation

- [x] 2.1 Run coordinated targeted static/unit checks and existing i18n checks; record actual results without treating SKIPPED as PASS.
- [x] 2.2 Independent review-and-fix of the complete task diff, followed by code-review gate.

## 3. Testing after review

- [x] 3.1 On the exact deployed SHA measure pinned top chrome <=20% at all seven spec viewports; screenshots, light/dark and console evidence.
- [ ] 3.2 Verify RU/BE/UK/PL/EN routes and fallback notice, loading/error/offline, intro/step, desktop sidebar and all row/menu actions.
- [ ] 3.3 Verify route sheet/current point, answer draft/focus and reading anchor during portrait/landscape resize.
- [ ] 3.4 Run final OpenSpec validation before archive; update completion only from actual evidence.

## Verification receipt (2026-10-23)

- Reviewed application commit: `3b49264eb269df7bb800b5014908aa68866b906f`; production acceptance target: combined `61d97cdd2c84767fb0a6a754f4849ff9fe36eda4`, verified before and after the probes. The separate language-row removal is ancestor `1ada8ebe3708d733591fd2619da1cae7799321d7`.
- Code checks: 16 suites / 275 tests passed, composed from 14 unchanged passing suites plus two successful reruns after test-only expectation repairs. Scoped ESLint, `tsc --noEmit`, screen-header/actions guards, `npm run audit:prompts`, strict OpenSpec validation and task diff check passed. Existing i18n validation passed 32 suites / 539 tests. Independent review-and-fix and final code-review gate passed with zero remaining findings. Commit and pre-push source checks actually passed; no SKIPPED result is counted as a pass.
- Production visual checks: 13 normal page cases (seven RU viewports, two light-theme controls and BE/UK/PL/EN direct routes), zero console/page errors, no duplicate version row. Top chrome excludes the bottom dock and route navigation inside the reading scroll.

| Viewport | Pinned top | Viewport share |
| --- | --- | --- |
| 320×640 | 54 px | 8.44% |
| 390×844 | 106 px | 12.56% |
| 718×735 | 54 px | 7.35% |
| 960×640 | 54 px | 8.44% |
| 1024×768 | 54 px | 7.03% |
| 1440×900 | 78 px | 8.67% |
| 844×390 | 54 px | 13.85% |

- Desktop and dock language menus on the unprefixed route changed document, interface and quest content to EN while retaining the pathname, as required by the existing preference contract. The first harness incorrectly expected `/en/` navigation; its timeout is retained separately, not represented as a product failure. Prefixed routes retain the existing version-link contract.
- Header/slot reservation stayed 54 px while the 52 px screen row mounted. The initial hidden-DOM top offset is identical to baseline: the existing SSG introduction precedes the hidden app root, then the shared `rnw-styles-ready` handoff hides that introduction and reveals the root. No header-associated layout shifts were captured. These samples do not establish zero global CLS or first-paint visibility.
- Normal screenshots and raw network/frame results: ignored `.codex-temp/quest-language-row/final/report.json`; baseline: `.codex-temp/quest-language-row/baseline/report.json`. Draft and route-sheet resize screenshots, error and authenticated consent screenshots were captured. The continuation exited 1; aggregate interaction/error/authenticated exit checks remain pending, not PASS. The ignored harness must retain partial observations and use visible CTA/exit locators before the narrow follow-up; do not rerun the 13 completed normal cases.
- Separate existing risk: `components/ui/NetworkStatus.web.tsx` places its offline banner at fixed top 0 with z-index 9999, covering the 54 px header in the captured offline fixture. The banner code is outside this task diff; the baseline narrow header was already 54 px. Body route navigation and bottom navigation remain visible. Recheck the focused/blurred header actions after a separate banner-layout correction; do not silently accept the covered More click.
- No answer submission, progress reset, authored quest text or media changes. The offline and bundle-abort cases are local browser fault fixtures; their expected failures are separate from normal production network health.
