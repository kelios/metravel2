---
name: metravel-android-developer
description: Implement and debug Android/native compatibility in the metravel Expo React Native app. Use when Codex needs an Android developer role for native crashes, platform-specific files, Expo native modules, Android navigation, push notifications, SecureStore, permissions, native map behavior, local USB Android build/install verification, or web-first code leaking into the Android bundle. Do not run Android EAS/cloud or production builds without an explicit user request.
---

# Metravel Android Developer

Use this skill for Android/native implementation and debugging. The project is web-first, so native fixes must not regress production web behavior.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/NATIVE_COMPAT_RULES.md`
- `docs/DEVELOPMENT.md`
- `docs/MANUAL_TEST_CASES.md` for `AND-USB-*` verification after Android fixes
- Relevant feature docs, especially `docs/features/map.md` for map work.

## Scope

- Platform files: `.android.tsx`, `.native.tsx`, `.ios.tsx`, `.web.tsx`, and narrow `Platform.OS` gates.
- Android/native runtime: Expo modules, permissions, notifications, SecureStore, image picker/media, sharing, WebBrowser, navigation, and native-only app startup.
- Native map behavior: keep web Leaflet code out of native bundles and native map/WebView code out of web bundles.
- Native crash triage from a local Android build, `adb logcat`, or EAS logs only when that EAS build was explicitly requested.
- Android locale lifecycle: `expo-localization`, versioned locale preference,
  cold restart, RU/BE/UK/PL/EN resources, Intl/plural behavior, and translated accessibility text.

## Rules

- Do not fix native by changing shared web behavior. If structure, behavior, or dependencies diverge, split platform files and move shared logic into hooks/utils.
- Keep Android mobile UX visually and behaviorally aligned with mobile web and
  iOS. Platform files may solve native API differences, but must preserve the
  same layout, action order, hero proportions, and tap semantics.
- For map/place/travel-point surfaces, match the shared fullscreen point/place
  template and the marker-vs-card tap contract documented in `docs/features/map.md`.
- A one-line property difference may use a local `Platform.OS` gate; larger differences need platform-specific files.
- Guard web APIs (`window`, `document`, `localStorage`, `navigator`, DOM observers/events) inside effects/functions or move them to `.web` files.
- Chain dynamic imports only through `Promise.resolve(import(...))` when using `.then`, `.catch`, `.finally`, stored promises, or returned promises.
- Keep external navigation inside `utils/externalLinks.ts` helpers.
- Follow `$metravel-i18n-guardrails` for user-facing text. Shared/native copy
  uses the common resources; do not add Android-only hardcoded strings or manual locale formatting.
- Do not print secrets from `.env*`, EAS, Google Play, or device logs.
- Do not edit `app.json`, `eas.json`, `plugins/**`, or release scripts unless the user explicitly asks for build/config changes.
- Expo/EAS Android build credits are limited: do not run `eas build --platform android`, `npm run android:build:*`, `npm run build:all:*`, Android production builds, or Android submit commands unless the user explicitly asks for that exact Android build/submit in the current task.
- Android verification requires a locally built app installed on the USB-connected phone. Do not substitute mobile web viewport, Expo web export, EAS preview/development/production build, or dev-client/export flow without explicit user approval.

## Bug Intake

- Every real Android bug found during device QA must be created or updated on the shared task board in the current active sprint before implementation continues.
- Prefer the `ticket-board` MCP tools when available. If MCP/API returns `HTTP 401`, refresh the staff token through `.env.e2e` using `docs/TASK_BOARD_MCP.md`, update `.secrets/metravel-task-board.env` without printing secrets, and retry. If MCP remains unavailable but `.secrets/metravel-task-board.env` exists, use the task board API without printing the token.
- Use `area=front`, `status=todo`, `reporter=Codex Android QA`, and `assignee=metravel-android-developer` for newly confirmed Android app/frontend bugs. Do not use `area=android`; keep Android context in the title, description, validation, and assignee. Create `area=back` only when evidence shows a backend/API/server defect.
- Include device model, Android/API version, exact route, reproduction steps, `adb logcat`/Metro evidence, acceptance criteria, likely files, validation, and blockers.

## USB Local Build Smoke

Use this flow for Android testing over USB. The project is worked on from both Windows and macOS, so keep commands portable and provide both variants when documenting a workflow.
For QA coverage, pair this launch flow with `docs/MANUAL_TEST_CASES.md` `AND-USB-*` cases and `e2e/maestro/` flows when available.

1. Find `adb`.
   - Windows PowerShell: `where.exe adb`; fallback common local path: `D:\metravel\tools\platform-tools\adb.exe`.
   - macOS/zsh: `which adb`; fallback common SDK path: `$HOME/Library/Android/sdk/platform-tools/adb`.
2. Verify the phone.
   - Windows: `& 'D:\metravel\tools\platform-tools\adb.exe' devices -l`
   - macOS: `adb devices -l`
   - If status is `unauthorized`, confirm the RSA debugging prompt on the phone.
3. Check the operation gate before any build/install: no competing `gradlew`, `adb install`, `eas build`, `expo run:android`, full/preflight/e2e, or shared build process for the same target.
4. Build and install locally.
   - Windows PowerShell:
     ```powershell
     cd android
     .\gradlew.bat :app:installDebug
     ```
   - macOS/zsh:
     ```bash
     cd android
     ./gradlew :app:installDebug
     ```
   If `installDebug` is unavailable, build then install the APK:
   ```bash
   cd android
   ./gradlew :app:assembleDebug
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```
5. Launch the installed app and confirm it is the new build.
   ```bash
   adb shell am force-stop by.metravel.app
   adb shell monkey -p by.metravel.app 1
   ```
6. For deep-link checks, resolve the installed scheme before launch:
   ```bash
   adb shell dumpsys package by.metravel.app | grep -E 'Scheme:|MainActivity'
   ```
7. Capture health evidence without leaking secrets:
   ```bash
   adb logcat -c
   adb logcat -d -v time | grep -E "FATAL EXCEPTION|ReactNativeJS|AndroidRuntime|JSApplicationIllegalArgumentException|DevLauncher"
   adb shell uiautomator dump /sdcard/window.xml
   adb exec-out cat /sdcard/window.xml
   ```
   In PowerShell, use `Select-String` instead of `grep`.
8. Use dev-client/Metro only if the user explicitly approves that exception. Record the exception in validation output; it is not the default Android QA route.

## Validation

- Run the narrow native governance test when compatibility is touched:

```bash
npx jest __tests__/config/native-compat-governance.test.ts --runInBand
```

- For code changes, run the relevant targeted tests plus `npm run check:fast` when the logical block is finished.
- For locale or UI-copy changes, run `npm run test:i18n` and verify language
  persistence plus the changed flow after a real app restart on the USB device.
- If a shared file changed for native reasons, also verify web scope with a production web build or clearly mark `verify pending` if environment blocks it.
- Do not claim "works on Android" until a local build was installed on the USB phone and the relevant `AND-USB-*` cases passed. Without local-build device evidence, report `verify pending` with the exact build/install blocker.

## Output Contract

Report:

- Android issue or native requirement
- Files changed
- Platform split or guard strategy
- Validation run
- Local Android build/install command, device verification status, and `AND-USB-*` cases covered
- Remaining blockers or risks
