## Why

Candidate 13 uses React Native 0.86.0 / Hermes 250829098.0.14, affected by the upstream memory regression when importing Reanimated/Worklets. The corrected App Review candidate must use the supported SDK 57 patch family and reject obsolete architecture configuration.

## What Changes

- Align installed SDK 57 dependencies and native Pods to Expo 57.0.30 / RN 0.86.3 / Hermes 250829098.0.17.
- Preserve and rebase existing web chunk, Android edge-to-edge and Android 16 image blur safety patches.
- Remove the obsolete Expo newArchEnabled schema field while enforcing SDK 57 New Architecture through native configuration.
- Synchronize candidate build 14 and reject stale build 13 source/artifact metadata.

## Capabilities

### New Capabilities

- `sdk57-release-parity`: Release guard enforces the supported SDK dependency/native architecture family.

### Modified Capabilities

None.

## Impact

Task #2446 dependency correction for #1940 release, linked #2138/#2137. Platform impact: shared desktop/mobile web, Android, iPhone/iPad dependencies; no Android store release. Localization impact: none. Performance/security: corrected Hermes runtime, preserved privacy and safety patches. No API/data, SEO, accessibility, analytics or UI contract changes. No fallback/mock substitutes for exact candidate acceptance. Dependencies: supported npm packages/Pods, independent source review, exact IPA and TestFlight QA. Non-goals: SDK 58, Xcode 27, worklets bundle mode, renderer replacement, storefront release. Rollback restores only owned paths and does not make affected candidate 13 shippable.
