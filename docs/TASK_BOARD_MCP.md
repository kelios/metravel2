# Task board (MCP) — единый борд фронта и бэка

С 2026-06-10 задачи MeTravel ведутся в **общем таск-борде** — Django-приложении `task_board`,
развёрнутом на `metravel.by` (репо `../metravel-backend`). Это единый источник правды для
фронта и бэка. Локальные markdown-тикеты (`tasks/*.md`) и раздутые доски в `docs/` —
**упразднены**: закрытые удалены (история в git), оставшиеся открытые импортируются на борд.

Человеческий UI: `https://metravel.by/board` (kanban) и `/sprints` — требуют staff-логина.

## Архитектура

```
Claude Code (этот репо) ──MCP stdio──► metravel-task-board server ──HTTPS──► /api/tasks/ , /api/sprints/
   агент ticket-board                  (../metravel-backend/tools/mcp_server)        (Django task_board)
```

- MCP-сервер — тонкий HTTP-клиент к DRF API; своей БД нет, данные живут в проде.
- Маршруты `/api/tasks/`, `/api/sprints/` требуют **staff/admin DRF-токен**.
- Конфиг подключения: `.mcp.json` (server `metravel-task-board`).

## Setup (владелец, один раз)

1. **Установить `uv`** — менеджер запуска Python-сервера: https://docs.astral.sh/uv/
   (проверка: `uv --version`).
2. **Подтянуть бэк-репо** — `task_board` и MCP-сервер живут на `origin/master`:
   в `../metravel-backend` выполнить `git pull` (и зависимости через `uv sync`, если нужно).
3. **Выпустить staff-токен** — залогиниться staff/admin-пользователем, скопировать его
   DRF-токен (строка в `authtoken_token`). **Токен в чат не вставлять.**
4. **Положить токен** в gitignored-файл `.secrets/metravel-task-board.env` (поле
   `METRAVEL_TASK_BOARD_API_TOKEN=`), затем перед запуском Claude Code в этом репо:
   ```bash
   source .secrets/metravel-task-board.env && export METRAVEL_TASK_BOARD_API_TOKEN
   ```
   или задать `METRAVEL_TASK_BOARD_API_TOKEN` как пользовательскую/системную переменную
   окружения (`.mcp.json` подставляет `${METRAVEL_TASK_BOARD_API_TOKEN}` из окружения).
5. **Перезапустить Claude Code** — MCP-сервер `metravel-task-board` поднимется автоматически.
   Проверка: попросить агента `ticket-board` показать борд (`metravel_task_board`).

Проверка без MCP (read-only, токен из окружения; токен не печатать):
```bash
curl -s -H "Authorization: Token $METRAVEL_TASK_BOARD_API_TOKEN" https://metravel.by/api/tasks/board/ | head
```

## Работа с бордом

- **Агент `ticket-board`** — единственный оператор борда: list/create/update/sync тикетов и
  спринтов через MCP. Инструменты: `metravel_task_board`, `metravel_tasks_list/_get/_create/_update/_delete`,
  `metravel_sprints_*`, `metravel_task_board_options`.
- **Skill `/ticket-flow`** (команда `/ticket`) — прогон фронт-тикета по пайплайну
  discovery → implement → test → review → release силами профильных FE-агентов, со сдвигом
  статуса на борде на каждом шаге. Зеркалит ролевой пайплайн бэка (`.codex/team`).

Модель: `Task{title, description, status: backlog→todo→in_progress→review→done, area: front|back,
reporter, assignee, blocked_by, sprint}`. Заголовок с префиксом источника `[FE-…]`/`[BE-…]`.

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
