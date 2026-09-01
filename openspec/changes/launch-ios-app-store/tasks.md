## 1. Environment and Apple gates

- [x] 1.1 Reuse board task `#957` with current `xcodebuild -showdestinations` evidence, restore eligible iPhone and iPad simulators for Xcode 26, and add a preflight that detects Expo/Xcode runtime drift before native work.
- [ ] 1.2 Complete the separate owner task for Apple Developer/App Store Connect access, current agreements, team identifier, explicit `by.metravel.app` App ID, capability choices, signing authority, and physical iPhone/iPad access for agent-driven capability and tablet acceptance without placing credentials in Git or board text.
- [ ] 1.3 Complete the separate backend task for `POST /api/user/apple-login/`, Apple identity-token verification, stable-subject account linking, private-relay handling, standard MeTravel session response, collision/error codes, and deletion/revocation behavior; record deploy-target API evidence.
- [ ] 1.4 Complete the separate website/backend/ops dependency that serves a valid Apple App Site Association document for `metravel.by` and the registered Apple team/bundle identity, with HTTPS content and route coverage evidence.

## 2. Universal iPhone and iPad release foundation

- [x] 2.1 Reconcile `app.json`, tracked Xcode build settings, bundle identity, device-family intent, display name, URL schemes, marketing version, increasing build number, deployment target, and production API configuration; add a deterministic parity check.
- [ ] 2.2 Audit and reconcile `Info.plist`, entitlements, Associated Domains, APNs, Sign in with Apple, purpose strings, background modes, encryption declaration, `PrivacyInfo.xcprivacy`, app icon, and splash assets; remove capabilities without a launch use case.
- [ ] 2.3 Pin a current supported iOS build/upload toolchain and replace placeholder App Store identifiers through approved secret/config inputs, then prove a clean local simulator build without a development-server dependency or secret/placeholder leakage.
- [ ] 2.4 Add focused configuration and native-governance tests for bundle/version/device-family parity, valid plist/privacy files, required universal Apple mobile release assets, production URL resolution, and forbidden development/store placeholders.
- [ ] 2.5 Expand the release target to universal device family `1,2`, declare adaptive iPad portrait/landscape orientations, and prove full-screen plus resizable-window launch on iPad Simulator without fixed iPhone compatibility framing.

## 3. Authentication, storage, locale, and accessibility

- [ ] 3.1 Implement the native Sign in with Apple control and credential adapter in the existing login and registration surfaces, including cancellation, first-authorization name/email, private relay, returning-user, conflict, and temporary failure states.
- [ ] 3.2 Integrate the Apple server response into the existing auth store and SecureStore path; prove sign-in, sign-out, token refresh/expiry handling, cold-restart persistence, and no partial credential state after failure, linked to AUTH-001/`#923/#810`.
- [ ] 3.3 Localize all new auth, native error, permission, accessibility, and purpose-string copy in RU/BE/UK/PL/EN and verify locale selection is applied before launch-critical copy after a cold restart with `npm run test:i18n`.
- [ ] 3.4 Verify and fix safe-area, home-indicator, keyboard, Dynamic Type, VoiceOver, reduced-motion, focus order, contrast, and 44-point touch-target behavior in authentication and the shared app shell without changing the mobile-web/Android hierarchy.

## 4. iPhone and iPad product compatibility

- [ ] 4.1 Verify and fix cold/warm Universal Links for public travel, article, quest, map, and profile URLs through one validated route mapper; reject untrusted/malformed links and prove the production association file and in-app destination together, linked to `#1047`.
- [ ] 4.2 Verify and fix map, place-card, location, navigation, quest-map, route, WebView bridge, denial fallback, and offline behavior on iPhone while reusing `#202/#905/#926` and preserving mobile-web/Android map semantics.
- [ ] 4.3 Verify and fix travel/article/quest media selection, camera/photo denial, HEIC/HEIF upload, gallery ordering/delete/swipe, sharing, PDF/route export, and cleanup; reuse backend contract `#1159` and reopen the exact physical gallery validation `#777`.
- [ ] 4.4 Configure and verify notification permission timing, APNs entitlement/credential, token registration/update/removal through existing endpoint `#39`, foreground/background handling, local quest reminders, and one real production/TestFlight delivery.
  - [x] 4.4a Complete the repository code/config slice: explicit permission UI, passive lifecycle sync, production APNs source/config guards, token rotation/logout integration, validated notification routes, privacy declaration, and focused regression tests (`#1417`).
  - [ ] 4.4b After backend `#1680/#1681`, code review, and an authorized signed candidate, verify the provisioning-profile/signed-entitlement parity plus real foreground/background/cold-start TestFlight delivery on a physical iPhone.
- [ ] 4.5 Run the launch-critical iPhone and iPad simulator matrix for guest/auth flows, discovery/search, travel/article/quest details, maps, profile/settings/account deletion, five locales, portrait/landscape/window resize, offline/slow/error states, and cold restart; file concrete defects instead of broad duplicate tickets.

## 5. Shared regression and review gates

- [ ] 5.1 For every changed shared consumer, run targeted Jest/native compatibility/governance/security checks plus the affected desktop-web browser scenario and paired mobile-web/USB-installed Android scenario in the same locale and state.
- [ ] 5.2 Run `npm run check:fast` after each finished code block and `npm run check:preflight` before the release candidate, plus any domain gates triggered by touched travel slider/media/map paths; do not duplicate an active quality gate.
- [ ] 5.3 Pass the complete task diff and validation evidence through `$metravel-code-reviewer` in review-and-fix mode with an independent `review-auditor`, fix confirmed findings, re-review the final diff, and repeat affected checks.
- [ ] 5.4 Validate the OpenSpec change with `openspec validate launch-ios-app-store --type change --strict` and `openspec validate --all` before final archive readiness.

## 6. Signed candidate and TestFlight

- [ ] 6.1 After explicit production-build authorization, create the signed universal iPhone/iPad candidate with the selected canonical release path and record source revision, device family, bundle/version/build, signing/entitlements/privacy validation, archive inspection, and App Store upload processing without exposing secrets.
- [ ] 6.2 Complete TestFlight beta information, export-compliance answers, internal group assignment, test focus, feedback contact, and any required beta review; confirm the exact processed build is available to testers.
- [ ] 6.3 Run the full physical-iPhone TestFlight matrix plus iPad window/layout acceptance on the exact candidate: fresh install/update, full-screen and resized windows, portrait/landscape, guest/auth/Apple login, session restart, links, map/location, HEIC/gallery, share/export, notifications, permissions, five locales, accessibility, offline recovery, account deletion visibility, crashes, hangs, logs, and production network targets.
- [ ] 6.4 Return release defects to `in_progress`, produce a higher build number, and repeat archive, processing, and physical-device gates until one candidate has no open launch-blocking finding.

## 7. Store record and App Review

- [ ] 7.1 Prepare and owner-approve App Store name, subtitle, description, keywords, category, copyright, support and privacy URLs, availability, price, DSA/trader information, content rights, and updated age-rating answers; use RU primary plus RU/BE/UK/PL/EN localizations where supported.
- [ ] 7.2 Capture truthful localized iPhone and iPad screenshots from the accepted candidate for required device sizes and verify that store claims, screenshots, app icon, window geometry, and permission explanations match runtime behavior.
- [ ] 7.3 Reconcile final App Privacy answers with the candidate binary, embedded third-party SDK manifests, permissions, analytics/tracking behavior, account deletion, privacy policy, and data handling; block submission on any mismatch.
- [ ] 7.4 Prepare App Review contact, notes, non-expiring demo account, login instructions, export-compliance result, selected accepted build, and manual/automatic release choice in protected App Store Connect fields.
- [ ] 7.5 After an explicit owner go/no-go decision for the final external action, add the accepted build for review, submit it to App Review, and record the resulting accepted review-queue state; route an invalid-binary, metadata, compliance, or review rejection back to its owning task.
