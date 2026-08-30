---
name: ios-release
description: "Регламент релиза iPhone: bump → гейт → signed EAS-сборка → TestFlight → App Review → release; каждый мутирующий шаг — отдельное разрешение владельца. Триггеры: «релиз iPhone», «залей в TestFlight»."
---

# ios-release

Регламент выпуска версии iPhone-приложения MeTravel (`by.metravel.app`). Первый
релиз ещё не выпущен — активный OpenSpec `openspec/changes/launch-ios-app-store/`,
подготовка Apple-аккаунта владельцем — `docs/IOS_OWNER_GUIDE.md`.

## База пайплайна

- **iOS собирается через EAS Build** (`eas.json`, профили `development` /
  `preview` / `production`), в отличие от Android, который уехал на локальный
  Gradle. Не переноси android-регламент сюда.
- Версия — `app.json` → `expo.version`; номер сборки — `expo.ios.buildNumber`.
  `autoIncrement: false`, поэтому bump ручной, а дубль номера App Store Connect
  отклонит.
- Universal iPhone/iPad v1: `supportsTablet: true`; iPad screenshots и
  full-screen/adaptive-window acceptance входят в release scope.
- Штатные команды: `npm run ios:environment:check`, `npm run ios:prebuild`,
  `npm run ios:release:guard`, `npm run ios:build:dev|preview|prod`,
  `npm run ios:submit <BUILD_ID>`.

## Гейт №0 — что требует явной команды владельца

Четыре независимых разрешения, ни одно не выводится из предыдущего:

1. **Signed build** — `preview`/`production` профили fail-closed без
   `IOS_SIGNED_BUILD_AUTHORIZATION=1`.
2. **Upload в App Store Connect/TestFlight** — fail-closed без
   `IOS_UPLOAD_AUTHORIZATION=1` и конкретного build id.
3. **Submit в App Review** — отдельное финальное решение владельца по точному
   принятому билду.
4. **Storefront release** — отдельное решение после одобрения Apple.

Выставление переменной авторизации — это и есть акт авторизации: агент сам её не
экспортирует. `--auto-submit` запрещён гейтом (`IOS_AUTO_SUBMIT_FORBIDDEN`).
Read-only проверки (`ios:environment:check`, `ios:release:guard`, инспекция
исходников) разрешения не требуют — они ничего не мутируют.

## Роли (делегирование)

- **`android-native-audit`** (skill) — превентивный аудит native-совместимости
  общего кода: он покрывает оба native-бандла, не только Android.
- **`ios-analyst`** — метаданные стора, privacy-ответы, age rating, reviewer
  notes, демо-аккаунт, соответствие App Review Guidelines.
- **`ios-designer`** — иконка/splash под release guard и локализованные
  скриншоты App Store.
- **`ios-expert`** — фиксы кода и конфигурации, если гейт красный.
- **`ios-reviewer`** — независимое ревью диффа перед кандидатом.
- **`ios-tester`** — QA кандидата: simulator → физический iPhone → exact
  processed TestFlight build.
- **`ios-deployer`** — единственный исполнитель build/upload/submit/release.

## Шаги

1. **Готовность.** `main`, чистое дерево, известный source revision.
   `npm run ios:environment:check` — Xcode/SDK, пригодный симулятор, Pods.
2. **Версия.** Решить marketing version и поднять `expo.ios.buildNumber` (строго
   больше последнего использованного в App Store Connect).
3. **Гейт.** `npm run ios:release:guard` — до зелёного. Красное чинит
   `ios-expert`, а не ослабление гейта.
4. **Контент релиза.** `ios-analyst` подтверждает метаданные и privacy-ответы,
   `ios-designer` — иконку, splash и скриншоты. Открытые блокеры комплаенса
   (сейчас — отсутствие Sign in with Apple при живых Google/Facebook login,
   Guideline 4.8) закрываются до сборки кандидата, а не после.
5. **Сборка кандидата** — только по команде владельца: `ios-deployer`,
   `npm run ios:build:prod`. Зафиксировать source revision, version/build,
   signing, entitlements без секретов.
6. **QA кандидата** — `ios-tester`. Симулятор не заменяет физический iPhone;
   релиз принимается только на exact processed TestFlight build.
7. **Upload** — отдельная команда владельца: `npm run ios:submit <BUILD_ID>`.
   Один раз, дождаться processing, дубли не слать.
8. **Submit в App Review** — отдельное решение владельца по принятому билду:
   метаданные, privacy, скриншоты, reviewer notes и демо-аккаунт проверены.
9. **Storefront release** — отдельное решение после одобрения Apple.

Дефект релиза = новый более высокий build number и повтор гейта целиком.
Секреты Apple/EAS, 2FA, Team ID, UDID, `.p8`/`.p12` и reviewer credentials не
печатать. Про состояние App Store Connect отчитываться только по тому, что оно
реально показывает.
