# Android release owner guide

Актуализировано: 2026-07-15.

Эта инструкция описывает безопасный путь к Google Play. Она не разрешает запуск
EAS build/submit сама по себе: Android cloud credits ограничены, поэтому каждое
cloud build, submit и тем более public Production rollout требует явного запроса
пользователя на точное действие и target.

## Current project contract

| Параметр | Значение |
| --- | --- |
| Expo owner / slug | `savran.juli` / `metravel` |
| Android package | `by.metravel.app` |
| EAS project id | `472c9f49-998e-43c5-bf37-0478cf259645` |
| Submit track из `eas.json` | Closed testing `alpha` |
| Service-account path | `./google-play-service-account.json` (gitignored secret) |
| Store copy | `docs/ANDROID_STORE_LISTING.md` |

Play Console UI, review time, fees, tester requirements и account verification
могут меняться. Для них source of truth — требования, которые показывает
конкретный Play Console account, а не числа в этом файле.

## 1. Local device gate

Обычная Android validation выполняется без EAS:

```bash
adb devices -l
cd android
./gradlew :app:installDebug
```

Если install task недоступен, допустимы `:app:assembleDebug` и
`adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.

Дальше агент самостоятельно проходит релевантные `AND-USB-*` cases из
`docs/MANUAL_TEST_CASES.md`, снимает logcat/runtime evidence и сохраняет
артефакты только в ignored directories.

- `device` — продолжить;
- `unauthorized` — подтвердить RSA на телефоне и повторить;
- нет устройства — зафиксировать конкретный blocker;
- mobile-web viewport, Expo export или dev-client не заменяют installed native
  validation без отдельного разрешения.

## 2. Owner setup

Владелец Play account:

1. создаёт/проверяет приложение с package `by.metravel.app`;
2. выполняет account/identity/testing requirements, показанные Play Console;
3. заполняет store listing, content rating, target audience, data safety,
   app access и privacy URL;
4. создаёт service account с минимально достаточными правами на приложение;
5. сохраняет JSON key как `google-play-service-account.json` в корне проекта;
6. проверяет, что key игнорируется git:

   ```bash
   git check-ignore google-play-service-account.json
   ```

Key нельзя вставлять в чат, логи, screenshots или commit. При утечке key
отзывается в Google Cloud/Play и заменяется.

Точные названия пунктов консоли и permission model сверяй с официальными
инструкциями Expo/Google в момент операции.

## 3. Store assets and policy

Перед build/submit:

- copy сверена с `docs/ANDROID_STORE_LISTING.md`;
- privacy page реально открывается;
- icon, feature graphic и phone screenshots соответствуют требованиям консоли;
- Data Safety описывает фактические runtime permissions/data flows;
- test account для App Access берётся из безопасного e2e flow без публикации
  credentials;
- version/versionCode и release notes проверены;
- target track явно подтверждён.

Нельзя считать старые screenshots или прошлую Data Safety анкету автоматически
актуальными после изменения permissions, analytics, auth, location или media
flows.

## 4. Pre-release checks

До любого store build:

```bash
npm run release:check
```

Также должны быть зелёными релевантные Android USB cases. Перед долгой операцией
проверяются активные `gradlew`, EAS, adb install, quality/build processes и
locks; параллельную операцию для того же target не запускать и чужой процесс не
убивать.

## 5. EAS production build

Только после явного запроса на Android production AAB:

```bash
npx eas-cli whoami
npm run android:build:prod
```

После завершения проверь в EAS:

- status `finished`;
- profile `production`;
- package и versionCode;
- artifact type AAB;
- commit/source соответствует release;
- artifact открывается и доступен владельцу.

Успешный exit code без проверки artifact metadata не является Done.

Preview/development cloud builds (`android:build:preview`,
`android:build:dev`) также расходуют credits и требуют явного запроса.

## 6. Submit to closed testing

Текущий `eas.json` направляет production submit в Closed testing `alpha`:

```bash
npm run android:submit:latest
```

Команду запускать только по явному запросу на submit. После неё в Play Console
проверь:

- нужное приложение/package;
- track `alpha`;
- ожидаемый versionCode;
- processing/review status;
- testers/availability;
- установку именно из Google Play и релевантный smoke на устройстве.

Если submit получил другой track или versionCode, остановись и не продвигай
release дальше.

## 7. Public Production

Closed testing не даёт разрешения на public rollout. Promotion/Production —
отдельное внешнее действие с более высоким риском.

Перед ним нужны:

- отдельное явное подтверждение `Production`;
- выполненные account/testing requirements Play Console;
- одобренный alpha artifact и store/policy forms;
- подтверждённые countries и rollout percentage;
- rollback/stop plan;
- post-release monitoring owner.

Не продвигай alpha в Production по предположению или как «следующий обычный
шаг».

## 8. Handoff evidence

Запиши без секретов:

- requested action и target;
- commit, version/versionCode, EAS build id;
- команды и результаты checks;
- device/model/API и пройденные `AND-USB-*` cases;
- Play track и console status;
- blockers/residual risks;
- ссылки на ignored evidence и board task.

Для выполнения операции используй `$metravel-google-play-operator`; общие
release gates находятся в `docs/RELEASE.md` и
`docs/PRODUCTION_CHECKLIST.md`.
