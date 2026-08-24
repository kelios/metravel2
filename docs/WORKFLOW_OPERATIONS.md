# Operational workflow protocols

Ситуативные протоколы рабочего процесса, подключаемые из `AGENTS.md` §4.
Правила не изменились — изменился момент загрузки: читать нужный раздел тогда,
когда задача его касается, а не в каждой сессии.

Карта:

- e2e-доступы и board token → «3.1 E2E окружение и доступы»;
- создание/удаление тестовых сущностей на проде → «3.1.1 Тестовые данные на production»;
- сборка и прогон на USB-устройстве → «3.2 Android device testing and builds»;
- Xcode/simulator/physical iPhone/TestFlight → «3.2.1 iOS testing and release operations»;
- baseline/after на живом URL, закрытие perf/media/network задач → «3.3.1 Production-target validation and task closure»;
- deploy/build/e2e/Lighthouse и общие locks → «3.4 Координация долгих операций».

Обязательный минимум остаётся в `AGENTS.md`: common/shared responsive UI
проверяется desktop web + mobile web, а device gate применяется только к
platform-specific behavior/config/runtime (§3.3); правило quality-gate lock —
в §3, шаг 9.

### 3.1 E2E окружение и доступы

- Для e2e-авторизации и тестовых доступов используй переменные из `.env.e2e`.
- Не запрашивай у пользователя повторно логин/пароль, если они уже заданы в `.env.e2e`.
- Никогда не выводи секреты из `.env.e2e` в ответах, логах, скриншотах и коммитах.
- Если task-board API/MCP отвечает `HTTP 401`, обнови staff token через программный login из `.env.e2e` по `docs/TASK_BOARD_MCP.md`, перезапиши `.secrets/metravel-task-board.env` без вывода токена и повтори `/api/tasks/`, `/api/tasks/board/`, `/api/sprints/`.

### 3.1.1 Тестовые данные на production

- Разрешение выдано владельцем ПОСТОЯННО (2026-08-09): под e2e-аккаунтами можно
  **создавать на проде тестовые сущности, проверять на них и удалять** —
  переспрашивать не нужно. Это относится к данным пользователя (поездки, точки
  маршрута, RSVP, приглашения), а не к контенту сайта: чужие статьи, квесты,
  travel-записи и настройки по-прежнему не трогать.
- Постоянная тестовая поездка владельца: `https://metravel.by/trips/plan/31`
  (публичная, владелец `E2E_EMAIL2`). Её можно наполнять данными для проверки.
- Убирай за собой: временную сущность, созданную под конкретную проверку, удаляй
  сразу после снятия evidence, а факт удаления фиксируй кодом ответа.
- Готовые рецепты для прод-QA (проверены 2026-08-09, экономят полчаса на сессию):
  - **Авторизация на web — только cookie.** `secure_userToken` на web не
    используется (`utils/secureStorage.ts`: «web uses the backend-managed HttpOnly
    cookie»). В Playwright: `context.request.post('/api/user/login/')` с
    `X-CSRFToken` из cookie `csrftoken` ставит сессию, после чего приложению нужно
    отдать профиль через `localStorage`: `userId`, `userName`, `isSuperuser`
    (`checkAuthentication` без `userId` считает пользователя гостем).
  - Создание поездки — `POST /api/trips/planned/`; маршрут — `PUT
    /api/trips/planned/{id}/route/` с `point_type` из `place|custom|rest|overnight`
    (значения `stop` не существует, ответ 400).
  - Участники: сначала `POST /api/trips/planned/{id}/invite/ {"user_ids":[...]}`,
    только потом приглашённый делает `POST .../rsvp/` со **значением бэка**
    `accepted|declined` (FE-словарь `going` бэк не принимает). Без инвайта RSVP
    отвечает 400 `planned trip not found or not visible`.
  - Удаление поездки — `DELETE /api/trips/{id}/` (не `/trips/planned/{id}/`: там 405).
  - На странице висит баннер согласия и перехватывает клики — жать «Отклонить»
    (самый приватный вариант), а не «Принять».
  - На мобильной ширине табы поездки — только иконки: искать по `aria-label`
    («Люди», «Экспорт»), поиск по тексту там ничего не найдёт.
  - **База API — `https://metravel.by/api`, а не голый домен.**
    `utils/resolveApiBaseUrl.ts` дописывает `/api` сам. POST на
    `https://metravel.by/user/registration/` не ошибётся, а тихо вернёт HTTP 200 с
    HTML SPA и ничего не создаст — легко принять за успех.
  - **Расходный QA-аккаунт на проде: полный рецепт, почта не нужна.**
    Регистрация требует активации по письму, но её закрывают токеном из базы.
    Проверено целиком 2026-08-18, повторять разбирательство не нужно:
    1. `POST /api/user/registration/` с `{username, email, password,
       confirmPassword}` → 201 и запись в БД. Токена в ответе нет.
    2. `POST /api/user/login/` на этом шаге вернёт 401 «Аккаунт не активирован.
       Воспользуйтесь ссылкой активации в письме» — поэтому адрес на
       несуществующем домене (`example.com`, `test@test.com`) сам по себе не
       годится, и это не повод искать «настоящую» почту.
    3. Достать токен из прод-базы: таблица `users`, колонка
       `account_activation_token`. Рядом лежат `is_active` и `email_verified_at`;
       колонки `is_email_activated` в базе **нет**, хотя поле модели называется
       так — запрос по этому имени падает с `column does not exist`.
       Выбирать строго по своему `id`, а не дампом: `email` хранится
       зашифрованным (`gAAAAA…`), чужие строки читать незачем.
    4. `POST /api/user/confirm-registration/` с `{"hash": "<токен>"}` → 200 и
       `userToken`. После этого `login` отдаёт 200 и аккаунт полноценно рабочий.
    Доступ к базе: `source scripts/deploy-target.sh` даёт `PROD_SSH_TARGET`,
    дальше `ssh "$PROD_SSH_TARGET" "docker exec -i metravel_metravel-gis_1 sh -c
    'psql -U \$POSTGRES_USER -d \$POSTGRES_DB -tA'"` и SQL через stdin heredoc.
    Две грабли: `deploy-target.sh` работает только из bash (из zsh тихий exit 1),
    а SQL внутри `psql -tAc \"…\"` через ssh рвётся на вложенных кавычках —
    поэтому именно heredoc, а не `-c`.
    Аккаунт, созданный под проверку удаления, этой же проверкой и уничтожается,
    так что многоразовый актив здесь — рецепт, а не конкретная учётка.

### 3.2 Android device testing and builds

- Android EAS/cloud builds and submits are disabled by project policy: do not run
  `eas build --platform android`, `eas submit --platform android` or any
  `--platform all` command. Android production artifacts are built locally by
  `npm run android:build:prod`; store operations use the project Google Play API
  script. Re-enabling Android EAS requires a new explicit user decision.
- На новом компьютере production signing и Android production env берутся из
  переносимого `.secrets` bundle через `npm run android:release:doctor` и
  `npm run android:build:prod`; ручная настройка macOS Keychain не требуется.
- Current standing release authorization permits the agent to prepare and run the
  local Android production build/Production submit when an Android release is the
  active task. This never authorizes changing `alpha`, `internal`, `beta`, tester
  lists, countries, or the active closed-testing release.
- Если задача затрагивает Android-specific наблюдаемое поведение, конфигурацию
  или runtime, считай, что Android-телефон подключён к этому компьютеру по
  USB-кабелю: сначала проверь `adb devices -l`. Общий файл или common responsive
  UI сам по себе Android device gate не создаёт.
- Если `adb` показывает устройство со статусом `device`, сначала собери Android локально и установи сборку на телефон (`cd android && ./gradlew :app:installDebug` или `:app:assembleDebug` + `adb install -r ...`), затем самостоятельно тестируй нужный Android-сценарий по `docs/MANUAL_TEST_CASES.md` `AND-USB-*`.
- Не заменяй Android device validation mobile-web viewport, Expo web export, EAS preview/development/production build или dev-client/export flow без явного разрешения пользователя.
- `unauthorized`, отсутствие устройства или поломка локальной сборки/установки фиксируй конкретно: команда, результат и следующий безопасный шаг.

### 3.2.1 iOS testing and release operations

- Активный первый iOS release поддерживает iPhone; iPadOS-specific layout,
  screenshots и acceptance вне scope.
- Для iOS-specific behavior/config/runtime задачи сначала проверь `xcode-select -p`,
  `xcodebuild -version` и eligible destinations через `xcodebuild
  -showdestinations`/`xcrun simctl list devices available`. Отсутствующий runtime
  — конкретный environment blocker, а не повод считать QA пройденной.
- Simulator используется для compilation, startup, basic navigation/UI, locales,
  safe areas, keyboard и deterministic error states. Physical iPhone обязателен
  для camera/photo/HEIC, Keychain/biometrics, APNs, Universal Links, sharing,
  permission allow/deny/restricted behavior и lifecycle.
- Exact processed TestFlight build — acceptance boundary перед App Review. Local
  debug/simulator build не доказывает signing, embedded production config,
  entitlement/APNs behavior или App Store processing.
- Перед `xcodebuild`, Expo/EAS iOS build, archive, upload или submit проверь
  operation gate и не запускай дубликат того же target/build number.
- Signed distribution build, App Store Connect/TestFlight upload/group mutation,
  App Review submit и storefront release — четыре независимых mutating gates.
  Для каждого нужна отдельная текущая команда владельца; `--auto-submit` без неё
  запрещён, а upload нельзя называть публикацией.
- Секреты Apple/EAS, 2FA, Team ID, UDID, `.p8`/`.p12`, private keys, profiles и
  reviewer credentials не выводятся и не попадают в Git/board/evidence.
- Для active iOS work используй `ios-architect` → `ios-expert` →
  `ios-reviewer` → `ios-tester` → `ios-deployer`; backend Apple auth/AASA/push
  остаются linked `area=back` dependencies.

### 3.2.2 iOS permission matrix и account-deletion QA

Процедура для Done gate «permissions/App Privacy» (#1416). Порядок важен: каждый
шаг снимает конкретный вид evidence, который приёмка требует отдельно.

**Что где запрашивается.** Разрешение просится по действию, а не на старте:

| Разрешение | Триггер в UI | Код |
| --- | --- | --- |
| Location When-In-Use | кнопка геопозиции на `/map`, квесты «рядом», навигатор точки квеста, route picker мастера | `components/MapPage/Map/useMapUserLocation.ts`, `screens/tabs/QuestsScreen.tsx`, `components/quests/QuestPointNavigator.native.tsx` |
| Photo Library | выбор фото в мастере travel, галерее, редакторе статьи | `components/travel/PhotoUploadWithPreview.tsx`, `components/travel/ImageGalleryComponent.ios.tsx` |
| Camera | «снять фото» на тех же экранах | `components/travel/PhotoUploadWithPreview.tsx` |
| Notifications | **локальные**, не push: напоминание о незаконченном квесте и геофенсинг | `components/quests/useQuestReminder.native.ts`, `services/questGeofencing.native.ts` |

Remote push на iOS в v1 не запрашивается вообще: `NativeAppRuntime.native.tsx`
передаёт `autoRequest: false`, `requestPermission()` из UI не вызывает никто, а
плагин уведомлений Android-only и `aps-environment` не синтезирует. Поэтому
«notifications» в матрице проверяются через квестовый сценарий локальных
уведомлений, и отсутствие APNs-промпта — ожидаемое поведение, а не дефект.

**Сборка кандидата.** Собирать только из чистого дерева:

- Если в рабочем дереве есть чужие незакоммиченные изменения (частая ситуация
  при параллельных сессиях), собранный бинарник — это «HEAD + чужой WIP», и такое
  evidence приёмка заворачивает. Делай `git worktree add --detach <scratch>/wt <HEAD>`,
  симлинкуй `node_modules` из основного дерева (13 ГБ, копировать нельзя) и
  копируй `.env.prod` в `<worktree>/.env` — иначе сборка уйдёт на dev-API.
- `pod install` в worktree падает без UTF-8 локали:
  `Unicode Normalization not appropriate for ASCII-8BIT`. Запускать как
  `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install`.
- Не проверяй результат командой вида `pod install | tail`: код возврата тогда
  принадлежит `tail`, и упавшая установка выглядит как `exit 0`.

**Fresh install обязателен.** Разрешения на физическом устройстве не
сбрасываются командой — `simctl privacy` работает только на симуляторе. Чистое
состояние даёт только удаление приложения и повторная установка, поэтому матрицу
deny → allow → Settings → retry снимают на свежепоставленном билде.

**Account deletion.** Кнопка в `components/settings/AccountSection.tsx`, обработка
в `components/screens/settings/SettingsScreen.tsx`. Нужен аккаунт, который не
жалко удалить и которым можно войти — см. ограничение активации в §3.1.1: аккаунт
на несуществующем домене создаётся, но не логинится, поэтому для этого сценария
не годится.

### 3.3.1 Production-target validation and task closure

- Если проблема воспроизводится на production, Task Contract называет production
  target или задача оптимизирует запросы, изображения, LCP, bundle, cache либо
  API fan-out, до правки сними baseline на живом production URL. Минимальный
  evidence: точный URL, viewport/browser/DPR, auth/cache state, число запросов,
  байты, коды ответов и фактический размер выбранного media-варианта; для
  Android — тот же flow и сетевой/byte замер на устройстве, когда Android в scope.
- После явным образом разрешённого deploy повтори тот же сценарий на живом URL и
  сравни before/after. Локальная production-сборка, preview с production API,
  unit/e2e с mock media primitive, успешный deploy log и post-build guard не
  являются post-deploy production evidence.
- Если deploy не входил в разрешённый scope или production ещё не обновлён,
  не утверждай «исправлено на проде». Если deploy/production probe обязателен
  для текущей приёмки, остановись и запроси точную deploy authorization или
  результат владельца; не заканчивай проход parking-статусом. `testing`
  допустим только для записанного exact retest/temporal gate.
- При прямой приёмке backend-задачи используй только доступные релевантные
  backend source/API/production probes. Client/browser/device evidence относится
  к связанной `area=front` задаче. Если backend/ops работа осталась — `todo`; если
  реализация готова и ждёт заданное временное окно — `testing`; если работа
  завершена и доступные обязательные in-scope probes зелёные — `done`, даже когда
  irrelevant/out-of-scope evidence недоступно.
- После начатого acceptance pass текущая задача не остаётся в `testing` просто
  из-за незавершённой/недоступной проверки: pass → `done`; собственная
  незавершённая работа → `todo`/`in_progress`; отдельный подтверждённый дефект →
  новая/reused связанная карточка после Problem Memory. Единственное длительное
  состояние `testing` — exact retest/temporal gate с параметром, порогом,
  текущим значением, trigger/earliest recheck и командой.
- Performance/media/network задача закрывается только когда повторный production
  probe подтверждает целевой budget всей страницы, а не одного элемента:
  request/API cardinality, total/transfer bytes, oversized/unsized media,
  duplicate URL variants, 4xx/5xx и progressive/lazy behavior до и после scroll.
  Обязателен negative probe для прежнего fail-open/unsupported режима.
- Shared media, pagination, source-builder и caching изменения должны проверять
  соседние consumer routes. Третий рецидив одного problem key требует общего
  regression guard и structural task; ещё один локальный point fix сам по себе
  не закрывает семейство проблемы.

### 3.4 Координация долгих операций

- Деплой, release/build, production web build, Android local build/install,
  iOS simulator/archive/EAS/upload/submit, server rebuild/restart,
  full/preflight проверки, Playwright/e2e, Lighthouse и другие долгие операции
  с общими артефактами считаются эксклюзивными.
- Перед запуском такой операции проверь, не идет ли уже операция того же типа и target: активные процессы (`ps`/`pgrep -af` по `build-prod.sh`, `deploy-frontend.sh`, `npm run`, `playwright`, `lighthouse`, `expo export`, `eas build`, `eas submit`, `gradlew`, `expo run:android`, `adb install`, `xcodebuild`, `simctl`, `expo run:ios`, `docker compose`, `nginx`, `systemctl`) и lock-файлы вроде `dist/.prod-build.lock` или `.codex-temp/ops/*.lock`, если они есть.
- Если другой агент уже запустил deploy/build/rebuild для того же target, не запускай второй экземпляр: используй уже идущую операцию, дождись её только когда результат обязателен для твоего scope, либо зафиксируй blocker с PID, командой и target.
- Для test/quality gate действует отдельное non-waiting правило: если живой `.codex-temp/ops/quality-gate.lock` или активный quality-процесс уже существует, текущий чат сразу прекращает свой запуск. Не жди, не poll'и, не следи за завершением, не повторяй команду после освобождения lock и не запускай более узкий обходной тест.
- Если активный gate по своему scope покрывает проверки текущей задачи,
  `validation delegated: active gate pid/name` фиксирует только coordination,
  не `passed`. Не закрывай и не паркуй задачу из-за этого: запроси результат
  владельца gate и продолжи acceptance после ответа. Если scope не покрывает
  задачу, `validation skipped: active gate pid/name` так же не является board
  verdict; запроси точную разблокировку/результат для обязательного шага.
- Чат, который первым запустил gate, владеет его результатом и исправлениями.
  Остальные чаты не дублируют работу; приёмщик запрашивает результат у владельца
  и не завершает статусный проход до него.
- Не убивай и не перезапускай чужой процесс без явной команды пользователя или документированного safe-wrapper'а. Если lock явно stale, сначала зафиксируй почему он stale, затем аккуратно очисти lock и продолжай.
- Если запускаешь новую долгую операцию без собственного lock механизма, оставь короткий marker в `.codex-temp/ops/` и удали его после завершения.
- `build-prod.sh` удерживает общий `.codex-temp/ops/web-build.lock` до конца полного цикла build + SEO + deploy. Не обходи этот wrapper: прямой `expo export` или запуск `scripts/build-web-safe.js` параллельно с deploy запрещен.
- Основные test/quality команды (`check:fast`, `check:changed`, `check:e2e:changed`, `check:preflight`, `test:run`, `e2e`, `release:check`) обязаны запускаться только через общий `scripts/run-with-quality-gate-lock.js`. Он использует атомарный `.codex-temp/ops/quality-gate.lock`, сообщает PID владельца и при живом владельце сразу возвращает нейтральный `SKIPPED` с кодом `0`, чтобы чат завершил собственный запуск без ожидания/ретрая. `SKIPPED` нельзя записывать как `passed` или финальный Testing verdict: acceptance запрашивает результат владельца и продолжается после него. Lock умершего процесса восстанавливается автоматически. Общая Jest-конфигурация применяет тот же контракт к прямому `npx jest`. Не обходи wrapper прямым Playwright-запуском.
