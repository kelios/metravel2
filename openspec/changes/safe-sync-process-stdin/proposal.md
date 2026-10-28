## Why

На macOS синхронный child_process с опцией input иногда зависает на большом stdin (#2839, #2844). Файловый stdin уже устранил проблему в тестовом запускателе; рабочие скрипты должны использовать тот же механизм.

## What Changes

- Вынести файловый stdin и его cleanup в общий scripts/lib/runSyncWithStdin.js.
- Перевести четыре вызова карточки, worktree-bootstrap, guard-unimported-modules и runCli тестов.
- Добавить таймаут git check-ignore и policy-тест, запрещающий input у прямых синхронных запусков scripts/**.
- Проверить большие и пустые данные, ошибки, cleanup, существующие потребители и стресс 8×150.

## Capabilities

### New Capabilities

Нет: внутренний тулинг, skip_specs: true.

### Modified Capabilities

Нет изменений требований продукта.

## Impact

Scope: scripts/lib, шесть перечисленных скриптов, __tests__/scripts/cli-test-utils.ts и регрессионные тесты.
Platform impact: none; Localization impact: none.
Пользовательский интерфейс, API/data, SEO, accessibility, analytics и web/app bundle не меняются. Performance: исключается deadlock локального процесса. Security: временный каталог приватный, файлы удаляются при успехе и ошибке.
Dependencies: нет новых пакетов. Fallback/mock policy: реальные дочерние процессы.
Non-goals: миграция асинхронных запусков, backend, store/build/deploy, изменение SQL и данных отчётов.
