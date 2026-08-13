## Context

See [proposal.md](proposal.md) for the release motivation and the two capability specs for observable behavior.

The repository already contains a tracked Expo/Xcode iOS scaffold, CocoaPods state, an app icon, splash assets, `PrivacyInfo.xcprivacy`, Associated Domains, SecureStore, localization, notifications, Google/Facebook login, native map/WebView renderers, media pickers, sharing, and account deletion. It is not yet a coherent release target:

- `app.json` declares `by.metravel.app`, version `1.0.5`, build `1`, tablet support, and the `metravel.by` associated domain.
- the tracked Xcode project still declares `com.yourcompany.metravel`, marketing version `1.0`, build `1`, and device family `1,2`;
- `eas.json` contains placeholder App Store Connect identifiers;
- purpose strings are English-only and the target retains background location and always-location declarations that need product justification;
- Sign in with Apple is disabled while native Google/Facebook login exists;
- Xcode 26.6 is installed, but `xcodebuild -showdestinations` currently rejects every destination because the project requests an unavailable iOS 26.5 runtime, contradicting the completion evidence in board task `#957`;
- the App Store currently requires uploads built with Xcode 26 or later and an iOS 26 SDK, valid privacy manifests for applicable SDKs, a complete privacy disclosure, and required App Store Connect metadata.

Backend code is a read-only dependency in this workspace. The Apple-auth endpoint and any server-side token, relay-email, account-linking, or revocation work belong to a separate `area=back` board task.

## Goals / Non-Goals

**Goals:**

- Establish one auditable configuration chain from Expo metadata through the native target and App Store Connect.
- Reuse existing shared UI/services while isolating only real iOS API, inset, lifecycle, signing, or renderer differences.
- Give implementation and release tasks explicit dependency gates so Apple account work, backend auth, device QA, store metadata, and submission cannot be mistaken for one coding task.
- Validate a production-configured binary first on simulator/local device where possible, then as the exact distributed TestFlight build.
- Keep secrets, private keys, App Store credentials, and reviewer credentials out of tracked files and task text.

**Non-Goals:**

- Replace the current Expo/React Native architecture or regenerate native projects blindly.
- Build an iPad-specific product in this release.
- Introduce a second product hierarchy for iPhone; platform files may adapt APIs, engines, insets, shadows, and permissions only.
- Use mocks as evidence for Apple services, signing, APNs delivery, Universal Links, physical-device behavior, TestFlight processing, or App Review state.
- Edit backend source from this checkout.

## Decisions

### Make v1 explicitly iPhone-only

Set the Expo tablet flag and Xcode target family to iPhone only, then keep the existing responsive shared screens within iPhone safe areas. This matches the user's requested surface and avoids adding iPad screenshot, multitasking, landscape, and layout acceptance to the first submission.

Alternative considered: ship the current universal target because `supportsTablet` and device family `1,2` already exist. Rejected because those values are scaffold defaults without iPad runtime evidence and would silently enlarge the Store and QA contract.

### Treat Expo configuration as intent and verify the tracked native result

Update the protected configuration only inside the explicitly scoped foundation task, then reconcile the tracked `ios/**` values deliberately. Verification compares resolved Expo config, Xcode build settings, archive metadata, entitlements, URL schemes, permission strings, and privacy manifests. A prebuild helper may be used only after inspecting its diff; a destructive clean prebuild is not the default because the repository contains deliberate Podfile and native recovery work from `#957`.

The foundation gate fails on placeholder identities, divergent version/build values, unapproved device families, missing capabilities, or an ineligible simulator destination.

Alternative considered: edit only the generated Xcode project. Rejected because a later prebuild would reintroduce drift. Alternative considered: delete and regenerate `ios/`. Rejected because it can erase scoped CocoaPods and native fixes and creates an unreviewable release diff.

### Use local Xcode for development evidence and the existing EAS iOS route for the signed distribution candidate

Local Xcode 26 is the fast feedback path for simulator compilation, native lifecycle checks, and a physical development build. The existing iOS EAS profiles remain the intended signed distribution route, but production build and submit commands run only in their dedicated release tasks after explicit authorization, valid Apple credentials, current Xcode/SDK support on the selected EAS image, and a clean release gate.

The production task records the source revision, Expo/EAS project, version, build number, bundle ID, processed App Store Connect build, and TestFlight group without printing credentials. If EAS cannot satisfy the current Xcode/SDK requirement, the bounded fallback is a local Xcode archive plus Apple-supported upload/Transporter; the task must select one canonical path and remove ambiguity before the first candidate.

Alternative considered: rely on simulator builds until final submission. Rejected because signing, embedded production configuration, entitlements, APNs, and App Store processing are observable only in a distribution build.

### Add Apple authentication through the existing session contract

The frontend requests Apple name/email scopes and sends the result to a new server contract analogous to the existing Google/Facebook login boundary:

```json
POST /api/user/apple-login/
{
  "identity_token": "string",
  "authorization_code": "string | null",
  "given_name": "string | null",
  "family_name": "string | null"
}
```

Success returns the existing native session shape: `token: string`, optional `refresh: string`, `name: string`, `email: string`, `id: string|number`, and `is_superuser: boolean`. The backend verifies signature, issuer, audience, expiry, nonce when used, and stable Apple subject; it stores the subject/account link, accepts Apple's first-authorization-only name behavior and private relay email, prevents unsafe account collision, and defines revocation/deletion handling. Stable error codes cover missing/invalid token, conflict, disabled provider, and temporary provider failure.

The iOS UI uses the platform-appropriate Apple button and passes the returned MeTravel session through the existing auth store and SecureStore path. No Apple private key, client secret, or token verification logic is placed in the app.

Alternative considered: hide Google/Facebook on iOS and keep only email/password. Rejected because it removes existing native account choices and creates parity/account-access problems. Alternative considered: verify Apple tokens in the client. Rejected because it cannot establish a trusted MeTravel session or protect server account linking.

### Minimize capabilities before declaring privacy behavior

Audit actual release flows against `Info.plist`, entitlements, embedded SDK manifests, `PrivacyInfo.xcprivacy`, and App Store privacy answers. Request notification, location, photo, camera, microphone, and biometric access at the feature boundary, not at launch. Remove always/background location, microphone, tracking, or another capability if the release cannot demonstrate the corresponding user value and denial recovery.

APNs reuses the deployed push-token API from `#39`; the new work is Apple credentials/capability, native token registration, production delivery, permission timing, and revocation/update behavior. HEIC/HEIF reuses backend contract `#1159`; a new backend ticket is created only if independent production evidence shows a different server defect.

Alternative considered: retain every scaffolded purpose string and capability “for later.” Rejected because Apple review and privacy declarations must describe the submitted binary, not a future roadmap.

### Keep one shared route model for links, maps, storage, and localization

Universal Links feed the same validated route mapping used by Expo Router and the existing Android App Links work in `#1047`. Cold and warm lifecycle handlers share the mapping and reject untrusted hosts. The associated-domain entitlement and the production AASA response are validated together.

Map/place/quest behavior reuses `#202`, `#905`, and `#926`; iOS-specific files may adapt the WebView bridge or system navigation but not card hierarchy or tap semantics. Native credentials remain in SecureStore/Keychain through `utils/secureStorage.ts`, linked to the AUTH-001 controls and `#923/#810` rather than creating an iOS-only auth store. Locale selection keeps the shared RU/BE/UK/PL/EN resource contract and is checked before the first meaningful frame after cold restart.

### Make TestFlight the release acceptance boundary

Unit and simulator checks can prove logic and basic native compilation, but the candidate is accepted only after the exact processed TestFlight build passes the physical-iPhone matrix. The matrix covers signed-out and signed-in cold start, session persistence, all authentication methods, travel/article/quest/map/profile/settings, gallery swipe (`#777`), HEIC upload, share/export, permission denial and grant, warm/cold Universal Links, notifications, account deletion discoverability, five locales, Dynamic Type/VoiceOver, offline/slow network, crash/hang evidence, and production API routing.

Shared changes also run targeted desktop web and paired mobile-web/Android controls. Findings that require code return their task to `in_progress`; waiting for TestFlight, device, or App Store processing remains `testing`.

### Separate owner-controlled Apple state from agent-owned implementation

Human tasks hold current agreements, legal identity, DSA/trader status, distribution countries, App ID/capability access, credential issuance, access to a physical iPhone, store copy approval, and the explicit final release decision. Agent tasks own repository changes, automated checks, build/processing evidence, screenshots, TestFlight QA, and the authorized submit operation. Dependencies use real board IDs and do not place credentials in the board.

## Affected frontend paths

- `app.json`, `eas.json`, `package.json`, approved iOS release/prebuild scripts, and tracked `ios/**` identity, plist, entitlement, asset, privacy, Pod, and project files.
- `components/auth/**`, `api/auth.ts`, `stores/authState.ts`, `stores/authStore.ts`, auth context/types, and focused tests for Sign in with Apple and secure session persistence.
- `utils/secureStorage.ts`, routing/link helpers, `services/notifications.ts`, native notification/geofence flows, media picker/gallery/share paths, and native map/quest renderers.
- `i18n/config.ts`, `i18n/resources.ts`, RU/BE/UK/PL/EN auth/native permission/error/accessibility resources, and native locale lifecycle tests.
- Release/QA documentation and ignored evidence directories; no reviewer credential or Apple secret is tracked.

## Data and API contract

Existing API DTOs and URLs stay unchanged except the separately delivered Apple-login endpoint described above. APNs/Expo push registration reuses `POST /api/user/push-token/`. Account deletion, media upload, travels, quests, maps, profiles, and public content continue to use their deployed contracts.

Frontend behavior is fail-closed: a missing Apple endpoint cannot become mock login; invalid AASA cannot be treated as a verified Universal Link; an APNs token without a delivered notification is not delivery evidence; a simulator screenshot cannot replace physical-device/TestFlight evidence.

## Security, privacy, accessibility, performance, SEO, and analytics

- **Security:** secrets remain in approved local/EAS/App Store credential stores; archive inspection checks placeholder and secret leakage; Apple tokens are server-verified; inbound links and WebView messages are validated; direct external-link APIs remain prohibited.
- **Privacy:** reconcile binary manifests, SDK behavior, permissions, privacy policy, account deletion, and App Store answers. App Tracking Transparency is introduced only if actual tracking remains and is declared; otherwise tracking-capable behavior is removed/disabled.
- **Accessibility:** verify VoiceOver reading order and names, Dynamic Type without clipping, reduced motion, color-independent state, keyboard avoidance, safe areas, and 44-point controls.
- **Performance:** capture dated cold/warm launch, crash/hang, map/WebView, memory, and network evidence on the TestFlight candidate. Shared media changes retain one-slot-one-URL and existing web performance gates.
- **SEO:** no public URL or metadata changes. Universal Links preserve public HTTPS behavior and cannot break desktop/mobile web routing.
- **Analytics:** retain only already governed analytics. No App Store launch event justifies undeclared tracking or a client secret.

## Risks / Trade-offs

- [The simulator runtime fixed in `#957` is unavailable again] → Reopen the canonical task with current `xcodebuild` evidence, restore one eligible destination, and add a version-agnostic destination preflight so the same failure is caught before native work.
- [Expo and Xcode configuration drift can reappear] → Add a focused configuration parity check and inspect every prebuild diff before accepting native output.
- [Apple authentication needs backend and portal state owned elsewhere] → Separate front/back/human tasks with hard dependencies and runtime evidence against the same environment.
- [EAS may lag Apple's Xcode/SDK upload requirement] → Verify the production image before spending a build; use the bounded local archive/Transporter fallback if needed.
- [Third-party SDKs may expand privacy declarations or trigger review requirements] → Audit the final dependency graph and archive, remove unused SDK capability where possible, and keep privacy answers synchronized.
- [A one-sprint date cannot control Apple review time] → Commit the sprint to accepted submission status, not approval or storefront availability; handle Apple feedback as follow-up work without falsifying the milestone.
- [iPhone-only scope may disappoint iPad users] → Make the target family and Store scope explicit; plan iPad support as a separate later capability with its own layout and screenshots.

## Migration Plan

1. Restore the canonical iOS development environment and create the Apple account/capability records without exposing secrets.
2. Reconcile identity, versioning, iPhone target, native configuration, permissions, and local simulator compilation.
3. Deliver the backend Apple-auth contract, then implement Apple login and secure-session integration.
4. Fix iOS runtime compatibility in bounded domain slices: shell/locales, links/maps/location, media/sharing/notifications, and privacy/accessibility.
5. Run focused automated checks plus simulator and shared-surface regressions; complete code-review-and-fix loops per task.
6. Create the first authorized signed candidate, upload it, and complete App Store processing/compliance fields.
7. Run the physical-iPhone TestFlight matrix, fix findings in new incremented builds, and freeze the accepted candidate.
8. Finalize localized store metadata/screenshots/privacy/reviewer data, obtain the explicit owner release decision, and submit the accepted build to App Review.

Recovery is incremental: reject a bad candidate and increment the build number; roll back the task-owned frontend diff on `main` if a shared regression appears; revoke/rotate compromised credentials in Apple/EAS without editing Git history; never resubmit a known-bad binary to work around a failed gate.

## Validation Matrix

| Surface | Required evidence |
| --- | --- |
| Configuration | Resolved Expo config, Xcode build settings, eligible destination, plist/entitlement/privacy validation, archive identity and no placeholders/secrets |
| Unit/integration | Native compatibility, auth/Apple adapter, SecureStore lifecycle, link parsing, notification/media error states, i18n and governance checks |
| iPhone simulator | Cold/warm launch, five locales, safe areas/keyboard, core navigation, permission denial stubs, no fatal console/runtime error |
| Physical iPhone | Local/release build for camera/photo/location/share/link/biometric behavior where applicable |
| TestFlight | Exact production candidate, session restart, core flow matrix, HEIC, gallery swipe, APNs delivery, Universal Links, offline/error recovery, crash/hang evidence |
| Desktop web | Targeted regression for every changed shared consumer, console/network clean |
| Mobile web + Android | Same impacted flow and locale as a paired control; Android uses a locally built and USB-installed app |
| Locales | RU/BE/UK/PL/EN runtime copy, native permission text, layout/accessibility, cold-restart persistence, store metadata |
| App Store Connect | Processed build, metadata/screenshots/privacy/age/support/reviewer fields, explicit owner release decision, accepted submission state |
