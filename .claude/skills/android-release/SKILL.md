---
name: android-release
description: >-
  Пошаговый регламент выпуска Android-приложения MeTravel: native smoke на
  устройстве → подготовка стора (Google Play) → прод-сборка AAB → submit.
  Делегирует профильным агентам. Триггеры: «выпусти Android-приложение»,
  «релиз Android», «опубликовать в Google Play», «что нужно для выпуска
  приложения».
---

# android-release

Регламент доведения Android-приложения до публикации в Google Play. Проект
web-first — поэтому первая и главная фаза не «собрать», а **доказать, что
native вообще работает на устройстве**.

## Гейт №0 — EAS-квота ограничена (load-bearing)

Количество токенов/EAS-сборок ограничено. **Прод-сборку (AAB) и любую EAS-сборку/submit
запускаешь ТОЛЬКО по явной команде владельца.** Тестовые прогоны на устройстве — через
**локальную** сборку (`cd android && ./gradlew :app:installDebug` или `:app:assembleDebug` +
`adb install -r ...`) на подключённый по USB телефон, а НЕ через EAS dev/preview,
Expo export или dev-client/Metro без отдельного явного разрешения владельца.
Не жги квоту по своей инициативе.

## Роли (делегирование)

- **`android-native-audit`** (skill) — превентивный аудит native-совместимости кода.
- **`android-expert`** (agent) — правки FE-кода под native, разбор крашей.
- **`android-builder`** (agent) — EAS-сборки/submit — ТОЛЬКО по явной команде владельца (Гейт №0).
- **`task-author`/`ticket-board`** — задачи на бэкенд (push endpoint и т.п.).

## Текущая база (на момент написания регламента)

`app.json`: `package: by.metravel.app`, `versionCode: 2`, permissions
location/camera/media, adaptive+monochrome icon, splash, deep links на
`metravel.by`, App Shortcuts. `eas.json`: профили dev/preview (apk) + production
(app-bundle, autoIncrement). Карта native — WebView+Leaflet. Push реализован
(`usePushNotifications.native.ts`). Сборка — EAS (облако), Windows-friendly.

## Фаза 1 — поднять и прогнать native (главный гейт)

1. `android-native-audit` — закрыть очевидные краши (web-API без guard, web-only
   импорты в native-бандл) до сборки.
2. `android-expert`/device-verify: `npx expo-doctor` → починить → локально собрать
   и установить на USB-телефон (`cd android && ./gradlew :app:installDebug` или
   `:app:assembleDebug` + `adb install -r ...`).
3. Smoke-прогон ключевых сценариев: запуск/splash, табы, **карта** (маркеры,
   попап, открытие точки), открытие путешествия, фото/галерея, логин (токен в
   SecureStore), избранное, поиск, push-permission. Фиксируй реальные краши.
4. `android-expert` чинит найденное → повтор локальной сборки/установки до зелёного прогона.
   **Без успешного прогона на устройстве дальше не идём.**

## Фаза 2 — подготовка стора (можно параллельно)

5. Google Play Developer аккаунт ($25) + создать приложение `by.metravel.app`.
6. Сервис-аккаунт в Play Console → ключ как gitignored
   `.secrets/google-play-service-account.json` (проверить `git check-ignore`),
   путь в `eas.json submit.production.android.serviceAccountKeyPath`
   (правку eas.json применяет владелец/по явному запросу — файл защищён).
7. Store listing (RU): иконка 512×512, feature graphic 1024×500, ≥2 скриншота
   телефона, краткое + полное описание, **Privacy Policy URL** (на сайте есть
   экран privacy — нужен публичный URL), **Data Safety form** — задекларировать
   сбор геолокации, фото/медиа, аналитики (GA4, Метрика).

## Фаза 3 — бэкенд (если нужно)

8. Проверить, есть ли endpoint регистрации push-токена (его дёргает
   `registerPushTokenApi`). Нет — `task-author`: TASK Owner Backend + воркборд.

## Фаза 4 — релиз (EAS-сборка — ТОЛЬКО по явной команде владельца, Гейт №0)

9. `android-builder`: `npm run release:check` (lint/typecheck/tests).
10. **По явной команде владельца** — `npm run android:build:prod` → AAB (versionCode поднимется autoIncrement). Сам сборку не инициируешь.
11. `npm run android:submit:latest` → track **internal** → проверить на реальных
    устройствах.
12. Промоут в **production** track после проверки.

## Правила

- Защищённые файлы (`app.json`, `eas.json`, `plugins/**`, `scripts/**`) — правки
  только по явному запросу владельца, диффом.
- Секреты (ключ Google Play) — только gitignored файл, никогда в чат/логи/коммит.
- Не помечать фазу «готово», пока не верифицировано (код — typecheck/lint/оба
  бандла; native — прогон на устройстве). Внешний блокер — явно `verify pending`.
- Бэкенд не править — только задачами.
