# Operational workflow protocols

Ситуативные протоколы рабочего процесса, подключаемые из `AGENTS.md` §4.
Правила не изменились — изменился момент загрузки: читать нужный раздел тогда,
когда задача его касается, а не в каждой сессии.

Карта:

- локальный стек и обязательное обновление бэкенда перед проверкой →
  «3.0 Локальный стек и обновление бэкенда перед тестированием»;
- e2e-доступы и board token → «3.1 E2E окружение и доступы»;
- создание/удаление тестовых сущностей на проде → «3.1.1 Тестовые данные на production»;
- сборка и прогон на USB-устройстве → «3.2 Android device testing and builds»;
- Xcode/iPhone+iPad simulator/physical Apple device/TestFlight → «3.2.1 iOS testing and release operations»;
- матрица разрешений iOS и QA удаления аккаунта → «3.2.2 iOS permission matrix и account-deletion QA»;
- baseline/after на живом URL, закрытие perf/media/network задач → «3.3.1 Production-target validation and task closure»;
- deploy/build/e2e/Lighthouse и общие locks → «3.4 Координация долгих операций»;
- AWS, облачный экспорт и другие платные ресурсы → «3.4.1 Платные ресурсы и AWS»;
- штатный запуск прод-деплоя из общего чекаута → «3.5 Деплой из изолированного
  worktree»;
- свежесть бэкапа прод-базы и дата пробного восстановления → «3.7 Бэкап
  прод-базы: свежесть копий и пробное восстановление».

Обязательный минимум остаётся в `AGENTS.md`: common/shared responsive UI
проверяется desktop web + mobile web, а device gate применяется только к
platform-specific behavior/config/runtime (§2 «Обязательный preflight»); правило
quality-gate lock — в §5 «Validation и handoff».

### 3.0 Локальный стек и обновление бэкенда перед тестированием

Локальные development/runtime-пробы используют стек этой машины (`AGENTS.md` §4,
«Условные контракты»). Приёмка после review/push/deploy использует production по
§3.3.1; ради production-only smoke локальный стек не запускается и не обновляется.
Дев `192.168.50.36` подключается только по явному запросу владельца точечной
переменной окружения; правка дефолтов ради dev/prod запрещена.

**Обновление бэкенда обязательно ДО первой локальной runtime-пробы сессии тестирования.**
Локальный checkout отстаёт молча и API при этом отвечает `200`: замер 29.08.2026 —
26 коммитов позади `origin/master`, шесть неприменённых миграций. Такой бэк
выдаёт ложные дефекты фронта («поле не сохраняется», «404 на новом эндпоинте»),
которые уходят в карточки и съедают проход. Пропуск шага — не экономия времени.

`../metravel-backend` — симлинк на `/Users/juliasavran/Sites/metravel/metravel`,
это один и тот же checkout: и читаемый агентами исходник, и то, что реально
запускается локально.

Перед обновлением проверь владельца активной backend-работы и
`git -C ../metravel-backend status --short --branch`. Если checkout занят или
есть незакоммиченные файлы, согласуй запуск с владельцем либо используй
согласованный чистый checkout/стек той же ревизии. Локальный runtime по
непроверенной ревизии не считается evidence. Не сбрасывай чужие правки.

Для свободного чистого backend checkout на `master`:

```bash
(
  set -e
  cd ../metravel-backend
  test "$(git branch --show-current)" = master
  test -z "$(git status --porcelain)"
  BEFORE=$(git rev-parse HEAD)
  git fetch origin master
  git merge --ff-only origin/master
  test "$(git rev-parse HEAD)" = "$(git rev-parse origin/master)"
  git diff --name-only "$BEFORE"..HEAD -- '*/migrations/*' pyproject.toml uv.lock 'docker-compose-local*'
)
```

При расхождении ревизий или ошибке останови обновление; не используй
`reset --hard`, `stash` или `rebase` ради запуска чужого стека.

Дальше по тому, что приехало в диапазоне:

- есть `migrations/` — применить (Django читает окружение из `local_env.sh`):
  ```bash
  cd /Users/juliasavran/Sites/metravel/metravel && set -a && . ./local_env.sh && set +a \
    && .venv/bin/python manage.py migrate
  ```
- менялись `pyproject.toml`/`uv.lock` — `uv sync --frozen --dev --no-install-package gdal`
  (`gdal` на macOS не собирается и коду не нужен);
- менялся `docker-compose-local.infrastructure.yaml` — `docker-compose -f
  docker-compose-local.infrastructure.yaml up -d`;
- в любом случае перезапустить `bash /Users/juliasavran/Sites/metravel/run-backend.sh`:
  runserver подхватывает код автоперезагрузкой, но не миграции и не контейнеры.
  Рестарт не формальность — на прогоне 29.08.2026 автоперезагрузка не пережила
  `reset --hard` на 26 коммитов: родительский процесс остался жив, а порт 8000
  никто не слушал. Поэтому живость проверяется портом/ответом API, а не наличием
  процесса в `ps`; повисший процесс снимается `pkill -f 'manage.py runserver'` и
  поднимается заново.

Готовность к первой пробе доказывается четырьмя проверками, а не тем, что
«сайт открылся»:

```bash
# запускать из фронтового репозитория; блок с миграциями уходит в subshell,
# чтобы cd в бэкенд не унёс за собой рабочую директорию
git -C ../metravel-backend log -1 --format='%h %ci %s'          # совпадает с origin/master
( cd /Users/juliasavran/Sites/metravel/metravel && set -a && . ./local_env.sh && set +a \
  && .venv/bin/python manage.py showmigrations --plan | grep -c '^\[ \]' )   # 0 неприменённых
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:8000/api/travels/  # 200
grep -E '^EXPO_PUBLIC_(API_URL|IS_LOCAL_API)=' .env   # localhost:8000 + false
```

Последняя проверка не формальность: `.env` — общий файл всех параллельных
сессий, и содержимое ему меняет не только человек. `build-prod.sh` копирует
`.env.prod` поверх него на время сборки (с 08.09.2026 возвращает исходник
EXIT-trap'ом, #1881), e2e-прогон оставляет там свой адрес, а прерванный деплой
до фикса оставлял гибрид `APP_ENV=production` с мёртвым локальным API. Именно
так `.env` и был найден 29.08.2026 — с `EXPO_PUBLIC_API_URL=https://metravel.by`
при живом локальном бэке. Правильные значения для локальной проверки:

```
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_IS_LOCAL_API=false
```

Фронт против него — `npx expo start --web` или готовый launch-конфиг
`Local Stack Web 8081` из `.claude/launch.json` (`preview_start`). Дефолтом
`localhost:8000` служит только `DEFAULT_DEV_API_HOST` в `metro.config.js:36`, и
он проигрывает: прокси берёт `EXPO_PUBLIC_API_URL` из `.env`, когда тот задан
(`metro.config.js:318`). Поэтому строка `.env` проверяется каждый раз — замер
06.09.2026 застал там `https://metravel.by`. На web держать
`EXPO_PUBLIC_IS_LOCAL_API=false`: с `true` запросы уходят в CORS-прокси Metro,
тот теряет порт бэкенда и ссылки на картинки уезжают на `http://localhost/...`.
Именно `localhost`, а не `127.0.0.1` — cookie `authToken` приходит
`SameSite=Lax; Secure`, same-site между `localhost:8081` и `localhost:8000`
держится. Устройство целится на тот же бэкенд по текущему LAN-IP мака
(`ipconfig getifaddr en0`) с `EXPO_PUBLIC_IS_LOCAL_API=true`.

#### Один Metro на машину, порт 8081

Metro на машине **один**, и его порт — `8081` (launch-конфиг `Local Stack Web
8081`). Перед тем как что-то поднимать, порт пробуется:

```bash
curl -s -o /dev/null -w '%{http_code}\n' --max-time 60 http://localhost:8081/
```

Ответил `200` — работать на нём, **даже если его подняла другая сессия**. Дерево
у всех сессий общее, Metro собирает бандл из того же рабочего дерева, поэтому
правка текущей сессии в чужом дев-сервере уже есть; отдельный порт не даёт
изоляции, которой можно было бы это оправдать.

Свой порт поднимается только по двум причинам, и обе проверяются, а не
предполагаются:

1. ни один Metro не отвечает (процесса нет или он не дожил до `200`);
2. чужой целится не в тот API. **`ps eww` для этого не годится**: `expo` читает
   `.env` ПОВЕРХ переменных процесса, поэтому сервер с честным
   `EXPO_PUBLIC_API_URL=http://localhost:8000` в окружении раздаёт бандл,
   зашитый на `https://metravel.by`, если такая строка лежит в `.env` (её туда
   кладёт `build-prod.sh` после каждого прод-деплоя). Спрашивать надо сам бандл:

   ```bash
   curl -s 'http://localhost:8081/api.bundle?platform=web&dev=true' \
     | grep -o 'https://metravel\.by' | head -1     # пусто = локальный API
   ```

   Дешевле и надёжнее — открыть страницу и посмотреть, куда ушли запросы: на
   прод-бандле они падают с `CORS ... blocked` на `https://metravel.by/api/...`,
   а экран показывает «Не удалось загрузить поездку». Мутирующая приёмка на
   таком сервере уедет на прод, поэтому свой Metro поднимается с
   `EXPO_NO_DOTENV=1` и явными `EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_IS_LOCAL_API`
   — так же, как это делают launch-конфиги в `.claude/launch.json`.

Почему это правило, а не вкусовщина: каждый Metro стартует с
`--max-old-space-size=12288` и держит собственный граф модулей. Два-три
параллельных дев-сервера на одной машине не «изолируют сессии», а отбирают
память друг у друга — и умирают все сразу, уже на середине чужой приёмки
(наблюдалось 08.09.2026: поднятый соседом сервер на 8082 отвалился
`ERR_CONNECTION_REFUSED` посреди прогона). Один тёплый сервер надёжнее трёх
холодных.

Если порт всё же поднимается свой, он берётся ТОЛЬКО из доверенного списка
прокси бэкенда — `8081, 8082, 8085, 19006`
(`metravel/envs/local/settings.py:19`, `LOCAL_SELF_PROXY_PORTS`). Любой другой
порт проходит чтение и молча ломается на первой мутации: CSRF-origin не совпал.

Занятый порт `expo start` не объявляет ошибкой: в неинтерактивном режиме он
печатает `Input is required… Use port 8083 instead?` и `Skipping dev server`,
после чего выходит с ненулевым кодом, не подняв ничего. Увидев эту строку в
логе, не ждать свой порт, а идти на тот, что уже занят — он и есть рабочий.

Ограничения локального стека, которые НЕ являются дефектами и не заводятся
карточками:

- S3 — только бакет `metravellocal`, у старых прод-статей картинки отдают 404.
  Для медиа-проб заводится своя тестовая статья; прод-бакет локально запрещён.
- SSG-шелла, прод-кэша и прод-nginx здесь нет: perf/LCP/CLS/SEO-утверждения про
  прод локальным прогоном не доказываются — см. «3.3.1 Production-target
  validation and task closure».
- `build-prod.sh` подменяет `.env` на `.env.prod` на время сборки и возвращает
  исходник EXIT-trap'ом — включая Ctrl-C и `kill` (#1881). Строку
  `EXPO_PUBLIC_API_URL=http://localhost:8000` всё равно видно перед первой
  пробой: файл общий, и туда пишет не только деплой.

Лежащий дев-стенд и прод-инфраструктура — зона владельца: агенты их не поднимают
и не чинят. Полное описание локального стека (данные, вход, секреты, S3) —
`/Users/juliasavran/Sites/metravel/README-local.md`.

### 3.0.1 Окружение нового worktree или shared clone

Из корня нового checkout нашего frontend запусти `npm run worktree:bootstrap`.
Команда находит основной checkout через Git worktree metadata; для
`git clone --shared <локальный-frontend> <target>` проверяет local origin,
object alternates и происхождение HEAD. Источник должен завершаться нашим
каноническим frontend origin `kelios/metravel2`; произвольный `--source` не
принимается. В основном checkout команда сообщает, что подготовка не нужна.

По умолчанию копируются `.env`, `.env.prod`, `.env.e2e` и проверенные по
`workers/book-renderer/fonts.lock.json` файлы `.codex-temp/book-renderer-fonts/`.
Это независимые копии: build/e2e могут перезаписывать `.env`, поэтому симлинк
на основной checkout изменил бы чужое окружение. Содержимое не выводится;
отсутствующие источники перечисляются без создания фиктивных значений.
Существующие файлы сохраняются; обновление — только явным
`npm run worktree:bootstrap -- --force`. Symlink-компоненты, tracked или
не ignored пути отклоняются до копирования. Основной checkout не изменяется.

`node_modules` bootstrap не копирует. Harness-worktree (`.claude/worktrees/*`)
бывает создан с копией `node_modules` старше `yarn.lock` — тогда jest идёт на
других версиях тестового стека и красит чужие тесты (#2915: RNTL 13.3.3 вместо
14.1.0). Перед первым jest в таком worktree выполни `yarn install
--frozen-lockfile`. `check:fast` и pre-commit сверяют версии
`@testing-library/react-native`, `test-renderer`, `react-dom` и `jest` с
`yarn.lock` (`scripts/check-installed-test-deps.js`) и при расхождении падают до
запуска проверок с этой подсказкой.

Для разрешённой локальной Android-операции опция `--android-secrets` добавляет
только пять потребляемых файлов в `.secrets/`: `metravel-android-prod.env`,
`google-services.json`, `metravel-android-release.json`,
`metravel-android-upload.jks`, `google-play-service-account.json`.
Это подготовка файлов, а не разрешение build/upload/release. Остальная
`.secrets/`, `.env.dev`, `.env.deploy`, credentials из внешних директорий и
неизвестные cache-файлы не переносятся. Env/secrets создаются с режимом `0600`.

`node_modules`, `ios/Pods` и generated `android/` не копируются и не
симлинкуются bootstrap-командой. Зависимости устанавливаются отдельно по
frozen lockfile; Android затем готовится `npm run android:prebuild`, iOS —
штатным `npm run ios:prebuild` и CocoaPods при необходимости, с UTF-8 locale
(`LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install` из `ios/`). Эти команды
проходят обычные operation/release gates и могут менять native source.
Bootstrap их автоматически не запускает, main/clean-source guards не отменяет.

Проверка: fresh checkout → bootstrap → повтор (существующие файлы сохранены)
→ focused `bookRendererWorker` → `npm run build:web:prod -- --allow-dirty`
→ `E2E_SUITE=smoke npm run e2e`. Quality/build locks и подготовка backend
перед локальным runtime остаются обязательными. Если источника нет и в основном
checkout, настрой нужное окружение там; fonts готовятся
`node scripts/prepare-book-renderer-fonts.js` по существующему pinned lock.

### 3.1 E2E окружение и доступы

- Для e2e-авторизации и тестовых доступов используй переменные из `.env.e2e`.
- Не запрашивай у пользователя повторно логин/пароль, если они уже заданы в `.env.e2e`.
- Никогда не выводи секреты из `.env.e2e` в ответах, логах, скриншотах и коммитах.
- **Роль e2e-аккаунта 104 (#2302, проверено 06.10.2026).** Read-only
  `GET /api/user/me/` вернул `id=104`, `is_superuser=true`; поле `is_staff`
  отсутствовало. Каноническое состояние клиента — `isSuperuser="true"`.
  Edit/admin controls для этого аккаунта ожидаемы по действующему permission
  contract; их не скрывают ради гостевого или обычного пользовательского QA.
  Для таких сценариев выбирают соответствующий контекст авторизации.
  Evidence без секретов: `.codex-temp/todo-20261006/shell/account-104-roles.json`.
- Если task-board API/MCP отвечает `HTTP 401`, обнови staff token через программный login из `.env.e2e` по `docs/TASK_BOARD_MCP.md`, перезапиши `.secrets/metravel-task-board.env` без вывода токена и повтори `/api/tasks/`, `/api/tasks/board/`, `/api/sprints/`.
- **Согласие с условиями у e2e-аккаунтов (#2173).** Прямой `POST /api/user/login/`
  не пишет согласие, которое настоящий вход пишет с формы, а без текущей версии
  условий лист повторного согласия перекрывает любой авторизованный экран.
  `e2e/global-setup.ts` после входа приводит `E2E_EMAIL` и `E2E_EMAIL2` к принятой
  версии (`ensureCurrentTermsAccepted` — те же записи, что «Принять» на листе),
  кроме прода: там согласие пишет только человек, setup лишь предупреждает.
  Проба «сессия жива?» из Node — токеном `webAuthTokenFromCookies` в заголовке
  `Authorization: Token`: банк cookie на `http://127.0.0.1` Playwright не отправит.

- **Аккаунты для Apple App Review (с 12.09.2026).** Постоянный reviewer demo,
  выданный Apple, хранится в `.env.e2e` как `APP_REVIEW_DEMO_EMAIL` /
  `APP_REVIEW_DEMO_PASSWORD`: им входят в сцене `login`, и (решение владельца
  21.09.2026) от него же публикуются комментарии редакции под статьями — в
  интерфейсе он подписан «Редакция metravel», user id 120; рецепт токена —
  `.claude/skills/metravel-travel-article/SKILL.md`, шаг 7. Аккаунт не удаляют
  и не показывают в паролях/скриншотах/борде. Одноразовые аккаунты для
  регистрации и удаления — Gmail plus-адреса того же ящика
  (`<local-part>+appleqa-<YYYYMMDD>-<n>@gmail.com`): письма активации приходят
  в тот же ящик, вкладку Gmail владелец держит открытой, либо активацию
  закрывает рецепт токена из базы ниже. Автор для сцен жалобы/блокировки —
  существующий `E2E_EMAIL2`; после записи агент сам снимает блокировку и убирает
  созданную жалобу по «Уборка тестовых жалоб и модерационных заявок» ниже.
  Сценарии и запись —
  `$metravel-app-review-director`, проверка пакета —
  `$metravel-app-review-evidence`. Постоянный Mailpit для локального стека —
  отдельная backlog-карточка, не условие записи.

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
    Доступ к базе: `source scripts/deploy-target.sh` даёт `PROD_SSH_TARGET` и
    резолв имени контейнера. Имя не вписывать вручную — compose меняет
    разделитель при пересоздании (#1636): сначала
    `DB_CTR="$(metravel_resolve_container_over_ssh metravel-gis)"`, дальше
    `ssh "$PROD_SSH_TARGET" "docker exec -i $DB_CTR sh -c
    'psql -U \$POSTGRES_USER -d \$POSTGRES_DB -tA'"` и SQL через stdin heredoc.
    Две грабли: `deploy-target.sh` работает только из bash (из zsh тихий exit 1),
    а SQL внутри `psql -tAc \"…\"` через ssh рвётся на вложенных кавычках —
    поэтому именно heredoc, а не `-c`.
    Аккаунт, созданный под проверку удаления, этой же проверкой и уничтожается,
    так что многоразовый актив здесь — рецепт, а не конкретная учётка.

#### Уборка тестовых жалоб и модерационных заявок

Обязательно для любого QA, e2e и записи сценария на local/production,
в браузере, симуляторе и на устройстве. Ответственность несёт агент,
создавший тестовые данные; передача id владельцу уборкой не считается.

- До создания зафиксируй окружение, уникальный маркер прогона (например,
  `qa-report-<date>-<run-id>`), тестовый аккаунт и целевой объект. После ответа
  сразу запиши точный id жалобы/заявки и её автора в cleanup-реестр прогона
  в ignored evidence-каталоге. Маркер добавляй в тестовое описание; общего
  слова «test» или тестового аккаунта недостаточно для массового удаления.
- Планируй cleanup до мутации. Автоматизация выполняет его в `finally` или
  fixture teardown даже при падении сценария; ручной QA выполняет тот же шаг
  перед завершением прохода. Сохрани реестр сразу после создания, чтобы после
  аварийного прерывания следующий проход начал с незавершённой уборки.
- Убирай только записи, созданные этим прогоном и подтверждённые точными id,
  маркером и автором. Используй разрешённое удаление через API/admin; если
  удаления нет — штатное отклонение/закрытие (`dismiss`/`resolve` по контракту
  сервиса) с пометкой «тестовая жалоба, cleanup <run-id>». Для закрытия тестовой
  жалобы запрещено применять `ban`/`remove` к реальному пользователю или
  контенту. Сними созданные прогоном тестовые блокировки.
- Проверь итог чтением каждой записи (удалена или в закрытом статусе),
  отсутствием её id в открытой очереди модерации и отсутствием ожидающих
  напоминаний/уведомлений по этим id, включая ночной дайджест. Общую очередь
  и уведомления реальных пользователей не очищай. Evidence включает id,
  результат cleanup и проверок; одного успешного HTTP-ответа недостаточно.
- Если cleanup или проверка уведомлений недоступны, укажи точные оставшиеся id,
  состояние и нужное действие для разблокировки (доступ/роль/API), затем
  продолжи тот же проход после разблокировки. Не объявляй QA/задачу `done`
  с незавершённой уборкой и не перекладывай закрытие заявок на владельца.

### 3.2 Android device testing and builds

Этот раздел выполняется только после code-review pass, commit/push и перехода
frontend-тикета в `testing`. Implementation и `review` передают сюда exact
`AND-USB-*` сценарий, но не подключают устройство.

- Android EAS/cloud builds and submits are disabled by project policy: do not run
  `eas build --platform android`, `eas submit --platform android` or any
  `--platform all` command. Android production artifacts are built locally by
  `npm run android:build:prod`; store operations use the project Google Play API
  script. Re-enabling Android EAS requires a new explicit user decision.
- На новом компьютере production signing и Android production env берутся из
  переносимого `.secrets` bundle через `npm run android:release:doctor` и
  `npm run android:build:prod`; ручная настройка macOS Keychain не требуется.
- Local Android store build, upload/submit, and release each require the user's
  explicit authorization for that stage in the current task. Reuse authorization
  already given in the conversation; one stage does not authorize the next.
  This never authorizes changing `alpha`, `internal`, `beta`, tester lists,
  countries, or the active closed-testing release.
- Android-specific сценарий проверяется локальной сборкой на нужном эмуляторе;
  выбор слоя и повторное использование evidence — `docs/TESTING.md` →
  «Risk-based validation and evidence reuse». Shared-код не создаёт native gate.
- Для физических capabilities или явно заданного USB/release gate сначала
  проверь `adb devices -l`, затем установи локальную сборку на телефон
  (`cd android && ./gradlew :app:installDebug` или `:app:assembleDebug` +
  `adb install -r ...`) и прогони только релевантные `AND-USB-*`.
- Перед любой native-пробой (эмулятор, USB, dev-client с Metro) — `npm run
  native:stamp:check` (#2469). Локальная сборка (`npm run android:build:dev`,
  `android:build:prod`) пишет рядом с артефактом `*.native-stamp.json`: версии
  всех пакетов с нативным кодом, нативные секции `app.json`, патчи и sha256
  бинарника. Проверка краснеет, если (а) набор нативных зависимостей чекаута
  разошёлся со штампом — пересобрать, список дрейфа в выводе; (б) на устройстве
  стоит не тот APK, что собран, — установить свой. Без этого устаревший бинарник
  падает в нативном коде без читаемой ошибки (worklets 0.10.0 против JS 0.10.1 —
  SIGABRT через секунду после `Running "main"`), а «свежая сборка тоже падает»
  оказывается непроверенным: на эмуляторе остаётся старый APK. Сборку вне
  скрипта штампуют вручную: `npm run native:stamp -- <apk|aab|.app>`.
- Не заменяй Android device validation mobile-web viewport, Expo web export, EAS preview/development/production build или dev-client/export flow без явного разрешения пользователя.
- `unauthorized`, отсутствие устройства или поломка локальной сборки/установки фиксируй конкретно: команда, результат и следующий безопасный шаг.

### 3.2.1 iOS testing and release operations

iOS simulator/physical/TestFlight QA запускается только в `testing` после
code-review pass. Release operations сохраняют отдельные authorization gates.

- Активный первый iOS release — universal iPhone/iPad. Для iPad-specific
  configuration/runtime обязательны simulator-проверки full-screen,
  resizable window, portrait и landscape; перед App Review нужны iPad
  screenshots и exact TestFlight acceptance.
- Нативный проект `ios/` tracked, но воспроизводим из конфига (#2742): все
  iOS-кастомизации (имя проекта `metravel`, `InfoPlist.strings` RU/BE/UK/PL/EN,
  `PrivacyInfo.xcprivacy`, Podfile-правки, версии через `MARKETING_VERSION`,
  портретный iPhone, состав Info.plist) — в `plugins/withIosNativeProject.js` и
  `app.json`. Руками `ios/` не правят: меняют плагин/конфиг, затем
  `npx expo prebuild --clean --platform ios && (cd ios && LANG=en_US.UTF-8
  LC_ALL=en_US.UTF-8 pod install)` и коммитят результат. `npm run
  ios:native:parity` (входит в `ios:prebuild`) сверяет tracked-проект с
  генерацией: файлы байт в байт, `project.pbxproj` — без учёта интеграции
  CocoaPods. Нужен `.env` с ключами Meta: их подставляет `app.config.js`.
- Для iOS-specific behavior/config/runtime задачи сначала проверь `xcode-select -p`,
  `xcodebuild -version` и eligible destinations через `xcodebuild
  -showdestinations`/`xcrun simctl list devices available`. Отсутствующий runtime
  — конкретный environment blocker, а не повод считать QA пройденной.
- Симуляторная сборка (`xcodebuild … -sdk iphonesimulator`) штампуется так же:
  `npm run native:stamp -- <путь>/metravel.app`, перед QA —
  `node scripts/native-build-stamp.js check --ios --artifact <путь>/metravel.app
  --device` (сравнивает исполняемый файл в контейнере симулятора со штампом и
  нативный набор с чекаутом; #2469, см. 3.2).
- Simulator используется для compilation, startup, basic navigation/UI, locales,
  safe areas, keyboard, iPad window geometry и deterministic error states. Physical iPhone обязателен
  для camera/photo/HEIC, Keychain/biometrics, APNs, Universal Links, sharing,
  permission allow/deny/restricted behavior и lifecycle.
- Exact processed TestFlight build — acceptance boundary перед App Review. Local
  debug/simulator build не доказывает signing, embedded production config,
  entitlement/APNs behavior или App Store processing.
- Перед `xcodebuild`, Expo/EAS iOS build, archive, upload или submit проверь
  operation gate и не запускай дубликат того же target/build number.
- Source `ios:release:guard` не заменяет проверку результата EAS/Xcode. Перед
  каждым upload exact signed IPA обязан пройти `ios:artifact:audit`: compiled
  Info.plist/minimum OS/purpose strings, privacy resources, production bundle,
  provisioning, signature и signed entitlements. Upload wrapper выполняет
  этот gate автоматически и останавливается до App Store Connect transport.
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
| Notifications | **локальные**, не push: напоминание о незаконченном квесте (геофенсинг удалён — PERM-4) | `components/quests/useQuestReminder.native.ts` |

В принятом source `8ae84cb56` и build 9 remote push включается по действию
пользователя в `NotificationSettingsSection.native.tsx`: обработчик вызывает
`requestAndRegisterPushNotifications`. На старте `usePushNotifications()`
синхронизирует только уже выданное разрешение (`requestPermission: false` в
`services/pushRegistration.native.ts`). Подписанный IPA build 9 содержит
`aps-environment=production`. Отсутствие системного запроса на старте ожидаемо;
отдельно проверяй пользовательское включение push и доставку. Наличие кода или
entitlement само по себе не доказывает успешную доставку уведомления.

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

- Объём повторной приёмки выбирается по `docs/TESTING.md` → «Risk-based validation
  and evidence reuse»: обычный выкат получает узкий production smoke и повторно
  использует совместимые локальные результаты. Полный flow повторяется только
  для изменившегося контракта, production-specific риска или заданного release gate.
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

### 3.3.2 Помощник прод-проб (Playwright)

Приёмка в `testing` не пишет обвязку Playwright с нуля (#2074: приёмка #2047 —
20 минут и 82 вызова, большая часть на вход, согласие и перехват сети).
Помощник — `e2e/prod-probe/prodProbe.js`, CommonJS, запускается обычным `node`
из корня репозитория; пробный скрипт кладётся в ignored `.codex-temp/`.

```js
// .codex-temp/probe-<id>.js
const {
  openProdProbe, readLocalStorage, captureRequests, buildSource, formatProbeError,
} = require('../e2e/prod-probe/prodProbe')

;(async () => {
  console.log((await buildSource()).sha) // выкаченный sha
  const probe = await openProdProbe({ viewport: 'mobile' }) // narrow 320 | mobile 390 | desktop 1440
  try {
    const api = captureRequests(probe.page, '/api/trips/')
    await probe.goto('/trips/plan/59')
    console.log(api.summary(), await readLocalStorage(probe.page, ['userId']))
  } finally {
    await probe.close()
  }
})().catch((error) => {
  // Не stack/message: у ошибок Playwright там «Call log» с cookie сессии.
  console.error(formatProbeError(error))
  process.exitCode = 1
})
```

- Вход только под `E2E_EMAIL`/`E2E_PASSWORD` из `.env.e2e` (аккаунт 104).
  Совпадение `E2E_EMAIL` с `E2E_EMAIL2` (владелец) — отказ до запуска браузера;
  вход, вернувший id ≠ 104, не сохраняется и роняет пробу.
- Сессия — `.codex-temp/prod-probe/storageState.<host>.json` (права 0600).
  Переиспользуется, пока cookie `authToken` жива и `GET
  /api/user/me/verifications/` отвечает 2xx; иначе один вход через
  `POST /api/user/login/`. `fresh: true` / `--fresh` — принудительный вход.
- `consent: 'necessary'` (дефолт) пишет `metravel_consent_v1` в формате
  `utils/consent.ts` до загрузки страницы; `'all'` — с аналитикой; `false` —
  баннер остаётся (проба самого баннера). `auth: false` — гость.
- `captureRequests(page, pattern)` → `entries` с `body()` по запросу (читать до
  ухода со страницы) и `summary()` для JSON; тела login/refresh/token-ответов
  не отдаются, ключи `*token*`/`*refresh*`/`*password*` в JSON маскируются.
- Ошибки печатать только через `formatProbeError(error)`: `error.message`
  Playwright несёт «Call log» со всеми заголовками, включая `cookie: authToken=…`.
- **Гость → вход посреди сценария** (намерение гостя, которое должно завершиться
  после входа, #2898): начать в контексте без сессии, выполнить гостевое
  действие, затем в ТОТ ЖЕ контекст добавить cookie из
  `storageState.metravel.by.json` (`context.addCookies(state.cookies)`) и ключи
  `userId`/`userName`/`isSuperuser` из его `origins[].localStorage`, перейти на
  страницу возврата. Форма входа и пароль не нужны — это та же живая сессия
  аккаунта 104. Перед прогоном проверить, что у 104 нет состояния, которое
  проверка перезапишет; после — удалить созданное (код ответа в evidence).
- Смоук и образец: `node e2e/prod-probe/smoke.js [--fresh] [--viewport=mobile]
  [--trip=<id>]` — одна JSON-строка (sha, user id, кэш сессии, баннер,
  localStorage, запросы `/api/trips/`), exit 1 при провале.

Помощник не заменяет правила §3.1.1: мутации на проде — только обратимые и
только тестовыми данными аккаунта 104.

### 3.4 Координация долгих операций

- Если готовую разработку можно передать живой сессии ближайшего выката,
  используй `docs/RULES.md` → «Delivery-owner handoff across sessions»: она
  забирает все оставшиеся проверки и выпуск, отправитель после принятия
  закрывается. Не держи сессию разработки в ожидании quality/deploy lock;
  общий лок и обязательные гейты принимающая сессия соблюдает без обходов.
- Деплой, release/build, production web build, Android local build/install,
  iOS simulator/archive/EAS/upload/submit, server rebuild/restart,
  full/preflight проверки, Playwright/e2e, Lighthouse и другие долгие операции
  с общими артефактами считаются эксклюзивными.
- Перед запуском такой операции проверь, не идет ли уже операция того же типа и target: активные процессы (`ps`/`pgrep -af` по `build-prod.sh`, `build-dev.sh`, `npm run`, `playwright`, `lighthouse`, `expo export`, `eas build`, `eas submit`, `gradlew`, `expo run:android`, `adb install`, `xcodebuild`, `simctl`, `expo run:ios`, `docker compose`, `nginx`, `systemctl`) и lock-файлы вроде `dist/.prod-build.lock` или `.codex-temp/ops/*.lock`, если они есть.
- Если другой агент уже запустил deploy/build/rebuild для того же target, не запускай второй экземпляр: используй уже идущую операцию, дождись её только когда результат обязателен для твоего scope, либо зафиксируй blocker с PID, командой и target.
- Для test/quality gate действует отдельное non-waiting правило: при живом `.codex-temp/ops/quality-gate.lock` или активном quality-процессе в том же checkout текущий чат сразу прекращает свой запуск. Не жди, не poll'и, не следи за завершением, не повторяй команду после освобождения lock и не запускай более узкий обходной тест.
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
- `build-prod.sh` удерживает общий `.codex-temp/ops/web-build.lock` до конца полного цикла build + SEO + deploy. Путь лока считается от общего `.git` (`scripts/build-lock.js`), поэтому он один и тот же для основного чекаута и всех его worktree: до #2013 сборка из worktree брала свой лок и параллельную сборку из соседнего дерева не видела. Сборки из одного `git-common-dir` и сборки с общим таргетом выполняются последовательно через штатные wrapper-команды.
- Этот лок локальный: выкат из другого клона репозитория или с другой машины он не видит (инцидент 11.11.2026, #3307). Порядок таких выкатов держит не лок, а сверка живой ревизии в момент публикации и отказ сервера `publish-code --expect-current` — §3.5, «Сверка в момент публикации».
- Основные test/quality команды (`check:fast`, `check:changed`, `check:e2e:changed`, `check:preflight`, `test:run`, `e2e`, `release:check`) обязаны запускаться только через общий `scripts/run-with-quality-gate-lock.js`. Он использует атомарный `.codex-temp/ops/quality-gate.lock`, сообщает PID владельца и при живом владельце сразу возвращает нейтральный `SKIPPED` с кодом `0`, чтобы чат завершил собственный запуск без ожидания/ретрая. `SKIPPED` нельзя записывать как `passed` или финальный Testing verdict: acceptance запрашивает результат владельца и продолжается после него. Lock умершего процесса восстанавливается автоматически. Общая Jest-конфигурация применяет тот же контракт к прямому `npx jest`. Не обходи wrapper прямым Playwright-запуском.

#### Полный цикл качества в отдельном клоне

Для отдельной задачи на полный прогон и исправление линтера, Jest и Playwright
с самого начала используй временный локальный клон собственного frontend
репозитория с отдельным `git-common-dir` и веткой `main`. У linked worktree
сборочный lock общий с основной копией. Отдельный порт в том же checkout
оставляет общими `.env`, `dist` и lock.

1. Сними SHA и список принадлежащих задаче изменений. Создай локальный
   `git clone --shared --branch main --single-branch <primary> <scratch>` в
   ignored `.codex-temp/`. Перенеси только нужные для прогона изменения явными
   путями, а также зафиксируй, какие правки из общей рабочей копии вошли в снимок.
2. Из корня клона выполни `npm run worktree:bootstrap`. Подготовь отдельный
   `node_modules` установкой по `yarn.lock` или локальной копией проверенных
   зависимостей. Metro пишет кеш в `node_modules/.cache`, поэтому для сборки
   нужен собственный каталог зависимостей. Для полного Jest сгенерируй
   `android/` в клоне командой `node node_modules/expo/bin/cli prebuild -p android --no-install`.
   Проверки Android-конфигурации читают полученные Gradle-файлы и манифест.
   Сверь tracked diff клона со снимком и убери только изменения, которые
   создал prebuild в отслеживаемых файлах.
3. Оставь штатные `npm run lint`, `npm run test:run` и `npm run e2e`.
   Укажи свободный `E2E_WEB_PORT` и передавай пути отчётов и артефактов
   относительно корня клона. Абсолютный путь аргумента в основной checkout
   связывает процесс с ним при проверке конфликтов. Задавай URL и
   флаги браузерного прогона в его собственном процессе, чтобы Jest получил
   штатное окружение. Шаги §3.0 для
   локального API выполняй из основного checkout, где разрешается путь
   `../metravel-backend`. Для стандартной регрессии можно использовать готовый
   локальный API после проверки SHA, миграций и доступности. Следи за его
   доступностью на протяжении всего прогона. Согласуй обновление или рестарт,
   если API уже обслуживает другой прогон.
   Lock и проверка активных процессов действуют для выбранного checkout и
   таргета. Изоляция артефактов не гарантирует чистый замер производительности
   при параллельных тяжёлых операциях на той же машине.
   Если полный Jest упирается в heap Node, пройди все части последовательно
   через `npm run test:run -- --shard=1/4` … `--shard=4/4`. Сохрани результат
   каждой части. Число частей фиксируй на весь проход.
4. Перенеси отревьюированные изменения в основной `main` явными путями,
   предварительно сверив их с текущими правками. Укажи SHA снимка, состав
   проверенного diff и фактические результаты.

### 3.4.1 Платные ресурсы и AWS

Этот gate применяется до запуска операции, которая расходует облачные ресурсы,
платные API или создаёт постоянный расход. Стадия `testing`, production target,
неиспользованный Free Tier и разрешение из прошлого чата сами по себе такую
операцию не разрешают. Сначала выбери локальную проверку, если она доказывает
затронутый контракт без платного вызова.

- Перед расходом зафиксируй текущий account/project, регион, целевые ресурсы,
  их владельца, фактический расход и бюджет на текущий период, цену операции,
  оценку дополнительного расхода, число запусков и условие остановки.
  Используй узкие запросы и ограниченную выборку: даже инвентаризация, массовые
  GET/HEAD/LIST, CloudTrail Lake, загрузка объектов и повторные polling/retry
  могут стоить денег. Не запускай массовый обход ради «проверить всё».
- Для PDF-экспорта обычная агентская проверка — static/unit/contract tests,
  локальные fixtures, renderer/storage mocks и локальный render без AWS.
  Автоматические suites, smoke и QA не создают облачную книгу и не вызывают
  AWS Lambda/S3/KMS для рендера по умолчанию. Mock не доказывает фактический
  cloud render: в отчёте явно укажи предел доказательства.
- Если необходим именно платный runtime probe, до него нужна текущая явная
  команда владельца на конкретный account/ресурс, сценарий, число запусков и
  предельный дополнительный расход. Разрешение на конфигурацию или deploy не
  разрешает тестовый render; разрешение на один запуск не разрешает повтор,
  load test или постоянное расписание. При отсутствии цены/лимита запроси
  ровно эти параметры и продолжай доступные локальные проверки.
- По поручению владельца от 11.10.2026 cloud render после перехода книг на
  SSE-S3 проверяет сама владелица. Агент проверяет конфигурацию и локальные
  контракты, не запускает платный экспорт для завершения этой задачи.
- Для выделенного бакета книг целевой storage contract — приватный доступ,
  Block Public Access и SSE-S3 (`AES256`). Не возвращай обязательный `aws:kms`
  в настройки, IaC, upload/verify code или тестовые defaults без новой явной
  задачи владельца. Не снимай шифрование, ACL/ownership/access guards ради
  экономии. Смена default encryption относится к новым объектам; старые
  SSE-KMS объекты сохраняют прежнее шифрование и могут требовать KMS при чтении.
- Старые KMS объекты мигрируй или удаляй только в явно разрешённом scope, с
  оценкой расходов и сохранением приватности. Не расширяй IAM/KMS permissions
  «для теста». Удаление тестовых книг не разрешает удалять фото, бэкапы,
  пользовательские книги или другие бакеты. Очистка включает проверку
  versions/delete markers, multipart uploads и retention, если они применимы.
- До создания платного ресурса задай минимально необходимые размер/конкурентность,
  retention/TTL и план удаления временных данных. После операции остановись
  при достижении согласованного числа запусков или расхода, зафиксируй результат
  и проверь, что временные jobs/resources не оставлены работающими. Не обходи
  лимит через другой аккаунт, регион, провайдера или дополнительные retries.
- Месячный бюджет AWS $10 и письмо на $8 — контроль расходов, а не гарантированный
  hard cap. AWS Budgets обновляется с задержкой; предупреждение без budget action
  ничего не останавливает. Даже ограничение новых вызовов не прекращает оплату
  уже хранимых данных и всех постоянных ресурсов. Автоматическую остановку
  описывай только после проверки фактического action, его покрытия и исключений;
  не обещай «расход никогда не превысит $10». Не отключай доступ или удаляй
  постоянные данные вне явно согласованного плана остановки.

В handoff укажи фактически выполненные платные операции и их пределы,
использованные локальные проверки, остаточный постоянный расход и точный
owner/runtime recheck. Исторические замеры и разрешения не являются новой
авторизацией.

### 3.5 Деплой из изолированного worktree

`build-prod.sh` собирает физическое содержимое рабочего каталога, а не коммит.
В общем чекауте `/Users/juliasavran/Sites/metravel2/metravel2` одновременно
работают до восьми сессий, и что-то незакоммиченное там есть почти всегда:
08.09.2026 запуск оттуда утащил в прод-сборку 29 продуктовых файлов чужой
задачи в статусе `in_progress` — 774 добавленные строки. Сборку остановили
вручную до rsync, и только потому, что человек заметил (#1881).

Поэтому изолированный worktree — не обходной путь, а ШТАТНЫЙ способ запустить
прод-деплой. Общий чекаут годится, только когда `git status --porcelain` в нём
пуст.

С 20.09.2026 прод-деплой web-фронтенда — штатный шаг КАЖДОЙ задачи после
`testing`, без отдельной команды владельца: `frontend-deployer` выкатывает sha
коммита задачи командой ниже, затем приёмка идёт на проде и тикет закрывается в `done`
(`docs/TASK_BOARD_MCP.md` → «Выкат и приёмка на проде — часть перехода
`testing → done`»). Гейты §3.4 (нет параллельной сборки/деплоя, живой lock,
чужой процесс не трогать) остаются обязательными; сторы и дев-стенд —
по-прежнему только по явному запросу.

Выкат — одна команда из основного чекаута (#2013):

```bash
DEPLOY_QUIET=1 scripts/deploy-prod.sh <sha>   # без аргумента — origin/main
```

`scripts/deploy-prod.sh` держит общий `web-build.lock` на весь выкат, делает
`fetch`, поднимает worktree `../worktrees/deploy-prod` на названном sha
(фиксированный путь: брошенный прерванным выкатом worktree снимает следующий
выкат), подключает симлинками
`node_modules`, `.env.prod` и `.env.deploy` (секреты не копируются), до сборки
проверяет чистоту прод-чекаута бэкенда, запускает `./build-prod.sh prod`, сверяет
`/.build-source.json` прода с sha и делает смоук `/health`, `/`, `/api/travels/`.
Worktree снимается на любом выходе: брошенный worktree git не показывает в
`status`, но рекурсивные сканы (`grep -r`, `os.walk`) его видят и начинают врать.
Полный лог — `.codex-temp/deploy/prod-<sha>-<время>.log`; при `DEPLOY_QUIET=1` в
консоль идут только этапы, таблица времени и итоги. `DEPLOY=0` — тот же путь без
выкладки.

Для точного bundle-budget эталон — этот же фиксированный worktree и его реальные
симлинк-зависимости, а не экспорт из основного checkout: Metro использует
абсолютный порядок путей для module IDs и относительные пути для chunk metadata.
Build-only измерение production SSR запускается существующим wrapper, с теми же
тремя SSR-входами, которые DEPLOY=1 получает после capability gate:

```bash
METRAVEL_WEB_OUTPUT=server EXPO_PUBLIC_WEB_RUNTIME_SSR=true EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR=true \
  DEPLOY=0 DEPLOY_QUIET=1 RETAIN_BUNDLE_EVIDENCE=1 scripts/deploy-prod.sh <sha>
```

Обычный `DEPLOY=0` без этих входов остаётся static preview. Оба режима держат
один глобальный lock от fetch до cleanup и компилируют в одном абсолютном
`dirname(MT)/worktrees/deploy-prod`, независимо от sha и времени. AI/HUBS defaults
и command-local minifier flags по-прежнему задаёт `build-prod.sh`.

До Expo `productionBundleEvidence` получает ту же effective env, что exporter,
после defaults. Приватный context вне `dist/` хранит только известные безопасные
значения флагов и hashes source/toolchain/dotenv/compiled-env/вычисленного public
Expo config (включая APP_MANIFEST); raw env/config не сохраняются. Уникальный run
ID связывает context с budget report и fingerprint конкретного budget config.
Перед cleanup wrapper сохраняет публичные HTML/JS/CSS и `.build-source.json` в
ignored `.codex-temp/deploy/bundle-artifacts/<sha>-<run>/`, автоматически при
ошибке и при `RETAIN_BUNDLE_EVIDENCE=1` на успехе. Архив ограничен 64 MiB/1024
файлами; `.env`, server, source maps, произвольные файлы и симлинки исключаются.
Manifest содержит exact full-file sizes/SHA-256, отдельно normalized entry,
полный home script sum и ownership markers фактических home/article script sets.
Complete budget breach остаётся измерением; error/incomplete/missing/mismatched
evidence не даёт `reference_eligible`. Код исходного build/deploy сохраняется.

Новые автоматические byte pins требуют полного eligible-пакета. Исключение
bootstrap #3374 явно обозначено в `measurementReference`: исторический canonical
F3 report плюс независимые source/env/layout proofs; удалённый JS не объявляется
восстановленным. Следующий обычный publisher создаёт первый полный пакет и
проверяет exact caps. Full delivered entry и legacy normalized entry — разные
метрики; integer byte caps не используют tolerance или округление KiB.

Выкат монотонен (#3207): до worktree и SSH скрипт читает живую ревизию из
`https://metravel.by/.build-source.json` и сверяет её с целью реальным
`git merge-base`. Цель обязана содержать живую ревизию:

- цель совпадает с живой — «уже выкачена», код 0, сборка не начинается;
- цель — предок живой или разошлась с ней (две стороны merge) — отказ с кодом 1,
  прод не меняется. Обычная причина — коммит уже выкатила потомком другая
  сессия, пока эта ждала лок: сверить `/.build-source.json` и ничего не выкатывать;
- живая ревизия не прочиталась или её нет в истории даже после `git fetch
  origin main` — отказ, а не выкат вслепую.

Явный откат или обход сверки (прод лежит и не отдаёт маркер) — только флагом
`ALLOW_DOWNGRADE=1 DEPLOY_QUIET=1 scripts/deploy-prod.sh <sha>`; строка
`⚠️  ALLOW_DOWNGRADE=1` попадает в отчёт и лог выката. Проверка живёт в общем
гейте источника (`scripts/assert-deployable-source.js`, `checkLiveRevision`),
поэтому действует и на `./build-prod.sh prod`, запущенный напрямую. Проба без
сборки: `node scripts/assert-deployable-source.js --live-check-only <sha>`
(коды 0 / 1 / 3 — «уже выкачена»).

**Сверка в момент публикации (#3307).** Сверка до сборки к переключению
устаревает на минуты: 11.11.2026 два выката из разных чекаутов прошли её оба, и
предок переключил прод через 21 с после потомка — общий `web-build.lock` такие
выкаты не разделяет. Поэтому `build-prod.sh` после `stage`, вплотную к
`publish-code`, повторяет ту же сверку
(`node scripts/assert-deployable-source.js --publish-check <sha>`: отчёт в
stderr, в stdout — прочитанная живая ревизия) и передаёт её серверу:
`web-ssr-publication.sh publish-code <sha> --expect-current <живая sha>`.
Сервер под своим замком отказывает до любой записи, если текущая пара уже не
эта (#3308) — так закрыто окно между чтением и переключением.

Что передаётся в `--expect-current`:

- обычный выкат — живая ревизия, которую цель содержит;
- `ALLOW_DOWNGRADE=1` — тоже прочитанная живая ревизия: флаг разрешает откат
  относительно той ревизии, которую видел оператор, а не поверх любой;
- `ALLOW_DOWNGRADE=1`, а прод маркер не отдал — аргумент не передаётся,
  публикация идёт без серверной сверки, в отчёте строка
  `⚠️  Живая ревизия не прочитана: публикация идёт без --expect-current`.
  Значение `none` («на хосте нет текущей пары») фронт сам не отправляет.

Исход «нас обогнали» — код выхода **75** у `build-prod.sh` и у
`scripts/deploy-prod.sh`, в отчёте строка `❌ Выкат <sha> остановлен … нас
обогнали` и обе ревизии. Так заканчиваются три случая:

- к моменту публикации цель — предок живой или разошлась с ней (отказ до
  `publish-code`);
- сервер ответил `current_changed`: прод сменил ревизию уже после сверки
  (`❌ Нас обогнали: прод уже ушёл на <actual>; наш <sha> не опубликован —
  ничего не возвращалось`);
- прод уже отдаёт саму цель — её переключила другая сессия и, возможно, ещё
  проверяет (`❌ Ревизия <sha> уже публикуется или опубликована другой сессией`).

Код 75 — не сбой выката и не повод для возврата: наш релиз не переключался.
После отказа сервера `rollback-code` не вызывается ни веткой ошибки, ни
обработчиком выхода, `finalize-code` — тоже: receipt на хосте ищется по sha, и
обе операции задели бы чужую публикацию той же ревизии. Что делать: прочитать
`/.build-source.json`; живая ревизия содержит наш коммит — выкатывать нечего,
приёмку вести по живой ревизии; наш коммит содержит живую — повторить
`scripts/deploy-prod.sh`. Отказ сервера распознаётся по его строке в stderr
(`web-ssr release refused: current_changed … mutation=none`), а не по коду,
прошедшему через ssh; любой другой провал `publish-code` по-прежнему
возвращает релиз.

Хост с помощником старше #3308 отвечает на `--expect-current` ошибкой разбора
аргументов до замка: выкат печатает `❌ Помощник публикации на хосте не принял
--expect-current`, завершается кодом 1 без возврата — сначала выкатить бэкенд.

**Идентификатор публикации (#3334, бэкенд #3310).** Receipt кодовой публикации
лежит на хосте по sha, поэтому `finalize-code` и `rollback-code` без привязки
могли принять или вернуть публикацию той же ревизии из другой сессии. Перед
переключением `build-prod.sh` читает capability и, если помощник объявил
`code_publication.publication_id`, выдаёт один идентификатор на выкат
(`scripts/lib/webOutput.js` → `createCodePublicationId`, 32 hex-символа; это
метка, не секрет). Он печатается строкой `🔖 Публикация <sha>: --publication-id
<id>` и уходит во все три операции этой публикации:
`web-ssr-publication.sh publish-code <sha> --expect-current <живая sha>
--publication-id <id>`, `finalize-code <sha> --publication-id <id>`,
`rollback-code <sha> --publication-id <id>` (и из ветки ошибки, и из
обработчика выхода). Помощник без флага в capability получает прежние вызовы,
в отчёте строка `⚠️  Помощник хоста не объявил publication_id`.

Ответ сервера `web-ssr release refused: publication_mismatch sha=… state=…
receipt=bound|unbound|missing mutation=none` (код помощника 4) значит «receipt
не принадлежит этой публикации, ничего не менялось». `web-ssr-publication.sh`
распознаёт его по строке в stderr, печатает `❌ <операция> <sha>: это не наша
публикация (state=…, receipt=…)` с пояснением и выходит с кодом **77**. Что
делает выкат:

- на `publish-code` (эту ревизию прямо сейчас публикует другая сессия) —
  `❌ Выкат <sha> остановлен на переключении: эту ревизию публикует другая
  сессия`, код 75, без возврата;
- на `finalize-code` (receipt перешёл к другой публикации, пока шли живые
  проверки) — `❌ Выкат <sha> не принят: публикацию этой ревизии ведёт другая
  сессия`, код 75, `rollback-code` не вызывается;
- на `rollback-code` — `⚠️  Возврат не выполнялся: сервер отказал до записи`,
  строки `❌ НУЖЕН РУЧНОЙ ВОЗВРАТ` нет: чужую публикацию примет или вернёт её
  сессия. Код выхода остаётся кодом исходного сбоя.

После кода 77 ту же операцию под другим идентификатором не повторять. Что
делать дальше — как при коде 75: сверить `/.build-source.json`.

С 27.10.2026 сущности (статьи, квесты, города, страны, `/`, `/quests`,
`/quests/scenario`) рендерит сервер Expo Router (SSR loaders), и выкат публикует
только связанную SSR-пару (#2766): `scripts/deploy-prod.sh` при `DEPLOY=1` читает
capability бэкенда (`scripts/web-ssr-publication.sh capability`); без quest
SSR runtime выкат отказывает (`scripts/lib/webOutput.js`), иначе выставляет
server output и запускает `./build-prod.sh prod`. Тот делает один серверный
экспорт, постобработку статических оболочек (`scripts/postprocess-route-shells.js`)
и публикует пару `web-ssr-publication.sh stage → publish-code → finalize-code`
(файлы книг лежат в S3, релиз несёт только `travel-books/manifest.json`, #2971;
после запечатывания релиза `scripts/web-ssr-release-audit.sh` проверяет это и
чанки — лишнее в `travel-books` и предел чанков роняют выкат до переключения, #2857);
не прошедшая живую проверку пара откатывается `rollback-code` к предыдущей
SSR-паре. `build-prod.sh` с `DEPLOY=1` без SSR-релиза отказывает до сборки.

Выкат не обходит сбой молча (#3210). Зависимости при `DEPLOY=1` ставятся только
строго: провал `yarn install --frozen-lockfile` (расхождение `package.json` с
`yarn.lock`, сеть) останавливает выкат до сборки; установка без lockfile
осталась только у сборки без выкладки (`DEPLOY=0`). Релиз, уже переключённый
`publish-code`, считается неподтверждённым до конца живых проверок и
`finalize-code`: при любом выходе в этом окне — ошибка, `SIGTERM`/`SIGINT`/`SIGHUP`,
обрыв обёртки — `build-prod.sh` сам вызывает `rollback-code` из обработчика
выхода и печатает `✅ Возврат выполнен` либо `❌ НУЖЕН РУЧНОЙ ВОЗВРАТ` (тогда —
раздел «Аварийный возврат прошлой версии» ниже). `kill -9` обработчик не
переживает: после него сверить `/.build-source.json` руками. Отказ сервера до
записи (код 75 или непринятый `--expect-current`, #3307; «не наша публикация»,
#3334) отметку неподтверждённого релиза снимает: возвращать нечего, строки
`❌ НУЖЕН РУЧНОЙ ВОЗВРАТ` при нём нет. Сигнал на время `publish-code` откладывается до разбора
его исхода, как и на время `finalize-code`.
Статический конвейер сущностей (v1-пакет квестов, режимы `ru-only`/`translations`,
захват входов SEO, проверки статики) снят в #2766. `DEPLOY=0` через обёртку
собирает без обращения к capability; превью без SSH — `DEPLOY=0 ./build-prod.sh prod`.

Бюджет выката от команды до отчёта (решение владельца 18.10.2026, #2448): не больше
~12 минут; выкат запускается только в фоне — foreground-Bash с таймаутом 600 с
оборвёт его посреди публикации (с #3210 такой обрыв возвращает предыдущий
релиз, но выкат всё равно потерян).

`build-prod.sh`
печатает время каждого этапа и сводку на выходе, так что регресс виден в отчёте
любого выката. На время работают:

- медиа-проверки прода (`post-deploy-media-check.js`,
  `audit-article-body-media.js`) читают API и медиа-маршруты, а не выкатываемый
  HTML, поэтому идут в фоне во время экспорта; постобработка оболочек ждёт их конца, чтобы
  темповые обходы прод-API (#1966) не пересекались. После выката остаётся только
  `post-deploy-seo-check.js`. Холодный экспорт Metro (`-c`) идёт за это же время,
  поэтому тёплый кэш Metro не нужен — и запрещён: web-сборка вшивает RU-тексты
  `i18n/locales` в вызывающие модули (`i18n/babel-inline-plugin.js`), а ключ кэша
  Metro каталоги не видит, так что правка одного каталога выкатила бы старый текст;
- overlay прошлых чанков (`scripts/deploy-expo-overlay.sh`) едет внутри SSR-релиза
  (`scripts/prepare-web-ssr.js`) и выполняется на шаге `stage` бэкенда: жёсткие
  ссылки одним проходом `cpio`, а не копия ~6 тыс. файлов по одному.

Что делает гейт `build-prod.sh` перед установкой зависимостей (проверка стоит
доли секунды и срабатывает до сборки):

- печатает собираемый sha — в лог старта и в финальную строку отчёта, иначе
  «задеплоено» не привязано ни к какому коммиту;
- останавливается на непустом `git status --porcelain` и перечисляет файлы.
  Осознанный обход — только явный флаг: `./build-prod.sh prod --allow-dirty`,
  и он громко печатает, что в артефакт уедет незакоммиченная работа;
- обновляет `origin/main` и останавливается, если `HEAD` из него недостижим.
  У этой проверки обхода нет: невоспроизводимый прод не нужен даже срочно;
- при выкате сверяет `HEAD` с живой ревизией прода (#3207, см. выше): предок
  живой или разошедшаяся с ней ревизия отклоняется, обход — `ALLOW_DOWNGRADE=1`.
  Та же сверка повторяется перед `publish-code` (#3307, «Сверка в момент
  публикации»).

Обе остановки касаются только деплоя. `DEPLOY=0 ./build-prod.sh prod` —
документированный build-only preview (`docs/PRODUCTION_CHECKLIST.md`,
`docs/RELEASE.md`), он существует ради проверки ещё не отправленной работы:
там гейт печатает те же файлы предупреждением и пропускает сверку с
`origin/main`. Собранный таким прогоном `dist/prod` деплоить нельзя: пути,
который заливает лежащий на диске артефакт, больше нет (#3209).

`.env` на время сборки подменяется на `.env.prod` и возвращается EXIT-trap'ом:
нормальный выход, ошибка, `Ctrl-C` (SIGINT), `kill` (SIGTERM) и обрыв терминала
(SIGHUP). `kill -9` и отключение питания обработчик не переживают — после них
`.env` проверяется руками. Отдельного ручного возврата `EXPO_PUBLIC_API_URL`
после штатного деплоя больше не требуется.

#### Аварийный возврат прошлой версии

Отдельного аварийного скрипта нет. `scripts/fix-prod.sh` удалён в #3209: это была
вторая реализация выкладки, она пять раз отставала от штатной (#733, #653,
#1883, #2226, #3209), а после перехода на SSR-релизы (#2766) отказывала на
проверке статического корня уже после заливки `dist/`, `icons/`, `images/` в
прод-чекаут — и этим останавливала следующий штатный выкат. Возврат идёт теми же операциями,
что и выкат; своих `rsync`/`scp`/SSH-последовательностей не писать.

Сначала прочитать состояние — эти команды прод не меняют:

```bash
curl -fsS https://metravel.by/.build-source.json
```

```bash
bash scripts/verify-live-release.sh <sha, который должен быть на проде>
```

```bash
bash scripts/web-ssr-publication.sh capability
```

Дальше — по тому, на чём остановился выкат:

1. **Выкат упал или оборван до конца проверок.** `build-prod.sh` возвращает
   предыдущую пару сам. Если в отчёте есть `❌ НУЖЕН РУЧНОЙ ВОЗВРАТ`, повторить
   ту же операцию для sha оборванного выката (она идемпотентна и работает по
   receipt этой публикации). Отчёт печатает команду целиком; если в ней есть
   `--publication-id <id>` (#3334), повторять с ним — receipt привязан к этому
   идентификатору, без него сервер ответит `publication_mismatch … receipt=bound`
   и ничего не вернёт. Идентификатор есть и в логе выката, строка
   `🔖 Публикация`:

   ```bash
   bash scripts/web-ssr-publication.sh rollback-code <sha оборванного выката>
   ```

2. **Сломан уже принятый релиз** (выкат прошёл, `finalize-code` выполнен).
   `rollback-code` без флага такой релиз не трогает — это защита бэкенда от
   отката принятой версии автоматикой. Два пути:
   - исправление вперёд силами фронта, 12–15 минут: `git revert <плохой коммит>`,
     `PREFLIGHT_SKIP_E2E=1 git push origin main`, затем обычный
     `DEPLOY_QUIET=1 scripts/deploy-prod.sh <новый sha>`. Новый sha — потомок
     живого, флаги не нужны;
   - возврат за секунды: backend-операция `rollback-code --accepted` в окне Ops
     по `../metravel-backend/deploy/prod/README.md` → «Recovering an accepted
     code release (#2819)». Предыдущая пара хранится на хосте после
     `finalize-code`. Это серверная запись: выполняет уполномоченный оператор.

3. **Нужна именно прежняя ревизия, а не revert.** Явный откат штатным выкатом:

   ```bash
   ALLOW_DOWNGRADE=1 DEPLOY_QUIET=1 scripts/deploy-prod.sh <предыдущий рабочий sha>
   ```

   Сервер примет ревизию, только если пересборка побайтно совпала с уже
   запечатанным `releases/<sha>` (#2858, #2930); отказ на `stage` прод не меняет —
   тогда остаётся путь 2.

Основной путь возврата принятого релиза — backend-операция
`rollback-code --accepted` (путь 2): она не зависит от пересборки. Путь 3 со
стороны фронта на проде не отрабатывался (#3272); учебный прогон — только в
тихое окно по согласованию с владельцем, до него на путь 3 как на гарантию не
рассчитывать.

Сигнал во время `finalize-code` откладывается до его конца (#3272): принятый
релиз не возвращается и строки `❌ НУЖЕН РУЧНОЙ ВОЗВРАТ` нет, выкат завершается
кодом сигнала. Строка остаётся для случая, когда оборван сам `finalize-code` и
`rollback-code` отказал, — тогда сверить `/.build-source.json`: прод цел, если
он отдаёт sha выката.

Срочно освободить диск прода — `docs/ops/prod-disk-growth.md`; значения
`EXPO_OVERLAY_MAX_MB` (1–4096) и `EXPO_OVERLAY_RETENTION_DAYS` (1–90) проверяет
`scripts/deploy-target.sh` до заливки, в тех же границах, что и бэкенд.

### 3.6 Веб-почта домена (info@, admin@, postmaster@)

Почта домена делегирована хостеру: своего почтового сервера у проекта нет,
ящики живут на общем CommuniGate Pro hoster.by. Вход — по закладке:

```
https://mailbe05.hoster.by/
```

В поле «Имя пользователя» вводится **полный адрес с доменом**, например
`info@metravel.by` — несмотря на подпись `@mailbe05.hoster.by` справа от поля.
Эта подпись показывает домен по умолчанию самого сервера, а ящик принадлежит
домену `metravel.by`: ввод одного только `info` превращается в
`info@mailbe05.hoster.by`, и такого ящика там нет. Правило одинаково для всех
трёх ящиков домена — `info@`, `admin@`, `postmaster@`.

Пароль — от почтового ящика, меняется в кабинете hoster.by → «Почта» → домен
`metravel.by`. В чат и в задачи борда не вставляется. «Защищённый вход» можно не
трогать: соединение уже по HTTPS с валидным сертификатом хостера, хэширование
пароля поверх избыточно. Интерфейс — `Crystal` (современный) или `LookOut3`.

Почему не `https://mail.metravel.by/` и не ссылка из панели hoster.by:

- `mail.metravel.by` — CNAME на общий `mailbe05.hoster.by`, сертификат там
  `CN=*.hoster.by` (SAN только `*.hoster.by` и `hoster.by`), имя домена он не
  покрывает, и заменить сертификат на чужом общем сервере нельзя;
- ссылка из панели ведёт на `http://mail.metravel.by:8010` (CommuniGate по
  открытому HTTP). С 20.05.2025 apex отдаёт
  `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  (коммит `b9e75ec` в backend `nginx.conf`), а `includeSubDomains` запрещает
  HTTP на **всех** `*.metravel.by`. Браузер сам переписывает схему на https и
  упирается в чужой сертификат. До мая 2025 та же ссылка открывалась — отсюда
  ощущение «раньше работало». Механизма исключения одного имени у HSTS нет;
- порты CommuniGate снаружи (замер 19.09.2026): `8010` — HTTP без TLS, `8100`
  не отвечает, `443` — `*.hoster.by`. Своего сертификата на имя домена у
  хостера нет ни на одном порту.

Вариант «поднять своё имя `webmail.metravel.by` реверс-прокси на нашем nginx»
разбирался и отклонён владельцем 19.09.2026 как несоразмерный: карточки #1982,
#1983 и #1984 закрыты `wont_do`. Все пробы прода и готовые конфиги лежат там —
если тема вернётся, начинать с них, а не с нуля.

### 3.7 Бэкап прод-базы: свежесть копий и пробное восстановление

Устройство бэкапа, команды и диагностика — `docs/DB_BACKUP.md`. Здесь только два
постоянных контроля, введённых после #3208.

**Свежесть копий.** `npm run db:backup:prod:verify` (только чтение) выходит с
ненулевым кодом, если последний архив в `~/db-backups` или последний объект в S3
старше 26 часов либо в двух последних сутках нет `Backup completed`. Тот же
возраст каждое утро приходит владельцу в письме `Security report`, раздел «Бэкап
базы». Слово `ПРОСРОЧЕНО` в письме — повод сразу идти в `docs/DB_BACKUP.md` →
«Если бэкап не сделался», а не ждать следующего письма. Порог один на оба
контроля: `MAX_AGE_HOURS` в `scripts/db-backup-freshness.py`.

**Пробное восстановление — раз в квартал.** Исполнитель — агент `db-backup`
(`.claude/agents/db-backup.md`) по явной команде владельца: последний ночной
архив восстанавливается в отдельную временную базу, сверяется число таблиц,
контейнер убирается (`docs/DB_BACKUP.md` → «Восстановление»). В production не
восстанавливать никогда. После каждого прогона строка «последнее» в таблице
обновляется тем же коммитом, что и запись в карточке борда.

| что | значение |
| --- | --- |
| последнее пробное восстановление | не проводилось: на 09.11.2026 записей о нём нет ни в `docs/`, ни на борде |
| следующее по регламенту | первое — в IV квартале 2026, затем раз в квартал |
| исполнитель | агент `db-backup` по команде владельца |
