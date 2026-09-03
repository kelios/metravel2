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
   - **Чистое дерево — не формальность:** и `ios-build.sh`, и `ios-submit.sh`
     отказываются работать при любом незакоммиченном файле, включая чужие. Чужое
     не выбрасывать: закоммитить как есть отдельным коммитом или согласовать с
     владельцем.
   - **Сначала `eas build:list --platform ios`, потом сборка.** Проверить, нет
     ли уже готовой сборки на нужном коммите, и показать владельцу таблицу
     «что есть / чего в ней нет» ДО запуска: 03.09.2026 сборка 7 стартовала,
     когда сборка 6 уже лежала готовой, и владелец справедливо спросил, зачем
     тратится ещё одна. Ответ «в 6 нет сегодняшних краш-фиксов» был верным, но
     прозвучать он обязан был заранее, а не после.
   - **Фактическая квота плана — 30 сборок за расчётный период** (замер
     03.09.2026: `Total builds 2 / 30`). Не 15: цифра «около 15» ходила по
     памяти агента и была неверной — считать по факту, а не по ней.
     - **Упавшая сборка квоту НЕ тратит**: она уходит в отдельный счётчик
       `Waived builds` (лимит 10 за период; на 03.09.2026 израсходована 1 — это
       ERRORED-попытка билда 6 от 01.09).
     - **Android EAS-сборок не бывает вовсе** — он собирается локальным Gradle
       (`Android builds 0`), поэтому весь бюджет фактически принадлежит iOS.
     - Числа отдаёт только дашборд: у `eas-cli` команды про план и остаток нет
       (`account:view` и `--help` не показывают ни квоты, ни подписки). Смотреть
       expo.dev → Billing → Current usage и спрашивать владельца, а не
       выдумывать остаток.
2. **Версия.** Решить marketing version и поднять `expo.ios.buildNumber` (строго
   больше последнего использованного в App Store Connect).
3. **Гейт.** `npm run ios:release:guard` — до зелёного. Красное чинит
   `ios-expert`, а не ослабление гейта.
4. **Контент релиза.** `ios-analyst` подтверждает метаданные и privacy-ответы,
   `ios-designer` — иконку, splash и скриншоты. Открытые блокеры комплаенса
   закрываются до сборки кандидата, а не после.
   - Guideline 4.8 (Sign in with Apple при живых Google/Facebook login) **по коду
     закрыт**, проверено 03.09.2026: entitlement `com.apple.developer.applesignin`
     лежит в трекаемом `ios/metravel/metravel.entitlements`, есть
     `components/auth/AppleSignInButton.native.tsx`, `api/appleAuth.ts`,
     `expo-apple-authentication` и `usesAppleSignIn: true`; `ios:release:guard`
     это стережёт. Отстали ДОКУМЕНТЫ: `openspec/changes/launch-ios-app-store/`
     держит задачу 3.1 как `[ ]`, а `design.md:11` описывает состояние до правки.
   - Статус комплаенса проверять **по коду и entitlements**, а не по чек-боксам
     в OpenSpec: у проекта bare-проект `ios/`, и config-плагины туда не доезжают,
     поэтому `app.json` тоже не источник истины.
5. **Сборка кандидата** — только по команде владельца: `ios-deployer`,
   `npm run ios:build:prod`. Зафиксировать source revision, version/build,
   signing, entitlements без секретов.
6. **QA кандидата** — `ios-tester`. Симулятор не заменяет физический iPhone;
   релиз принимается только на exact processed TestFlight build.
7. **Upload** — отдельная команда владельца: `npm run ios:submit <BUILD_ID>`.
   Один раз, дождаться processing, дубли не слать.
   - **Пока артефакт не загружен — репозиторий не трогать.**
     `ios-eas-artifact-download.js:21` требует `metadata.gitCommitHash ===`
     текущий HEAD, поэтому ЛЮБОЙ коммит после старта сборки ломает загрузку:
     03.09.2026 правки документации, сделанные во время сборки, увели HEAD с
     коммита сборки, и upload отказал. Сторож прав — ослаблять его нельзя.
     Порядок: сборка → загрузка → и только потом коммиты. Если HEAD всё же уехал,
     чинить надо состоянием репозитория, а не гейтом: коммит сборки уже на
     origin, поэтому локальный `main` временно переводится на него
     (`git reset --hard <commit>`), делается upload, и `main` возвращается на
     `origin/main`. Пересборка ради этого — пустая трата квоты владельца.
8. **Submit в App Review** — отдельное решение владельца по принятому билду:
   метаданные, privacy, скриншоты, reviewer notes и демо-аккаунт проверены.
9. **Storefront release** — отдельное решение после одобрения Apple.

Дефект релиза = новый более высокий build number и повтор гейта целиком.
Секреты Apple/EAS, 2FA, Team ID, UDID, `.p8`/`.p12` и reviewer credentials не
печатать. Про состояние App Store Connect отчитываться только по тому, что оно
реально показывает.
