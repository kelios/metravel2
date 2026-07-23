---
name: metravel-android-portable-builder
description: Build and verify MeTravel Android debug APKs or signed production AABs on macOS, Windows, or Linux from the portable gitignored .secrets bundle. Use when a user asks to build Android on a new/different computer, avoid macOS Keychain setup, diagnose missing JDK/Android SDK/signing files, or make the local Gradle build reproducible without EAS.
---

# MeTravel Android Portable Builder

Build Android locally without EAS and without asking the user to remember or
retype signing passwords. Treat Play submission as a separate explicit task for
`$metravel-google-play-operator`.

Read `AGENTS.md`, `docs/RULES.md`, `docs/RELEASE.md`,
`docs/PRODUCTION_CHECKLIST.md`, and `docs/ANDROID_OWNER_GUIDE.md` before a
production build.

## Portable secret contract

Expect these gitignored files at the repository root:

```text
.secrets/metravel-android-release.json
.secrets/metravel-android-upload.jks
.secrets/metravel-android-prod.env
.secrets/google-play-service-account.json
```

The first three are required for a production AAB. The service account is
required only for Play API operations. Never print, inspect, screenshot, commit,
or paste their contents into chat.

If the portable bundle does not exist on the known working Mac and the user has
explicitly asked to create it, run:

```bash
npm run android:release:export-secrets
```

This may read the legacy macOS Keychain once and writes only to `.secrets`.
Afterwards, another workstation needs the copied `.secrets` files, not Keychain
entries or manually entered passwords.

## Build workflow

1. Confirm branch `main`, inspect `git status --short`, and apply the Android
   build operation gate from `AGENTS.md`.
2. If dependencies are absent, install the pinned Node/Yarn dependencies from
   the repository without changing lockfiles.
3. Run the cross-platform preflight:

   ```bash
   npm run android:release:doctor
   ```

   It detects supported Node, JDK 17-21 and Android SDK installations, validates
   the keystore without exposing its password, and reports exactly which secret
   file or tool is missing.

4. For a signed production artifact, run:

   ```bash
   npm run android:build:prod
   ```

   For a debug APK, run `npm run android:build:dev`.

5. Require the agent output to confirm artifact verification. Production output
   is `android/app/build/outputs/bundle/release/app-release.aab`; debug output is
   `android/app/build/outputs/apk/debug/app-debug.apk`.
6. Record source commit, app version/versionCode, artifact path, machine/OS,
   checks, and any exact toolchain blocker. Do not claim a Play release or mutate
   tracks from a build-only request.

## Safety

- Never use Android EAS/cloud build or submit.
- Never generate a replacement upload key merely because a new workstation is
  missing `.secrets`; copy the existing bundle from the working machine.
- Never fall back to the debug signing key for a production build.
- Never change `alpha`, `internal`, `beta`, testers, countries, or production as
  part of this build-only workflow.
- macOS Keychain is a legacy source fallback, not a requirement on another
  computer.
