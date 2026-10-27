## 1. Implementation

- [x] 1.1 Add safe app handoff URLs and Safari static/SSG metadata for supported current routes.
- [x] 1.2 Extend existing mobile bar with localized Open/Install actions, seven-day dismissal and no permanent store-click suppression.
- [x] 1.3 Stack measured app/consent panels through the existing owner registry without self-feedback.

## 2. Code validation and review

- [x] 2.1 Run focused route/state/component/reserve/HTML tests, scoped lint/typecheck, external link guard and test:i18n.
- [x] 2.2 Complete independent full-diff review-and-fix and final review gate.
- [x] 2.3 Validate OpenSpec change strictly.

## 3. Testing after review

- [x] 3.1 Check production desktop absence and mobile 320/390px first visit, cookies, menu, actions and dismissal with screenshots/console in all current locales.
- [x] 3.2 Check Safari on the iPhone simulator selected by the owner: explicit Open reaches native Quests; Install dispatches the official App Store URL. Physical Smart App Banner, real App Store UI and absent-app behavior are not certified by this layer.
- [x] 3.3 Verify physical Android Chrome installed-app handoff (cold Quests and warm Community) and explicit Install opening the correct Google Play listing.
- [ ] 3.4 Certify Android Open fallback with MeTravel unavailable on a Google Play-capable test device. The bounded read-only AVD attempt did not navigate; its configuration disables Play Store. Exact Chrome 124 source supports a missing-market-handler explanation, but the guest package absence was not directly queried. This remains UNPASSED, not a website failure diagnosis or a runtime pass.

## Verification record — 2026-10-20

Production executable source is `7370daf7e99f3fb2da337cc8a1109333dda25332`, deployed by `DEPLOY_QUIET=1 scripts/deploy-prod.sh 7370daf7e99f3fb2da337cc8a1109333dda25332` (exit 0, 616 s). Public `.build-source.json` matched that clean SHA; health, root and travels API returned 200. This closeout is documentation only and does not require another frontend build.

Independent full-task review and final gate passed. The follow-up layout fix also passed independent review and the final gate: intrinsic action widths preserve the complete Install label at 320px; fixed viewport positioning aligns the app panel with the existing fixed consent panel and dock. Mechanism: `components/layout/AppInstallBar.tsx:170`. No fixed cookie-height guesses or global viewport-height changes were added.

Code-level evidence: scoped ESLint/typecheck, external-link/bottom-chrome/touch-target/web-deferred-loading guards, `npm run test:i18n`, strict OpenSpec validation and required precommit/prepush checks passed. Full Jest retained its raw result: 1880/1881 suites passed, 21544 tests passed and two fixture failures. The only failing suite's mutable mock fixture was corrected without executable changes and then passed 7/7; the other nine relevant suites passed 171 tests. Resolved task coverage is 10 suites/178 tests. The full raw run is not relabeled green. Evidence: `.codex-temp/mobile-app-handoff/fixture-resolution.json` and `review-report.json`.

Production browser acceptance used a disposable, unauthenticated context, exact deployed SHA and real screenshots. The final quality-locked probe covered RU/BE/UK/PL/EN at 320px and Android 390px dark: complete labels, cookie/app separation, menu hide/restore, explicit link destinations, no automatic app launch, seven-day dismissal surviving reload and a single correct Safari metadata tag all passed; no console/page errors. Desktop absence was also verified in the preceding seven-case pass; that initial pass's two visual findings were preserved and fixed, not relabeled successful. Command: `node scripts/run-with-quality-gate-lock.js mobile-app-handoff:final-layout-browser -- node .codex-temp/mobile-app-handoff/browser-probe.cjs`. Evidence: `.codex-temp/mobile-app-handoff/narrow-retest/browser-result.json`, screenshots and `layout-browser-final.log`.

Physical Pixel 10 Pro / Android 17 / Chrome proved explicit Open to native Quests from a cold app with the exact incoming path/query, warm Open to Community in the same native process, and explicit Install to Google Play package `by.metravel.app`. Native log capture had no fatal matches. The warm query's native effect was not separately observable. Consumer: existing release app 1.0.5/versionCode 24, native source SHA unknown; it is not claimed to be built from the frontend SHA. Read-only `npm run android:play:status` confirmed completed version 24 in alpha/internal/production, beta empty; its temporary edit was deleted. Evidence: `android-physical-result.json`, `android-play-status.log` and `android-qa-report.md` under `.codex-temp/mobile-app-handoff/`.

The owner explicitly selected simulator testing for iPhone. Safari on the dedicated iPhone 17 Pro / iOS 26.5 simulator showed the offer and actual Open gesture/OS confirmation reached native Quests. Install dispatched `apps.apple.com/app/id6801264369`, then the simulator could not complete its Store redirect; real Store UI is unverified. Consumer: existing embedded app 1.0.5/build 14, native source/API origin unattested and separate from the web SHA. No Metro, new helper, native build/sign/install or explicit app activation was used to manufacture the handoff result. iOS query behavior was not observable. The final 7370 Safari retest confirmed the entire consent caption, all cookie/app actions and clear separation from each other and the dock; actual PageDown movement and PageUp return preserved those bounds. A final real Open gesture at the corrected button position again reached native Quests. The expanded Safari toolbar was observed; genuine collapsed-toolbar/re-expansion geometry remains unverified because the bounded UI inputs did not produce that browser state. The dedicated simulator was shut down and its lease released at 12:54:41Z. Evidence: `ios-simulator-report.json` and `ios-sim-7370-*.png` under `.codex-temp/mobile-app-handoff/`.

Safari system Smart App Banner metadata is present in static/SSG output and updates for client navigation, but its physical UI and app-absent branch remain unverified after the owner's simulator selection. Android automatic unavailable-app fallback also remains unverified as recorded in 3.4. Both platforms always retain an explicit Install action; production browser tests do not claim native OS behavior. No app uninstall/offload, store build/upload/release, backend or protected native configuration change was performed.

Primary implementation paths: `components/layout/AppInstallBar.tsx`, `components/layout/ConsentBanner.tsx`, `utils/mobileAppHandoff.js`, `utils/incomingAppLinkPolicy.js`, `utils/externalLinks.ts`, `utils/bottomChromeReserve.ts`, `app/+html.tsx`, the former static SSG generator (removed in #2766), shared app identity/constants and five localized string files, plus focused tests. Full task path manifest: `.codex-temp/mobile-app-handoff/source-manifest.json`.
