## Why

В #2829 завершающая правка общего маршрута привела к ненужным Android/iOS
пересборкам и UI-пробам: старый список платформ в карточке был принят без
повторного выбора проверок. Risk-based правило уже существует, но ему
противоречат отдельные role/skill prompts и отсутствует проверка до подготовки
окружения.

## What Changes

- Сделать `Validation selection gate` в `docs/TESTING.md` единственным источником
  выбора проверок до назначения tester, чтения native-runbook и stamp/build.
- Разделить влияние на платформы и обязательные проверочные targets; уточнять
  старую матрицу карточки по всему ещё не принятому task-owned изменению и
  совместимому evidence. Прямой текущий запрос полного QA/release сохраняется.
- Удалить противоречащие безусловные native-требования и раннюю загрузку native
  процедур из canonical skills, roles и adapters; синхронизировать зеркала.
- Закрепить нужные ссылки и известные запрещённые формулировки в существующем
  prompt audit с регрессионными mutation fixtures.

## Capabilities

### New Capabilities

- `validation-scope-selection`: выбор минимального достаточного evidence перед
  выполнением проверок и защита prompt-каталога от возврата blanket-матриц.

### Modified Capabilities

Нет.

## Impact

Platform impact: none — меняются инструкции и их аудит, код приложения не меняется.
Localization impact: none — app-owned тексты/locale ресурсы не затрагиваются.
User-visible/API/data/SEO/accessibility/analytics impact: none; результат для
владельца — отсутствие необоснованных прогонов. Performance impact: меньше
лишних проверок, без изменения product/runtime budgets. Security impact:
обязательные native/capability/store gates сохраняются.

Scope: canonical testing/board/router docs, подтверждённые skill/role/adapters,
prompt-audit guard и его unit fixtures, generated mirrors.
Non-goals: новый универсальный test planner, изменение приложения/бэкенда,
браузерные и device-прогоны, сборки, deploy и ослабление release-проверок.
Dependencies: существующие sync/skill-validator/prompt-audit инструменты;
чужой quality slot согласуется до проверок.
Fallback/mock policy: только файловые fixtures для проверки instruction drift;
успех статического аудита не выдаётся за доказательство послушания модели.
