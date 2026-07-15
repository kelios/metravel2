# Android release owner guide

Актуализировано: 2026-07-15.

Android release не использует EAS/Expo cloud build или submit. Проект остаётся
на Expo/React Native, но AAB собирается локальным Gradle, а Google Play
обновляется напрямую через Android Publisher API. Это не расходует EAS credits.

Production automation технически ограничена track `production`. Она не должна
менять `alpha`, `internal`, `beta`, testers, countries или текущую сборку
закрытого тестирования.

## Current project contract

| Параметр | Значение |
| --- | --- |
| Android package | `by.metravel.app` |
| Version source | `app.json` → `expo.version` / `expo.android.versionCode` |
| Local AAB | `android/app/build/outputs/bundle/release/app-release.aab` |
| Play service account | `./google-play-service-account.json` или `GOOGLE_PLAY_SERVICE_ACCOUNT_PATH` |
| Protected tracks | `alpha`, `internal`, `beta` |
| Writable track | только `production` |
| Store copy | `docs/ANDROID_STORE_LISTING.md` |

Play Console account/testing/production eligibility — внешний gate. Если API
возвращает `FAILED_PRECONDITION`, временный edit удаляется, повторный commit не
запускается до устранения требования, показанного Play Console.

## 1. Local device gate

Обычная Android validation выполняется локально:

```bash
adb devices -l
npm run android:build:dev
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Дальше агент самостоятельно проходит релевантные `AND-USB-*` cases из
`docs/MANUAL_TEST_CASES.md`. Mobile-web viewport, Expo export, EAS или dev-client
не заменяют установленную native-сборку.

## 2. Secrets and upload key

Service-account JSON хранится только в gitignored файле. Его содержимое нельзя
печатать, отправлять в чат, screenshots или commit.

Release signing читается из локального secret store:

```text
METRAVEL_ANDROID_KEYSTORE_PATH
METRAVEL_ANDROID_KEYSTORE_PASSWORD
METRAVEL_ANDROID_KEY_ALIAS
METRAVEL_ANDROID_KEY_PASSWORD
```

Gradle fail-closed: если хотя бы одной переменной нет, release task завершается
до сборки. `release` никогда не подписывается debug-keystore.

На основном macOS release host project wrapper автоматически читает keystore
`.secrets/metravel-android-upload.jks`, alias `metravel-upload` и два пароля из
Keychain services `metravel-android-upload-store-password` и
`metravel-android-upload-key-password`. В CI/на другой машине используются те же
четыре env variables; секреты в repository files не копируются.

Upload certificate локального keystore должен совпадать с Upload key certificate
в Play Console. Если прежний upload key доступен только старому cloud builder,
нужно создать новый локальный upload key и выполнить штатный Play Console upload
key reset. Reset не заменяет Google Play App Signing key и не требует изменения
closed-testing track, но до подтверждения нового сертификата AAB не загружается.

## 3. Store assets and policy

Перед production release:

- copy сверена с `docs/ANDROID_STORE_LISTING.md`;
- privacy URL реально открывается;
- icon, feature graphic и screenshots актуальны;
- Data Safety отражает runtime permissions/data flows;
- App Access использует безопасный test account без публикации credentials;
- version/versionCode и release notes проверены;
- Play Console показывает выполненные production eligibility requirements.

## 4. Pre-release and operation gate

До store build должны быть зелёными release checks и релевантные Android USB
cases. Перед Gradle/adb/Play operation проверяются активные процессы и locks;
чужой процесс не прерывается и параллельный запуск не создаётся.

```bash
npm run release:check
```

## 5. Local production AAB

После загрузки signing variables из secret store:

```bash
npm run android:build:prod
```

Скрипт выполняет `:app:bundleRelease` локально и не вызывает EAS. После сборки
проверь:

- artifact существует и является AAB;
- package — `by.metravel.app`;
- version/versionCode совпадают с `app.json`;
- сертификат соответствует зарегистрированному Play upload key;
- commit/source соответствует release.

Для JS/native bundle `.env.prod` загружается как authoritative environment с
`NODE_ENV=production` и `EXPO_ENV=prod`; локальная `.env.local` не должна
переопределять production API/config.

## 6. Safe Google Play flow

Read-only status создаёт временный edit, читает tracks и удаляет edit:

```bash
npm run android:play:status
```

Dry-run загружает локальный AAB в временный `production` edit, проверяет, что
protected tracks не изменились, вызывает Play validate и удаляет edit:

```bash
npm run android:submit:latest
```

Только после успешного dry-run actual production commit выполняется командой:

```bash
npm run android:submit:production
```

В CLI нет аргумента выбора track и нет кода записи в `alpha`, `internal` или
`beta`. Ошибка upload/update/validate приводит к удалению временного edit без
commit.

## 7. Closed testing protection

Текущий closed test — отдельный внешний процесс. Production release automation:

- не добавляет и не удаляет тестеров;
- не меняет countries/availability;
- не заменяет и не supersede-ит `alpha` release;
- не запускает promotion из `alpha` автоматически;
- до commit сравнивает снимки `alpha`, `internal`, `beta` внутри edit.

Если когда-нибудь понадобится новая closed-testing сборка, это отдельная задача
и отдельный инструмент; production-only script для этого не расширяется.

## 8. Handoff evidence

Запиши без секретов:

- requested action и target;
- commit, version/versionCode и SHA-256 upload certificate;
- команды и результаты checks;
- device/model и пройденные `AND-USB-*` cases;
- Play production status и отсутствие изменений protected tracks;
- blockers/residual risks и board task.

Для операции используй `$metravel-google-play-operator`; общие gates находятся
в `docs/RELEASE.md` и `docs/PRODUCTION_CHECKLIST.md`.
