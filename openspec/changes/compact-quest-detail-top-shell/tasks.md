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
- [x] 3.2 Verify RU/BE/UK/PL/EN routes and fallback notice, loading/error/offline, intro/step, desktop sidebar and row/menu action ownership, safe open/close interactions and handler regressions.
- [x] 3.3 Verify route sheet/current point, answer draft/focus and reading anchor during portrait/landscape resize.
- [x] 3.4 Run final OpenSpec validation before archive; update completion only from actual evidence.

## 4. Offline navigation repair found in production

- [x] 4.1 Record actual tablet hit-test evidence, shared bottom-owner design, rejected options, native boundary and rollback before code.
- [x] 4.2 Integrate web network status with ordered bottom reserves, independent critical priority, short-window navigation protection, dock/menu coexistence, correct dismissal and cleanup; use the same reserve in quest web reading padding and automatic answer reveal.
- [x] 4.3 Run targeted reserve/status/install/quest regressions, static checks and strict spec validation under the coordinated source slot.
- [x] 4.4 Complete fresh independent review-and-fix and the final code-review gate for the full task diff.
- [x] 4.5 Commit/push, deploy the exact reviewed app SHA, and accept offline header/dock/More, notice coexistence and final reading-action reachability with screenshots and console evidence.

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
- Confirmed repair requirement (supersedes the initial outside-scope classification): `components/ui/NetworkStatus.web.tsx` places its offline banner at fixed top 0 with z-index 9999, covering the 54 px header in the captured offline fixture. The baseline narrow header was already 54 px, but the new tablet composition exposes this overlap at 960px too. Body route navigation and bottom navigation remain visible; that does not make the covered header More acceptable. Repair its shared placement before final acceptance.
- No answer submission, progress reset, authored quest text or media changes. The offline and bundle-abort cases are local browser fault fixtures; their expected failures are separate from normal production network health.

## Final repair and acceptance receipt (2026-10-24)

- Reviewed, pushed and deployed application SHA: `c6c628b87b31b4f4137f385b25dc8f5f9765ef9f`. The preceding pending checks above are historical; their completed narrow follow-up is recorded in ignored `pending6b/acceptance-summary.json`: route-sheet/current-point continuity, actual retry recovery, authenticated consent-off H1/back and visible wide catalog exit, plus prefixed EN→PL navigation passed on `6b84b69156ec635be910eb4e48832c755b917aa8`. These unchanged cases were retained rather than rerun.
- Independent review-and-fix and the final 40-path code-review gate passed, with no remaining findings. Latest applicable unit evidence is composed, not one all-green run: 47 unchanged r1 suites / 779 tests, eight r2 suites / 109 tests, one corrected AppInstall suite / 10 tests, and one corrected NetworkStatus suite / nine tests; total 57 suites / 907 tests, including 32 i18n suites / 539 tests. Raw failed fixture runs remain in the artifacts. Scoped ESLint, `tsc --noEmit`, header/actions/locale-number-format guards, prompt audit, strict OpenSpec and task diff check exited 0. Exact commands and frozen hashes: ignored `offline-review-final-receipt.json` and `offline-review-r4-receipt.json` under `.codex-temp/quest-language-row/`.
- Explicit-path commit and `PREFLIGHT_SKIP_E2E=1 git push origin main` completed with actual code-level hook passes, no concurrency SKIPPED. Canonical `DEPLOY_QUIET=1 scripts/deploy-prod.sh c6c628b87b31b4f4137f385b25dc8f5f9765ef9f` exited 0 in 533 seconds. Public readiness, exact SHA and health/root/API 200 passed; post-deploy SEO checked 31 pages with zero errors/warnings, media checked 429 articles with zero errors.
- Exact-SHA browser acceptance passed: all seven required sizes in both themes (14 normal cases), zero normal console/page errors, the same pinned-top measurements in the table above, reachable 44px header controls and the wide sidebar. At the screenshot size 718×735 the pinned top is 54px / 7.35%. Both runtime runs verified the public SHA and all 40 current/reviewed Git hashes before and after.
- Offline at 960×640, 844×390, 390×844 and 1440×900 retained draft, input/reading-host identity, focus and current point; compact header/dock More, status restoration and reconnect cleanup passed. The final enabled reading-host privacy link and quest answer CTA were reachable above the status at all four sizes without activation. The first harness wrongly scrolled the entire host while targeting the first card; its exit 1 remains recorded. The authorized tail-only correction exited 0, four of four sizes passed.
- Pending consent/install fixtures at 390×844 and 600×320 passed: network dock gap 8px, effective reserve 132px, More reserve 0, lower notices hidden with saved state unchanged, restored exit/offline-again priority and subsequent lower-notice return. No server writes were sent. Fixed-offline RU→EN updated the same network-banner DOM node without a connectivity transition; reviewed compiler-driven unit coverage verifies all five locales.
- A single local response fixture used the real RU bundle (200, `content_locale=ru`) with EN UI: passive fallback notice present, zero language-version rows, unchanged 54px header / 106px pinned top. Its guarded routing POST was deliberately blocked before forwarding; the resulting `ERR_BLOCKED_BY_CLIENT` remains an expected injected fault, not normal health or a zero-console claim. This fixture does not claim an untranslated production quest exists.
- Final browser receipt/screenshots: ignored `.codex-temp/quest-language-row/bottom-chrome-c6c628b87b31/acceptance-summary.json`. Original runtime wrapper 84869 exited 1; tail-only wrapper 87593 exited 0. The composed verdict is PASS, and all runtime/quality locks were released. Keyboard suspension and fresh-answer automatic reveal use reviewed source/unit evidence; no physical keyboard, answer submission, destructive menu action, progress/consent/install write or native build was performed. No whole-page CLS/FCP or absolute first-paint claim.
