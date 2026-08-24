# AGENTS.md

Короткие always-on инструкции для AI-агента в `metravel`. Детальные контракты
живут в профильных документах и загружаются только по scope задачи.

## 1. Источники и экономия контекста

- `docs/RULES.md` — канонические технические и операционные правила.
- `docs/README.md` — карта документации, не обязательное чтение перед каждой
  задачей.
- `docs/CODEX.md` — ленивый router skills/агентов и validation matrix.
- `docs/CODEX_SKILLS.md` — machine-audited registry; читать только при изменении
  или аудите каталога skills.
- `docs/AGENT_ANALYSIS_PROTOCOL.md` — формат evidence-backed разбора.
- Не перечитывай этот файл через shell: он уже передан агенту как workspace
  instructions.
- Не загружай целиком `RULES.md`, `README.md`, `CODEX.md` и каталоги skills «на
  всякий случай». Сначала определи scope, затем открой только нужные разделы,
  профильный feature doc и выбранный `SKILL.md`.
- Начинай с одного профильного skill. Добавляй второй только для отдельной
  обязанности (UI, i18n, test, deploy, review). Orchestrator/multi-agent нужны
  для широкого, неясного, high-risk или явно много-ролевого scope.

## 2. Обязательный preflight

Перед изменениями кратко зафиксируй:

```text
Task type и ожидаемый результат:
Task-owned paths:
Platform impact: desktop web | mobile web | Android | iOS | shared | none
Localization impact: all current locales | selected locales | none
Risk/operation gates:
Validation:
```

- Работай только из корня с `package.json` и только на ветке `main`. Проверь
  `git branch --show-current` и `git status --short`; чужие изменения не
  переписывай. В harness worktree перенеси итог на основной `main` по правилам
  `docs/RULES.md`.
- Platform `shared` не создаёт автоматический Android/iPhone gate. Видимый
  common responsive UI проверяется на desktop web и mobile web; device gate
  нужен только для соответствующего platform-specific behavior/config/runtime.
- Production locales: RU/BE/UK/PL/EN, fallback RU. Новый app-owned UI text и
  locale formatting проходят через `i18n`; editorial/API content не переводится
  на клиенте.
- Для точечной задачи используй уровень S, для обычной M, для contract/high-risk/
  recurring/cross-platform — L по `docs/AGENT_ANALYSIS_PROTOCOL.md`. OpenSpec
  нужен только для новых функций, изменений контрактов и действительно сложных
  или повторяющихся проблем; apply начинается отдельным запросом пользователя.

## 3. Границы и безопасность

- Этот workspace владеет только frontend/app/docs. `../metravel-backend` и
  `area=back` — read-only diagnosis/probes/board evidence. Никогда не меняй
  backend working tree и не выполняй там mutating Git-команды.
- На production Git-tracked backend paths неизменяемы. Перед явно разрешённой
  server write прочитай профильный раздел `docs/RULES.md`, проверь status и
  `git ls-files`; dirty checkout означает stop и backend/ops task, не cleanup.
- Nginx принадлежит backend: источник —
  `../metravel-backend:deploy/prod/nginx/nginx.conf`. Локальный
  `nginx/nginx.conf` не править; нужное изменение оформлять как `area=back` task
  с точным diff и проверкой.
- Не меняй без прямого запроса `eas.json`, `app.json`, `.github/workflows/`,
  `nginx/`, `plugins/`, `scripts/`, `public/robots.txt`, `public/sitemap.xml`,
  `entry.js`.
- Не выводи secrets из `.env*`, `.env.e2e`, `.secrets`, SSH, EAS, Play или
  deploy configs. Временные логи/screenshots/traces/JSON храни только в ignored
  `.codex-temp/`, `.codex-debug/`, `test-results/` или `playwright-report/`.
- Production deploy, store build/upload/submit/release и другие внешние
  мутации требуют точной текущей команды пользователя и профильного operator
  skill. Один разрешённый stage не разрешает следующий.
- Android EAS/cloud build/submit запрещён; Android собирается локально. iOS
  signed build, TestFlight/App Store upload, review submit и storefront release
  — четыре независимых authorization gate.

## 4. Работа по scope

1. Найди существующий компонент/hook/service/util/test и профильный contract.
2. Установи механизм до `path:line` и подтверди evidence; иначе явно пометь
   гипотезу. Не правь симптом вслепую.
3. Перед правкой назови выбранный вариант, одну отвергнутую альтернативу, риск и
   откат. Для уровня S достаточно одной короткой строки.
4. Внеси минимальный diff без попутной миграции. Реальные ошибки в затронутой
   зоне исправь; out-of-scope риск зафиксируй с конкретным следующим check.
5. После логического блока запусти самый узкий надёжный check. Full/preflight,
   build, deploy, e2e, Lighthouse и device install сначала проходят operation
   gate из `docs/WORKFLOW_OPERATIONS.md`; не дублируй живой процесс/lock.
6. После code changes обязательный `$metravel-code-reviewer` review-and-fix по
   полному task diff. Предпочтителен независимый `review-auditor`; reviewer
   исправляет подтверждённые findings, перечитывает итоговый diff и повторяет
   проверки без рекурсивного reviewer.

### Условные контракты

- Board mutation: сначала `$metravel-problem-memory`, затем
  `$metravel-task-contract`/`$metravel-ticket-board`; детали и status semantics —
  `docs/TASK_BOARD_MCP.md`. `testing` — активная QA или точный temporal/retest
  gate, не парковка; missing access/device требует конкретного unblock request.
- Прямая backend-приёмка выполняется только по прямому запросу про backend и
  только релевантными source/API/production probes. Общая sprint review
  пропускает `area=back`.
- UI/layout/interaction: используй существующие `components/ui`, tokens и
  Feather icons; подробные контракты — релевантные разделы `docs/RULES.md` и
  feature docs. Видимый web diff требует browser evidence, screenshots и console.
- External links: только helpers из `utils/externalLinks.ts`; никаких прямых
  `window.open` или `Linking.openURL` вне chokepoint.
- Article/quest media можно создавать по запросу. Creative prose, tasks, hints,
  titles или SEO text меняй только после отдельного явного подтверждения
  пользователя.
- Android-specific scope: сначала `adb devices -l`, затем local build/install и
  device QA. iOS-specific scope выбирает simulator/physical/TestFlight layer по
  затронутому контракту; hardware capabilities не доказываются simulator.

## 5. Validation и handoff

- Docs/skill metadata: structure/frontmatter + `npm run audit:prompts`; skill
  validator — для изменённых skills.
- Малый code block: targeted checks или `npm run check:fast`.
- Средний diff: релевантные tests/lint или `npm run check:preflight`.
- Крупный diff: `npm run lint` и `npm run test:run`.
- Localization: `npm run test:i18n`; external links: соответствующий governance
  guard; release/performance: только production build/real URL по профильному doc.
- `SKIPPED` из-за чужого quality gate — coordination evidence, не pass. Если
  результат обязателен, запроси его и продолжи тот же acceptance pass.
- Пользователь не тестирует за агента. Если нужен unlock/connect/login/access,
  попроси ровно это действие и после ответа продолжи проверку.
- Финальный ответ: результат; механизм `path:line`; изменённые файлы; фактические
  команды/пробы; что сознательно не тронуто; остаточный риск или точный recheck.
