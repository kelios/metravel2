---
name: android-release
description: "Регламент релиза Android: bump → гейт → локальная Gradle-сборка подписанного AAB → Play Publisher API, без EAS. Триггеры: «выпусти Android-приложение», «релиз Android», «опубликовать в Google Play»."
---

# android-release

Регламент выпуска очередной версии Android-приложения MeTravel. Приложение уже
опубликовано (`by.metravel.app`), треки `alpha`, `internal` и `production`
живые — то есть типовая задача теперь не «выпустить впервые», а **безопасно
обновить существующий релиз**.

## База пайплайна (актуализировано 2026-08-03)

- **EAS в Android-релизе не участвует.** AAB собирается локальным Gradle, Play
  обновляется прямыми вызовами Android Publisher API. Канон —
  `docs/ANDROID_OWNER_GUIDE.md`.
- Версия живёт только в `app.json` (`expo.version`, `expo.android.versionCode`),
  `autoIncrement` нет — bump ручной.
- Треки: `alpha` = закрытое тестирование (реальные тестировщики), `internal` =
  внутреннее, `production` = публичный релиз, `beta` пуст и не трогается.
- Скрипты треков разделены: production-скрипт не пишет в `alpha`/`internal`,
  testing-скрипт не пишет в `production`/`beta`; каждый сверяет снапшоты чужих
  треков внутри временного edit.

## Гейт №0 — что требует явной команды владельца

- **Сборку** прод-AAB запускаешь по команде владельца.
- **`--commit` в любой трек — отдельное подтверждение.** Dry-run делается сам,
  публикация — только после «да». Для `production` это выкатка сразу на 100%:
  скрипт ставит `status: completed` без `userFraction`, staged rollout не
  поддержан (процентный раскат — ручной шаг владельца в Play Console).
- Тестовые прогоны на устройстве идут локальной debug-сборкой и квоту ни на что
  не тратят — их отдельно согласовывать не нужно.

## Роли (делегирование)

- **`android-native-audit`** (skill) — превентивный аудит native-совместимости кода.
- **`android-expert`** (agent) — правки FE-кода под native, разбор крашей.
- **`android-publisher`** (agent) — сборка AAB, dry-run и публикация в Play.
- **`android-qa-sweep`** (skill) — полный обход экранов на устройстве, если релиз
  крупный.
- **`task-author`/`ticket-board`** — задачи на бэкенд.

## Фаза 1 — доказать, что native работает (главный гейт)

1. `android-native-audit` — закрыть очевидные краши (web-API без guard, web-only
   импорты в native-бандл) до сборки.
2. Локальная сборка и установка на подключённый по USB телефон:
   `npm run android:build:dev` → `adb install -r
   android/app/build/outputs/apk/debug/app-debug.apk`.
3. Smoke-прогон: запуск/splash, табы, **карта** (маркеры, попап, открытие точки),
   открытие путешествия, фото/галерея, логин (токен в SecureStore), избранное,
   поиск, квесты, push-permission. Релевантные `AND-USB-*` из
   `docs/MANUAL_TEST_CASES.md`. Краши ловить в `adb logcat`.
4. `android-expert` чинит найденное → повтор до зелёного прогона. **Без успешного
   прогона на устройстве дальше не идём.**
   Помни: debug-сборка идёт без R8, поэтому регрессии минификации она не ловит —
   при подозрении на них проверяется релизный артефакт.

## Фаза 2 — версия

5. `npm run android:play:status` — прочитать фактические треки.
6. В `app.json` поднять `versionCode` до (максимум по трекам + 1) и `version` по
   смыслу изменений. Дубль `versionCode` Play отклоняет.

## Фаза 3 — гейт качества и сборка

7. `npm run android:release:doctor` — Node 22.13.1+, JDK 17–21, Android SDK,
   keystore, `.env.prod`, ключ Play.
8. `npm run release:check` — зелёный целиком (lint, typecheck, security, audit,
   jest, e2e, прод-сборка веба, guard'ы).
9. `npm run android:build:prod` → подписанный
   `android/app/build/outputs/bundle/release/app-release.aab`. Проверить package,
   `versionCode`/`versionName` против `app.json` и подпись upload key.

## Фаза 4 — публикация

10. Dry-run: `npm run android:submit:testing:latest` (alpha+internal) и
    `npm run android:submit:latest` (production). Оба валидируют edit и удаляют его.
11. **По явному подтверждению владельца** — `npm run android:submit:testing`
    и/или `npm run android:submit:production`.
12. `npm run android:play:status` — целевые треки на новом `versionCode`, остальные
    не сдвинулись. Обработка на стороне Google не мгновенная: несколько минут трек
    может показывать старое значение, повторный commit из-за этого не запускать.

## Store listing (проверять при заметных изменениях)

Иконка 512×512, feature graphic 1024×500, ≥2 скриншота телефона, описания,
Privacy Policy URL, **Data Safety** в соответствии с фактическими runtime-permissions
(геолокация, камера, аналитика), App Access с безопасным тестовым аккаунтом.
Тексты — `docs/ANDROID_STORE_LISTING.md`. Release notes, тестировщики, страны и
rollout скриптами не управляются — это ручные шаги владельца в Play Console.

## Правила

- Защищённые файлы (`app.json`, `eas.json`, `plugins/**`, `scripts/**`) — правки
  только по явному запросу владельца; в рамках релиза допускается ровно bump версии
  в `app.json`, и он показывается в отчёте.
- Секреты (`.secrets/**`) — никогда в чат, логи или коммит; публичный SHA-256
  отпечаток upload-сертификата в evidence можно.
- Не помечать фазу «готово» без верификации (код — typecheck/lint/оба бандла;
  native — прогон на устройстве; Play — фактические треки). Внешний блокер — явно
  `verify pending`.
- Бэкенд не править — только задачами.
