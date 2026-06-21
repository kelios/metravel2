# Tasks — формат и правила

> **С 2026-06-10 источник правды о задачах — общий MCP task board** (`metravel.by/board`,
> Django app `task_board`, единый для фронта и бэка). См. `docs/TASK_BOARD_MCP.md`.
> Новые задачи заводятся на борде агентом `ticket-board`; прогон по пайплайну — skill
> `/ticket-flow`. Каталог `tasks/` теперь хранит только **переходный открытый бэклог**
> (импортируется на борд, затем файлы удаляются) и канонический **шаблон описания**.
> Не создавай новые локальные `tasks/*.md` в обычном workflow. Если board/MCP недоступен,
> локальный файл допустим только как временный draft для последующего import/sync на борд
> и удаления черновика.

Для board-задачи используй формат `tasks/000-template.md`
(Goal / Context / Acceptance Criteria / Gherkin / Task Contract) в поле `description`.
**Не выдумывай свою структуру** — копируй шаблон и заводи задачу через `ticket-board`.

---

## Имя файла и ID (для переходных локальных файлов)

- **Имя файла:** `NNN-kebab-slug.md`, `NNN` — сквозной счётчик с ведущими нулями;
  бери `max(существующих NNN) + 1`.
- **Заголовок:** `# TASK-YYYYMMDD-NNN: Short Title` (дата создания + тот же номер).
- На борде заголовок получает префикс источника: `[FE-NNN] …` / `[BE-NNN] …` / `[TASK-…] …`.

## Шапка (метаданные)

```
Status: Backlog
Owner: Backend
Support: Frontend Developer, Tester, Reviewer, Releaser
Created: 2026-06-08
Updated: 2026-06-08
```

- **Status** ↔ статус на борде: `Backlog→backlog`, `In Progress→in_progress`,
  `In Review→review`, `Done→done` (+ `Blocked`/`Cancelled`). При закрытии —
  `Done (verified YYYY-MM-DD)` и при наличии — цитата-проверка строкой `> ...`.
- **Owner** — главная роль (`Backend`/`Frontend`/`SEO`/`Content`/`Manager`); на борде это
  `area` (`back`/`front`) + `assignee`.
- **Support** — вспомогательные роли. **Created** не меняется, **Updated** — дата правки.
- Даты — `YYYY-MM-DD`, абсолютные.

## Секции (обязательны все, по порядку)

1. **## Goal** — 1–2 предложения о результате (что и зачем, без «как»).
2. **## Context** — фон, запрос, ссылки, файлы, ограничения, probe-результаты. Внутри —
   блок `Source task:` (`Source id` / `Source path`); нет источника — поля пустые, блок не удалять.
3. **## Acceptance Criteria** — чеклист `- [ ]` проверяемых критериев (наблюдаемые факты).
4. **## Gherkin Tests** — `Feature/Scenario` с `Given/When/Then` о поведении.
5. **## Task Contract** — обязательный контракт FE/BE-задачи: `Scope`, `User-visible result`,
   `Data/API contract`, `Dependencies`, `Fallback/mock policy`, `Validation`, `Done gate`.
   Подробное правило и Done gate — в `docs/TASK_BOARD_MCP.md`.
6. **## Assignment** — `Primary owner:` и `Support agents:` (маппинг ролей → агенты, таблица ниже).
7. **## Likely Files Or Areas** — файлы/модули/эндпоинты (для бэка — логические области).
8. **## Plan** — нумерованные шаги.
9. **## Validation** — конкретные команды/проверки (`npm run …`, `curl …`, шаги в браузере).
10. **## Release Checklist** — чеклист готовности; шаблонные пункты не удалять.
11. **## Progress Log** — хронология `- YYYY-MM-DD: …`; первая строка `Created.`.
12. **## Results** — `Changed files:` / `Validation evidence:` / `Reviewer findings:` /
    `Release notes:` / `Blockers:`.

---

## Роли → агенты проекта

| Роль | Кто исполняет |
|---|---|
| Manager / Board operator | агент `ticket-board` (MCP-борд: create/list/update/sync) |
| Orchestrator / Refinement | основной агент + `$metravel-task-contract` (оформление Task Contract) |
| Developer (FE) | `travel-expert`, `map-expert`, `metravel-seo-expert`, `refactor-surgeon`, `dev-loop` |
| Developer (BE) | отдельный репо `../metravel-backend` → только трекинг на борде (`area=back`), кодом тут не делается |
| Content / SEO | `travel-writer`, `metravel-seo-expert`, `index-doctor` |
| Tester | `test-author` |
| Reviewer | `/code-review` / `review-auditor` |
| Acceptance / Sprint review | агент `board-reviewer` (skill `/sprint-review`): приёмка тикетов спринта по Done gate → `done` или возврат |
| Releaser | `/preflight` + `frontend-deployer` (по явному target env) |

Бэкенд-задачи (отдельный сервис) не реализуются в этом репо — заводятся на борде `area=back`
и передаются владельцу/бэкендеру; статусы и доказательства закрытия сверяет
`backend-status-sync`, записывая верификацию в комментарии тикетов борда.

## Принципы

- **Борд — источник правды.** Локальные файлы переходные: импортированы → удалены.
- Шаблон — контракт: не добавляй/не удаляй секции, заполняй существующие.
- Факты, а не догадки: probe-результаты, реальные URL/коды, реальные пути.
- Acceptance Criteria и Gherkin должны быть проверяемы — без них задача не готова к старту.
- FE/BE-задачи без заполненного `Task Contract` не готовы к старту и не закрываются в `Done`.
- См. `docs/TASK_BOARD_MCP.md` (борд/MCP), `docs/CODEX.md` (планирование).
