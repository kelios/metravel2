# Claude project entrypoint

Обязательные и актуальные правила проекта не дублируются в этом файле.

Перед задачей прочитайте `AGENTS.md` — обязательные границы, workflow и
чеклист. Этого достаточно для старта любой задачи.

Остальные документы читаются по требованию — нужным разделом, а не целиком
(`awk '/^## Раздел/,/^## /' docs/FILE.md`). Полное чтение `docs/CODEX.md`,
`docs/RULES.md` и `AGENTS.md` подряд стоит около 78k токенов контекста, которые
затем перечитываются на каждом шаге сессии, поэтому оно запрещено без реальной
нужды.

Карта «задача → что открыть»:

| задача | документ |
| --- | --- |
| triage, выбор skill, матрица проверок | `docs/CODEX.md` (нужный раздел) |
| глубина разбора задачи, доказательства, формат отчёта | `docs/AGENT_ANALYSIS_PROTOCOL.md` |
| ожидаемое поведение фичи (источник истины для постановки) | `docs/features/<фича>.md` |
| технические правила: UI, workflow, localization | `docs/RULES.md` (нужный раздел) |
| e2e-доступы, тестданные на проде, Android/iPhone devices, prod-baseline, долгие операции и locks | `docs/WORKFLOW_OPERATIONS.md` |
| каталог `$metravel-*` skills (Codex) | `docs/CODEX_SKILLS.md` |
| борд, Task Contract, формат описания задачи | `docs/TASK_BOARD_MCP.md` |
| повторяющиеся проблемы перед заведением карточки | `docs/PROBLEM_MEMORY.md` |
| всё остальное | найти файл в `docs/INDEX.md` |

Ключевые ограничения:

- работать только на `main` и сохранять чужие изменения; если сессия
  запущена в авто-worktree (`.claude/worktrees/*`), результат обязателен к
  переносу и коммиту в основной checkout на `main` — работа не остаётся в
  worktree-ветке;
- backend/Django/server в этом workspace не редактировать. Бэкенд-checkout уже
  есть на машине: `../metravel-backend` (клон приватного репо
  `sergey-savran/metravel`, branch `master`) — путь известен, спрашивать его у
  пользователя не нужно; читать read-only, изменения оформлять `area=back`
  задачей на борде;
- секреты не выводить и не просить вставлять в чат;
- iOS signed build, TestFlight/App Store upload, App Review submit, storefront
  release и production deploy выполнять только по отдельному явному точному запросу;
- проверять собственные изменения, не перекладывая QA на пользователя;
- перед любой задачей фиксировать platform impact для desktop web, mobile web,
  Android и iOS. Shared mobile UX проверять одним flow/state/locale; iPhone
  использует simulator/physical/TestFlight layer по риску, iPadOS вне первого release;
- фиксировать localization impact для RU/BE/UK/PL/EN; app-owned UI text
  проводить через `@/i18n`, а locale-sensitive formatting — через
  `i18n/format.ts`;
- task board MCP является источником правды, локальные `tasks/*.md` — только
  временный fallback;
- контекст стоит денег на каждом шаге, а не один раз: всё прочитанное
  перечитывается моделью в каждом последующем ходе сессии. Поэтому читай файл
  нужным куском (`awk`/`sed`/`Read` с `offset`/`limit`), а не целиком; не
  открывай большой файл повторно, если он уже в контексте; длинную задачу
  доводи до конца и начинай следующую с чистой сессии, а не продолжай одну на
  сотни шагов.

Исторические `.claude/agents`, `.claude/skills` и slash-команды могут оставаться
совместимым tool configuration, но не являются источником проектных правил.
