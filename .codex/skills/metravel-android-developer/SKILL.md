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
