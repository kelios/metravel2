---
name: metravel-android-developer
description: Implement and debug Android/native compatibility in the metravel Expo React Native app. Use when Codex needs an Android developer role for native crashes, platform-specific files, Expo native modules, Android navigation, push notifications, SecureStore, permissions, native map behavior, or web-first code leaking into the Android bundle.
---

# Metravel Android Developer

Use this skill for Android/native implementation and debugging. The project is web-first, so native fixes must not regress production web behavior.

Read first:

- `AGENTS.md`
- `docs/RULES.md`
- `docs/CODEX.md`
- `docs/NATIVE_COMPAT_RULES.md`
- `docs/DEVELOPMENT.md`
- Relevant feature docs, especially `docs/features/map.md` for map work.

## Scope

- Platform files: `.android.tsx`, `.native.tsx`, `.ios.tsx`, `.web.tsx`, and narrow `Platform.OS` gates.
- Android/native runtime: Expo modules, permissions, notifications, SecureStore, image picker/media, sharing, WebBrowser, navigation, and native-only app startup.
- Native map behavior: keep web Leaflet code out of native bundles and native map/WebView code out of web bundles.
- Native crash triage from Metro, dev-client, EAS, or `adb logcat` output.

## Rules

- Do not fix native by changing shared web behavior. If structure, behavior, or dependencies diverge, split platform files and move shared logic into hooks/utils.
- A one-line property difference may use a local `Platform.OS` gate; larger differences need platform-specific files.
- Guard web APIs (`window`, `document`, `localStorage`, `navigator`, DOM observers/events) inside effects/functions or move them to `.web` files.
- Chain dynamic imports only through `Promise.resolve(import(...))` when using `.then`, `.catch`, `.finally`, stored promises, or returned promises.
- Keep external navigation inside `utils/externalLinks.ts` helpers.
- Do not print secrets from `.env*`, EAS, Google Play, or device logs.
- Do not edit `app.json`, `eas.json`, `plugins/**`, or release scripts unless the user explicitly asks for build/config changes.

## Bug Intake

- Every real Android bug found during device QA must be created or updated on the shared task board in the active `Android Release` sprint before implementation continues.
- Prefer the `ticket-board` MCP tools when available. If MCP is unavailable but `.secrets/metravel-task-board.env` exists, use the task board API without printing the token.
- Use `area=front`, `status=todo`, `reporter=Codex Android QA`, and `assignee=metravel-android-developer` for newly confirmed Android frontend bugs unless the existing board conventions say otherwise.
- Include device model, Android/API version, exact route, reproduction steps, `adb logcat`/Metro evidence, acceptance criteria, likely files, validation, and blockers.

## Cable Dev-Client Smoke

Use this flow for Android testing over USB. The project is worked on from both Windows and macOS, so keep commands portable and provide both variants when documenting a workflow.

1. Find `adb`.
   - Windows PowerShell: `where.exe adb`; fallback common local path: `D:\metravel\tools\platform-tools\adb.exe`.
   - macOS/zsh: `which adb`; fallback common SDK path: `$HOME/Library/Android/sdk/platform-tools/adb`.
2. Verify the phone.
   - Windows: `& 'D:\metravel\tools\platform-tools\adb.exe' devices -l`
   - macOS: `adb devices -l`
   - If status is `unauthorized`, confirm the RSA debugging prompt on the phone.
3. Start Metro for dev-client in LAN mode so it binds beyond IPv6 localhost.
   - Windows PowerShell:
     ```powershell
     $env:Path = 'D:\metravel\tools\platform-tools;' + $env:Path
     $env:REACT_NATIVE_PACKAGER_HOSTNAME = '<LAN_IP>'
     npx expo start --dev-client --host lan
     ```
   - macOS/zsh:
     ```bash
     export REACT_NATIVE_PACKAGER_HOSTNAME=<LAN_IP>
     npx expo start --dev-client --host lan
     ```
4. For USB cable testing, reverse Metro ports before launching:
   ```bash
   adb reverse --remove-all
   adb reverse tcp:8081 tcp:8081
   adb reverse tcp:8084 tcp:8084
   adb reverse --list
   ```
5. Launch the installed development build with the project scheme:
   ```bash
   adb shell am force-stop by.metravel.app
   adb shell am start -W -a android.intent.action.VIEW -d "metravel://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081" by.metravel.app
   # scheme — `metravel` (app.json) с 2026-06-13; для dev-build, собранного до этой даты, используй `myapp://expo-development-client/...`
   ```
6. Capture health evidence without leaking secrets:
   ```bash
   adb logcat -c
   adb logcat -d -v time | grep -E "FATAL EXCEPTION|ReactNativeJS|AndroidRuntime|JSApplicationIllegalArgumentException|DevLauncher"
   adb shell uiautomator dump /sdcard/window.xml
   adb exec-out cat /sdcard/window.xml
   ```
   In PowerShell, use `Select-String` instead of `grep`.

## Validation

- Run the narrow native governance test when compatibility is touched:

```bash
npx jest __tests__/config/native-compat-governance.test.ts --runInBand
```

- For code changes, run the relevant targeted tests plus `npm run check:fast` when the logical block is finished.
- If a shared file changed for native reasons, also verify web scope with a production web build or clearly mark `verify pending` if environment blocks it.
- Do not claim "works on Android" until it was checked on an emulator/device or dev-client. Without device evidence, report `verify pending: needs Android emulator/device check`.

## Output Contract

Report:

- Android issue or native requirement
- Files changed
- Platform split or guard strategy
- Validation run
- Device/emulator verification status
- Remaining blockers or risks
