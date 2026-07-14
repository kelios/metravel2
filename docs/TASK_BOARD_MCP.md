# Task board (MCP) — единый борд фронта и бэка

С 2026-06-10 задачи MeTravel ведутся в **общем таск-борде** — Django-приложении `task_board`,
развёрнутом на `metravel.by` (репо `../metravel-backend`). Это единый источник правды для
фронта и бэка. Локальные markdown-тикеты (`tasks/*.md`) и раздутые доски в `docs/` —
**упразднены**: закрытые удалены (история в git), оставшиеся открытые импортируются на борд.

Человеческий UI: `https://metravel.by/board` (kanban) и `/sprints` — требуют staff-логина.

## Архитектура

```
Claude Code / Codex ──MCP stdio──► metravel-task-board server ──HTTPS──► /api/tasks/ , /api/sprints/
   агент ticket-board                  (../metravel-backend/tools/mcp_server)        (Django task_board)
```

- MCP-сервер — тонкий HTTP-клиент к DRF API; своей БД нет, данные живут в проде.
- Маршруты `/api/tasks/`, `/api/sprints/` требуют **staff/admin DRF-токен**.
- Конфиг подключения для Claude Code: `.mcp.json` (server `metravel-task-board`).
- Конфиг подключения для Codex Desktop: `~/.codex/config.toml` (`[mcp_servers.metravel-task-board]`).

## Setup (владелец, один раз)

MCP-сервер `tools/mcp_server` — на **чистой стандартной библиотеке Python** (urllib/json/
subprocess), без Django/GDAL/сторонних пакетов. Поэтому `uv` и сборка бэкенд-окружения
**не нужны** — запускаем системным `python3` с `PYTHONPATH` на бэк-репо.

1. **Подтянуть бэк-репо** — `task_board` и MCP-сервер живут на `origin/master`. Локальные
   правки в `../metravel-backend` всегда мусор → приводить дерево к origin:
   ```bash
   git -C ../metravel-backend fetch origin master && git -C ../metravel-backend reset --hard origin/master
   ```
   После этого появляется `../metravel-backend/tools/mcp_server/`.
2. **Выпустить staff-токен** — предпочтительно программно залогиниться staff/admin-пользователем
   из `.env.e2e` через `POST /api/user/login/` на `METRAVEL_TASK_BOARD_BASE_URL` и взять
   `token` из JSON-ответа. Ручной вариант через `authtoken_token` допустим только если login API
   недоступен. **Токен в чат не вставлять.**
3. **Положить токен** в gitignored-файл `.secrets/metravel-task-board.env`
   (`METRAVEL_TASK_BOARD_API_TOKEN=…`, `METRAVEL_TASK_BOARD_BASE_URL=https://metravel.by`).
   Экспортировать в шелл НЕ нужно — `.mcp.json` сам сорсит этот файл при старте сервера
   (источник правды = файл, не env шелла; это убирает рассинхрон «старый токен в окружении»).
4. **Перезапустить Claude Code** — MCP-сервер `metravel-task-board` поднимется автоматически
   из `.mcp.json`. Проверка: `metravel_tasks_list` или попросить агента `ticket-board`
   показать борд (`metravel_task_board`).

Рабочий `.mcp.json` (macOS, абсолютные пути — поправить под свою машину):
```json
{
  "mcpServers": {
    "metravel-task-board": {
      "command": "sh",
      "args": ["-c", "set -a; . /ABS/PATH/metravel2/.secrets/metravel-task-board.env; set +a; exec python3 -m tools.mcp_server"],
      "env": { "PYTHONPATH": "/ABS/PATH/metravel-backend" }
    }
  }
}
```

Рабочий Codex Desktop config (macOS, пользовательский файл `~/.codex/config.toml`):
```toml
[mcp_servers.metravel-task-board]
args = [
  "-c",
  "set -a; . /ABS/PATH/metravel2/.secrets/metravel-task-board.env; set +a; exec python3 -m tools.mcp_server",
]
command = "sh"
startup_timeout_sec = 120

[mcp_servers.metravel-task-board.env]
PYTHONPATH = "/ABS/PATH/metravel-backend"
```

**Troubleshooting:**
- `Failed to build gdal` / зависает на сборке → используется старый `uv run --frozen`-конфиг;
  заменить на `python3`-вариант выше (серверу зависимости бэка не нужны).
- `HTTP 401 Invalid token` при живом MCP → до сервера долетает не тот токен или staff token
  истёк. Не останавливайся на локальном fallback: обнови токен через `.env.e2e`.
  1. Прочитай `E2E_EMAIL` / `E2E_PASSWORD` из `.env.e2e` внутри скрипта или процесса без
     вывода значений.
  2. Отправь `POST $METRAVEL_TASK_BOARD_BASE_URL/api/user/login/` с JSON `{ "email": "...",
     "password": "..." }`.
  3. Убедись, что в ответе есть `token`, и перезапиши только значение
     `METRAVEL_TASK_BOARD_API_TOKEN` в `.secrets/metravel-task-board.env`.
  4. Повтори проверки `GET /api/tasks/?limit=1`, `GET /api/tasks/board/`, `GET /api/sprints/`.
     Ожидаемый результат — `200`. Токен, пароль и email не печатать.
  Если login API не вернул staff/admin-токен или board endpoints всё ещё отвечают `401`, только
  тогда фиксируй blocker с конкретными endpoint/status и оставляй временный fallback.
- Инструменты `mcp__metravel-task-board__*` не появились → MCP-конфиг читается при старте:
  перезапустить Claude Code или Codex Desktop из каталога репо.

Проверка без MCP (read-only, токен из окружения; токен не печатать):
```bash
curl -s -H "Authorization: Token $METRAVEL_TASK_BOARD_API_TOKEN" https://metravel.by/api/tasks/board/ | head
```

## Работа с бордом

- **Агент `ticket-board`** — единственный оператор борда: list/create/update/sync тикетов и
  спринтов через MCP. Инструменты: `metravel_task_board`, `metravel_tasks_list/_get/_create/_update/_delete`,
  `metravel_sprints_*`, `metravel_task_board_options`.
- **Skill `/ticket-flow`** (команда `/ticket`) — прогон фронт-тикета по пайплайну
  discovery → implement → review → test → release силами профильных FE-агентов, со сдвигом
  статуса на борде на каждом шаге. Зеркалит ролевой пайплайн бэка (`.codex/team`).

Модель: `Task{title, description, kind: task|feature|bug, status: backlog→todo→in_progress→review→
testing→done (+ blocked_by, wont_do), area: front|back, urgency: highest|high|medium|low|
lowest, reporter, assignee, sprint, position, needs_human, blocked_by_id, depends_on_ids[],
related_to_ids[]}`. Заголовок с префиксом источника `[FE-…]`/`[BE-…]`/`[AND-…]`/`[IOS-…]`.
Android/iOS/native-задачи по приложению ведутся как `area=front`; платформенный контекст фиксируй
в заголовке, описании, owner/assignee и Done gate. `area=back` используй только для backend/API/
инфраструктуры.

### Схема создания/обновления тикета (актуально на 2026-06-21)

Бэкенд расширил MCP. При `metravel_task_create` / `metravel_task_update` доступны поля:

| Поле | Тип | Назначение |
|---|---|---|
| `title` | string | обязателен при create |
| `description` | string | тело + `Task Contract` + журнал evidence |
| `status` | enum | `backlog`, `todo`, `blocked_by`, `in_progress`, `review`, `testing`, `done`, `wont_do` |
| `area` | enum | `front`, `back` для новых задач; если API/MCP показывает legacy `android`/`ios`, не используй их при create/update |
| `urgency` | enum | `highest`, `high`, `medium`, `low`, `lowest` |
| `sprint_id` | int\|null | привязка к спринту (обязательна, см. правило ниже) |
| `reporter` / `assignee` | string | кто завёл / кто исполняет |
| `needs_human` | bool | задача требует ручного шага человека (не закрываема агентом) |
| `blocked_by_id` | int\|null | id тикета-блокера (статус `blocked_by`) |
| `depends_on_ids` | int[] | жёсткие зависимости (этот тикет не стартует, пока не закрыты) |
| `related_to_ids` | int[] | мягкие связи (контекст, без блокировки) |
| `position` | int | позиция в колонке |

Допустимые enum’ы всегда сверяй вызовом `metravel_task_board_options` — он источник правды по
`task_statuses` / `task_areas` / `task_kinds` / `task_urgencies` / `sprint_statuses`.

### Поле `kind` (категория: bug / feature / task)

DRF-модель имеет поле `kind` с `choices: task | feature | bug` (дефолт `task`, `read_only:false`), и
оно отдаётся в листингах (`kind` / `kind_display`). Актуальный MCP (`../metravel-backend/tools/
mcp_server`, 2026-06-22+) принимает `kind` в `metravel_task_create` и `metravel_task_update`, поэтому
передавай категорию сразу при create/update.

Если агент работает со старым MCP, где `kind` ещё отсутствует в схеме, используй прямой PATCH как
fallback после создания задачи:

```bash
. .secrets/metravel-task-board.env
curl -s -X PATCH "$METRAVEL_TASK_BOARD_BASE_URL/api/tasks/<ID>/" \
  -H "Authorization: Token $METRAVEL_TASK_BOARD_API_TOKEN" \
  -H "Content-Type: application/json" -d '{"kind":"bug"}' >/dev/null
```

**Рубрика классификации (обязательна при заведении):**
- `bug` — дефект существующего поведения: поломка / неправильно / краш / падает / 5xx / XSS /
  визуальный глюк / усечение / рассинхрон / регрессия. Перф-ЖАЛОБА на конкретную поломку
  («эндпоинт медленный, нет кэша», «502») = `bug`.
- `feature` — новая возможность / экран / редизайн / новая интеграция / новый эндпоинт под фичу.
- `task` — chore / инфра / рефактор / перф-ПРЕДЛОЖЕНИЕ / SEO / контент (статьи, квесты) /
  миграция / тулинг / тесты. Дефолт при неоднозначности.

Проверка распределения: `GET /api/tasks/?limit=1000` → группировка по `kind`.

**Статус `testing`** — отдельная колонка QA/приёмки между `review` (код-ревью) и `done`. Раньше
передача тестеру/релизеру эмулировалась возвратом в `todo` с пометкой «handoff: …» — теперь для
этого используется `testing`. Приёмочная очередь (`board-reviewer` / `/sprint-review`) = `review` +
`testing`.

### Правило: `needs_human` = только человеческие действия, отдельной задачей (обязательно)

`needs_human=true` — маркер задачи, состоящей **исключительно из действий человека**: того,
что агент физически не может сделать (ручной шаг в Google Search Console, апрув/решение
владельца, заливка секрета, действие в стороннем кабинете, проверка на физическом устройстве,
публикация в сторе). Правила:

- **Одна задача = один тип исполнителя.** Агентская работа (код/фикс/тесты/деплой-команда)
  `needs_human` **никогда** не несёт. Смешанной задачи «частично агент, частично человек» быть
  не должно.
- **Человеческий шаг выносится в ОТДЕЛЬНУЮ задачу** `needs_human=true`, а не помечается флагом
  на агентской. Тело пишется **для человека** простым языком (что сделать → зачем → шаги → где →
  готово когда), без агент-механики и без Task Contract — открыв задачу, человек сразу понимает,
  что от него требуется. Шаблон — `.claude/skills/metravel-issue/human-task.md` (skill
  `/metravel-issue`).
- **Связь двух задач** через `blocked_by_id`/`depends_on_ids` (агент не может продолжить без
  человека → агентская задача в `blocked_by`) либо `related_to_ids` (мягкая связь). У человеческой
  задачи `area`/`sprint` тоже обязательны; `kind` обычно `task`.
- При **аудите** борда: задача с `needs_human=true`, внутри которой есть и агентская работа = дефект
  гигиены → расщепить на две связанные. Агент `ticket-board` обеспечивает это при create/sync.

### Правило: у каждой FE/BE задачи есть контракт (обязательно)

**Любая новая задача `area=front` или `area=back` должна содержать в `description` блок
`Task Contract`.** Без него задачу нельзя считать готовой к старту (`todo`) и нельзя закрывать
в `done`, даже если код или соседняя задача уже помечены готовыми.

Минимальный шаблон:

```md
## Task Contract

Scope:
User-visible result:
Data/API contract:
Dependencies:
Fallback/mock policy:
Validation:
Done gate:
```

**Уровень детализации — архитекторский, не декоративный.** Контракт должен быть достаточно
проработан, чтобы исполнитель не догадывался: конкретные shape'ы (поля + типы), реальные board
id зависимостей, конкретные команды/URL валидации. Пустые поля или плейсхолдеры = задача не
готова к `todo`. Если данных не хватает — оформляет проработку архитектор
(`$metravel-system-architect`) или задаётся ОДИН уточняющий вопрос; контракт-заглушку на борд
не выкладывать.

Заполняй поля проверяемыми фактами:

- `Scope` — что именно входит в задачу и что явно не входит.
- `User-visible result` — наблюдаемое поведение на web/mobile/admin/API.
- `Data/API contract` — для BE: endpoint, method, auth, request/response shape, migrations/seed;
  для FE: какие endpoints/fields/events потребляются и какие UI states должны появиться.
- `Dependencies` — board id связанных FE/BE задач; если FE ждёт BE, укажи конкретный BE id и
  endpoint, который должен разблокировать FE.
- `Fallback/mock policy` — разрешены ли mock/dev fallback; если разрешены, они не заменяют
  runtime-проверку реального контракта, если AC требует интеграцию с BE.
- `Validation` — конкретные команды и runtime-пробы (`curl`, browser flow, e2e/Jest, dev/prod URL).
- `Done gate` — условия закрытия: код + тесты + runtime evidence. Для BE, который разблокирует
  FE, `done` требует smoke-пробу deploy target (`dev`/`prod`) по контрактным endpoints. Для FE,
  зависящего от BE, `done` требует browser/API evidence против того же target; зелёные unit-тесты
  и mock fallback сами по себе недостаточны.

Если при ревью FE-задачи связанная BE-задача стоит в `done`, но контрактный endpoint/field/event
на dev/prod не подтверждается, FE-задачу не двигать в `done`: оставить `review`/`blocked_by`,
дописать evidence и открыть/переоткрыть blocker на BE или deploy/routing.

#### Design evidence для видимых UI/UX задач

Если задача меняет видимый UI, responsive/mobile поведение или набор состояний экрана, в
`description` рядом с `Task Contract` обязательно укажи `Design evidence`:

- точный repository path к версионируемому макету в `docs/` либо устойчивый URL Figma;
- список экранов/состояний, которые макет фиксирует, и платформы, для которых он обязателен;
- что является нормативным: порядок блоков и действий, видимые подписи, empty/loading/error/
  permission states, минимальные touch-targets и mobile parity;
- если MCP/API доски не поддерживает файловые attachments, не выдавай локальный
  `.codex-temp/`-файл за вложение: положи итоговый макет в `docs/` и добавь точный путь в задачу.

Макет не заменяет runtime validation. `Done gate` UI-задачи всё равно требует browser/device
evidence на заявленных платформах и сравнение с указанными состояниями.

### Правило: у каждой задачи — спринт (обязательно)

**Каждая задача на борде должна быть привязана к спринту.** Без спринта задача невидима в
`/sprints`-планировании и выпадает из приоритизации.

- При **создании** любого тикета (`metravel_task_create`) — всегда указывать `sprint`. Не
  знаешь какой — сначала получи `/api/sprints/` или `metravel_sprints_list` и выбери текущий
  спринт со статусом `active`. Если есть несколько активных спринтов, клади в активный спринт
  нужной рабочей очереди: frontend/app/mobile/Android/iOS → `area=front`, backend/API/infra →
  `area=back`. Бэклог-кандидаты без даты — только в активный backlog/migration спринт.
- При **аудите** борда любой открытый тикет (`backlog/todo/in_progress/review/testing`) без
  спринта = дефект гигиены → положить в подходящий активный спринт. Закрытые
  (`done/wont_do`) без спринта можно не трогать.
- Агент `ticket-board` обеспечивает это правило при каждом create/sync.

### Правило: новый спринт создаётся сразу `active`

При создании спринта (`metravel_sprint_create`) ставить статус **`active` (in progress)**, не
`planned`. Спринт заводится под работу, которая стартует сразу.

## Миграция локальных тикетов на борд — ВЫПОЛНЕНО (2026-06-10)

Открытый бэклог импортирован на борд (спринт #1 «Backlog migration 2026-06-10», статус
`active`): **30 задач** в `backlog` — 4 `front` (slug-301 e2e опц., SPA new-version,
secure-storage token, Nominatim→React Query) + 26 `back` (avatar repro, IG OAuth env, ротация
токена, BE P3 perf/debt, архитектурный батч 053–065). `001` (image AVIF) не импортирован —
фактически закрыт. Локальные `tasks/*.md` после импорта удалены (борд — источник правды),
остались только `000-template.md` (формат `description`) и `README.md`.

Дальше задачи ведутся только на борде: новые — через `ticket-board` (`metravel_task_create`),
прогон — `/ticket-flow`. Бэкенд-очередь и доказательства закрытия сверяет `backend-status-sync`,
записывая верификацию (код на `origin/master` + read-only прод-пробы) в комментарии тикетов
борда (`area=back`). Файл `docs/BACKEND_WORKBOARD.md` упразднён 2026-06-10 — история в git.

Повторный импорт не запускать (создаст дубликаты) — дедуп по префиксу заголовка `[TASK-…]`.

## Безопасность

- Токен — staff/admin, даёт запись в борд. Хранить только в `.secrets/` (gitignored) или env.
- Никогда не коммитить токен и не печатать в чат/логи. Утёк → отозвать (см. `tasks/072`).
- `.mcp.json` секретов не содержит (только `${...}`-ссылка) — его можно коммитить.
