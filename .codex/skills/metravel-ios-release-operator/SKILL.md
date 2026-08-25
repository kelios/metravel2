---
name: metravel-ios-release-operator
description: "Prepare, build, upload, or release an authorized metravel iPhone candidate through TestFlight/App Store. Use for signing, version/build, processing, compliance, review, or storefront; each mutation needs separate authorization."
---

# Metravel iOS Release Operator

Use this skill for the release/deploy portion of the active iPhone-first App
Store work. It does not implement product features.

`AGENTS.md` is inherited. For the one authorized stage, load
`docs/RELEASE.md#ios--app-store-active-iphone-scope` (including `iOS credential
map`), `docs/WORKFLOW_OPERATIONS.md#321-ios-testing-and-release-operations`, the
relevant `docs/IOS_OWNER_GUIDE.md` section, the assigned release contract, and
current App Store Connect evidence. Load OpenSpec artifacts only when they
define that stage's acceptance.

## Independent Authorization Gates

Never infer one gate from another:

1. **Signed distribution build:** requires an explicit request to create the
   production/TestFlight candidate.
2. **App Store Connect upload/TestFlight mutation:** requires an explicit request
   to upload or assign the processed build.
3. **Submit to App Review:** requires the owner's explicit final release decision
   for the exact accepted build and store record.
4. **Storefront release/phased release:** requires a separate explicit decision
   after Apple approval when the configured release mode can affect users.

Local read-only preflight and source/archive inspection do not mutate store state.

## Fail-Closed Preconditions

- Work only from the canonical `main` source state and apply the operation gate
  before Xcode, EAS, archive, upload, or submission commands.
- Resolve the exact iPhone bundle identifier, marketing version, increasing
  build number, signing team/profile, entitlements, privacy manifest, production
  API origin, encryption/compliance state, and App Store Connect app record.
- Do not use placeholder Apple IDs, Team IDs, App Store IDs, credentials, dev
  server addresses, or an archive whose source revision cannot be identified.
- Follow the canonical iOS credential map in `docs/RELEASE.md`: load the
  protected App Store ID only from `.secrets/metravel-ios-upload.env` without
  printing it; keep the `APP_MANAGER` App Store Connect API private key in
  EAS-managed credentials/Apple; never copy it to `.p8` or `credentials.json`.
  Creating, replacing, or deleting that persistent API key requires explicit
  owner authorization separate from an ordinary upload.
- `scripts/ios-build.sh` and `scripts/ios-submit.sh` are the canonical hardened
  path: both are non-interactive, both run `node scripts/ios-release-guard.js`
  first, and both fail closed without the matching environment authorization
  (`IOS_SIGNED_BUILD_AUTHORIZATION=1` for `preview`/`production` builds,
  `IOS_UPLOAD_AUTHORIZATION=1` plus an explicit build id for upload). Build and
  upload are separate commands; neither submits to App Review or releases a
  storefront version, and `IOS_AUTO_SUBMIT_FORBIDDEN` in the guard keeps
  `--auto-submit` out of the repository. Setting an authorization variable is
  itself an owner-authorized act — never export one to unblock yourself.
- Run the read-only checks before any gated command: `npm run ios:release:guard`
  (identity, version/build parity across Expo/plist/Xcode, entitlements, purpose
  strings, privacy manifest, production origins, placeholder and tracked-secret
  detection, EAS pinning) and `npm run ios:environment:check` (Xcode/SDK,
  eligible iPhone simulator destination, Pods state) when the local toolchain is
  involved. The EAS CLI version is pinned inside the scripts — do not float it.
- Treat source config and the signed IPA as two different evidence layers. A
  green source guard does not prove what Xcode/EAS embedded. Before every
  upload, resolve the exact authorized EAS build id, verify its status/profile,
  version/build/source revision, download its protected IPA into the ignored
  submit runtime, and run `npm run ios:artifact:audit -- PATH_TO_IPA`. The audit
  must inspect the compiled `Info.plist` (including iOS `MinimumOSVersion` and
  all sensitive-API purpose strings), localized purpose strings, privacy
  manifest, embedded production bundle, provisioning, code signature, and
  signed entitlements. `scripts/ios-submit.sh` performs this automatically and
  must stop before transport on any mismatch.
- Derive the purpose-string inventory from app code plus linked native SDKs,
  not only from permissions intentionally requested by JavaScript. When a
  linked dependency references a protected framework (for example
  `expo-location`/Reanimated code referencing CoreMotion), retain Apple's
  required purpose key even when the product flow does not actively request
  that permission. Any dependency or native SDK change reopens this inventory.
- Pin/verify the EAS CLI and Apple/Xcode upload requirements at execution time.
  If the approved EAS image cannot meet Apple requirements, use only the
  explicitly selected local Xcode archive plus Apple-supported upload fallback.
- Never print Apple passwords, 2FA codes, Team ID, UDID, `.p8`/`.p12`, private
  keys, provisioning profiles, API keys, reviewer credentials, or token values.

## Release Flow

1. Inspect branch/status, active release task, authorizations, competing locks,
   Apple/account prerequisites, and the latest used build number.
2. Confirm the accepted code/review/QA gates and exact production inputs.
3. Under signed-build authorization, create and inspect the exact signed IPA;
   record source revision, bundle/version/build, Xcode-derived minimum OS,
   sensitive-API purpose strings, signing, entitlements, privacy, embedded
   configuration, and artifact identity without secrets. Do not call the
   candidate upload-ready until `ios:artifact:audit` passes.
4. Under upload authorization, upload once, wait for processing without issuing
   duplicate uploads, reuse the project-bound EAS API key, answer only approved
   compliance fields, and record the exact processed build and App Store
   Connect state.
5. Hand that build to `$metravel-ios-tester`; release defects require a higher
   build number and a complete repeated candidate gate.
6. Under final submit authorization, select only the accepted build, verify
   metadata/privacy/screenshots/reviewer data, submit to App Review, and record
   the resulting state. Do not report Apple approval or public availability
   before App Store Connect shows it.

## Output Contract

Report requested gate, authorization received, source revision, version/build,
artifact and signing checks, commands/actions performed, TestFlight/App Store
state before and after, QA linkage, remaining owner actions, and residual risk.
