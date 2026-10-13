## Why

Во время внедрения нативных тем агент повторно запросил разрешение после планирования, хотя владелец уже заказал реализацию. Затем коммит отревьюенных файлов заблокировали предупреждения в незавершённых файлах соседней сессии: pre-commit выбирал весь общий checkout. Оба механизма прерывают уже разрешённую работу.

## What Changes

- Сохранять прямое разрешение implement/build/fix через proposal → apply, включая запрос «подготовь план и внедри»; planning-only без запроса реализации остаётся планированием.
- Ограничить выбор файлов pre-commit текущим индексом, используя существующий scope-вход проверки. Все относящиеся к этим файлам и глобальные guards сохраняются.
- Ошибки чтения списка, проверки и неподдерживаемые имена файлов останавливают коммит; временный manifest очищается.

## Capabilities

### New Capabilities

- `agent-task-workflow`: непрерывность разрешённой работы и проверка файлов текущего коммита в общем checkout.

### Modified Capabilities

Нет.

## Impact

- **Platform impact:** none — инструкции и локальный Git workflow; приложения не меняются этим change.
- **Localization impact:** none — нет app-owned UI.
- **User-visible:** владелец не повторяет уже данную команду; параллельные незавершённые файлы не добавляются к scope проверки его коммита.
- **Paths:** AGENTS.md, docs/RULES.md, оба SDD документа, openspec/config.yaml, Codex/Claude openspec-propose skill, githooks/pre-commit и focused script tests.
- **API/data/SEO/accessibility/analytics:** none — tooling-only, данные, маршруты и интерфейс приложения сохраняются.
- **Performance:** узкий commit scope исключает лишние feature suites; обычный check:fast сохраняет working-tree режим.
- **Security:** неизменные guards и fail-closed ошибки; store build/upload/submit/release и внешние operation gates сохраняются.
- **Dependencies:** существующий CLI --changed-files-file; нет backend/external service dependency.
- **Fallback/mock policy:** нет обхода проверок и fail-open fallback. Git/npm fixture tests проверяют настоящий hook, не подменяя проектные guards в production.
- **Existing behavior:** проверки собственных staged файлов, код возврата failure, общий quality lock, review и testing gates.
- **Non-goals:** изменение соседних i18n файлов, ослабление guards/baselines, проверка отдельного staged-content snapshot, изменение CI/pre-push или store разрешений.
- **Open questions:** none. Владелец прямо разрешил исправление workflow 13.10.2026; после проверки плана apply идёт без повторного подтверждения.
