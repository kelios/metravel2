## Why

Ignored окружение не попадает в новый worktree/shared clone: сборки и проверки
падают из-за отсутствующих env и pinned fonts (#2744, после #2727). Цель —
одной командой подготовить известные зависимости, сохраняя границы секретов.

## What Changes

- Явная команда bootstrap с определением основного checkout нашего frontend.
- Копирование закрытого списка ignored-файлов без перезаписи, кроме `--force`.
- Диагностика отсутствующего окружения и инструкции подготовки native targets.
- Регрессионные проверки безопасности и fresh-worktree acceptance.

## Capabilities

### New Capabilities
- `worktree-environment`: безопасная подготовка окружения принадлежащих проекту checkout.

### Modified Capabilities
Нет.

## Impact

Scope: scripts, npm-команда, focused tests, WORKFLOW_OPERATIONS и Problem Memory.
User-visible result: нет; это локальная DX-команда.
Platform impact: none (product/native-код не меняется).
Localization impact: none.
Data/API, SEO, accessibility, web performance, analytics: none, приложение не меняется.
Security: проверка происхождения обоих checkout, ignored/tracked boundary,
закрытый список файлов, отказ от symlink escape и вывода содержимого.
Dependencies: существующие ignored-файлы основного checkout; отсутствующие
не скачиваются и не заменяются фиктивными.
Fallback/mock policy: отсутствует; fixture secrets только в unit tests.
Preserve: main/clean-source, release authorization и operation locks.
Non-goals: публикации upstream, генерация секретов, автоматические build/install,
копирование node_modules/Pods/android и изменение backend.
Open questions: нет; native dependencies готовятся штатными командами отдельно.
